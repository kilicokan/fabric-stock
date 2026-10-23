import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";

type RemainingStockRow = {
  fabricId: number;
  fabricName: string;
  totalEntry: number;
  totalUsed: number;
  totalRemaining: number;
};

const parseDate = (raw: string | string[] | undefined): Date | null => {
  if (!raw || Array.isArray(raw)) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<RemainingStockRow[] | { error: string }>) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const startDate = parseDate(req.query.startDate);
    const endDate = parseDate(req.query.endDate);

    if ((req.query.startDate && !startDate) || (req.query.endDate && !endDate)) {
      return res.status(400).json({ error: "Gecersiz tarih parametresi" });
    }

    const dateFilter =
      startDate || endDate
        ? {
            entryDate: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : undefined;

    const fabrics = await prisma.fabric.findMany({
      select: {
        id: true,
        name: true,
        entries: {
          where: dateFilter,
          select: {
            quantityKg: true,
            fabricExits: {
              select: {
                productWeightKg: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const result: RemainingStockRow[] = fabrics.map((fabric) => {
      const totalEntry = fabric.entries.reduce((sum, entry) => sum + (Number(entry.quantityKg) || 0), 0);
      const totalUsed = fabric.entries.reduce(
        (sum, entry) =>
          sum +
          entry.fabricExits.reduce((exitSum, exit) => exitSum + (Number(exit.productWeightKg) || 0), 0),
        0,
      );

      return {
        fabricId: fabric.id,
        fabricName: fabric.name,
        totalEntry: Number(totalEntry.toFixed(3)),
        totalUsed: Number(totalUsed.toFixed(3)),
        totalRemaining: Number((totalEntry - totalUsed).toFixed(3)),
      };
    });

    return res.status(200).json(result);
  } catch (error: unknown) {
    console.error("Remaining stock API error:", error);
    return res.status(500).json({ error: "Stok raporu alinamadi." });
  }
}
