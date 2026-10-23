import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type DateFilter = {
  gte?: Date;
  lte?: Date;
};

type StockReportRow = {
  id: number;
  fabricType: string;
  color: string;
  weightKg: number;
  lengthMeter: number;
  transactionDate: string;
  source: "entry" | "exit";
};

const parseDate = (value: unknown): Date | null => {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const endOfDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const toText = (value: string | null | undefined, fallback: string): string => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 ? normalized : fallback;
};

const normalizeUnitType = (value: string | null | undefined): "kg" | "m" => {
  const normalized = toText(value, "kg").toLocaleLowerCase("tr-TR");
  return normalized.startsWith("m") ? "m" : "kg";
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Yalnızca GET metodu destekleniyor" });
    }

  try {
    const startDate = parseDate(req.query.startDate);
    const rawEndDate = parseDate(req.query.endDate);
    const finishDate = rawEndDate ? endOfDay(rawEndDate) : null;

    const entryDateFilter: DateFilter = {};
    const exitDateFilter: DateFilter = {};
    if (startDate) {
      entryDateFilter.gte = startDate;
      exitDateFilter.gte = startDate;
    }
    if (finishDate) {
      entryDateFilter.lte = finishDate;
      exitDateFilter.lte = finishDate;
    }

    const entries = await prisma.fabricEntry.findMany({
      where: Object.keys(entryDateFilter).length > 0 ? { entryDate: entryDateFilter } : undefined,
      include: {
        fabric: { select: { name: true } },
        color: { select: { name: true } },
      },
      orderBy: { entryDate: "desc" },
    });

    const exits = await prisma.fabricExit.findMany({
      where: Object.keys(exitDateFilter).length > 0 ? { createdAt: exitDateFilter } : undefined,
      select: {
        id: true,
        fabricType: true,
        color: true,
        productWeightKg: true,
        productLengthMeter: true,
        unitType: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const documents = await prisma.$queryRaw<
      Array<{
        id: number;
        quantity: number | null;
        unitType: string | null;
        date: Date;
        fabricName: string | null;
        colorName: string | null;
      }>
    >(Prisma.sql`
      SELECT
        fd."id",
        fd."quantity",
        fd."unitType",
        fd."date",
        f."name" AS "fabricName",
        c."name" AS "colorName"
      FROM "FabricDocument" fd
      LEFT JOIN "Fabric" f ON f."id" = fd."fabricId"
      LEFT JOIN "Color" c ON c."id" = fd."colorId"
      WHERE 1=1
      ${startDate ? Prisma.sql`AND fd."date" >= ${startDate}` : Prisma.empty}
      ${finishDate ? Prisma.sql`AND fd."date" <= ${finishDate}` : Prisma.empty}
      ORDER BY fd."date" DESC
    `);

    const entryRows: StockReportRow[] = entries.map((entry) => ({
      id: entry.id,
      fabricType: toText(entry.fabric?.name, "Bilinmeyen Kumaş"),
      color: toText(entry.color?.name, "Belirtilmedi"),
      weightKg: Number(entry.quantityKg) || 0,
      lengthMeter: Number(entry.lengthMeter) || 0,
      transactionDate: entry.entryDate.toISOString(),
      source: "entry",
    }));

    const exitRows: StockReportRow[] = exits.map((exit) => ({
      id: -Math.abs(exit.id),
      fabricType: toText(exit.fabricType, "Bilinmeyen Kumaş"),
      color: toText(exit.color, "Belirtilmedi"),
      weightKg: toText(exit.unitType, "").toLowerCase() === "kg" ? Number(exit.productWeightKg) || 0 : 0,
      lengthMeter:
        toText(exit.unitType, "").toLowerCase() === "m" ? Number(exit.productLengthMeter) || 0 : 0,
      transactionDate: exit.createdAt.toISOString(),
      source: "exit",
    }));

    const documentRows: StockReportRow[] = documents
      .map((document) => {
        const unitType = normalizeUnitType(document.unitType);
        const quantity = Number(document.quantity) || 0;
        const weightKg = unitType === "kg" ? quantity : 0;
        const lengthMeter = unitType === "m" ? quantity : 0;

        return {
          id: 1_000_000_000 + Number(document.id),
          fabricType: toText(document.fabricName, "Bilinmeyen Kumas"),
          color: toText(document.colorName, "Belirtilmedi"),
          weightKg,
          lengthMeter,
          transactionDate: document.date.toISOString(),
          source: "entry" as const,
        };
      })
      .filter((row) => row.weightKg > 0 || row.lengthMeter > 0);

    const rows = [...entryRows, ...documentRows, ...exitRows].sort(
      (a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
    );

    return res.status(200).json(rows);
  } catch (error) {
    console.error("Stok raporu API hatası:", error);
    return res.status(500).json({ error: "Stok raporu alınamadı" });
  }
}
