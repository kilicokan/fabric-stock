import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toText = (value: string | null | undefined, fallback: string): string => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 ? normalized : fallback;
};

const toIsoDate = (value: Date | null | undefined): string => {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Only GET method is supported" });
  }

  try {
    // Get all accessories with their warehouse info
    const accessories = await prisma.accessory.findMany({
      include: {
        warehouse: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    // Get all accessory documents for stock calculations
    const documents = await prisma.$queryRaw<
      Array<{
        id: number;
        accessoryId: number | null;
        quantity: number | null;
        unitType: string | null;
        type: string | null;
        date: Date | null;
      }>
    >(Prisma.sql`
      SELECT 
        ad."id",
        ad."accessoryId",
        ad."quantity",
        ad."unitType",
        ad."type",
        ad."date"
      FROM "AccessoryDocument" ad
      WHERE ad."quantity" > 0
    `);

    // Calculate stock for each accessory
    const stockCalculations = accessories.map((accessory) => {
      const accessoryDocuments = documents.filter(
        (doc) => doc.accessoryId === accessory.id
      );

      // Calculate total in (entries)
      const totalIn = accessoryDocuments
        .filter((doc) => {
          const type = doc.type?.toLowerCase() || "";
          return (
            type.includes("giriş") ||
            type.includes("irsaliye") ||
            type.includes("fatura") ||
            type.includes("tedarik")
          );
        })
        .reduce((sum, doc) => sum + toNumber(doc.quantity), 0);

      // Calculate total out (exits)
      const totalOut = accessoryDocuments
        .filter((doc) => {
          const type = doc.type?.toLowerCase() || "";
          return type.includes("çıkış") || type.includes("satış");
        })
        .reduce((sum, doc) => sum + toNumber(doc.quantity), 0);

      // Current stock = initial stock + in - out
      const currentStock =
        toNumber(accessory.stockQuantity) + totalIn - totalOut;

      return {
        id: accessory.id,
        accessoryName: toText(accessory.name, "Tanımsız"),
        color: "Belirtilmedi", // Accessories don't have color in this context
        totalIn,
        totalOut,
        currentStock,
        unit: toText(accessory.unit, "adet"),
        category: toText(accessory.warehouse?.name, "Genel"),
        minStockLevel: 10, // Default minimum stock level
        lastUpdated: toIsoDate(accessory.updatedAt),
      };
    });

    // Sort by name
    stockCalculations.sort((a, b) =>
      a.accessoryName.localeCompare(b.accessoryName, "tr-TR")
    );

    return res.status(200).json(stockCalculations);
  } catch (error) {
    console.error("Accessory stock calculations error:", error);
    return res
      .status(500)
      .json({ error: "Accessory stock calculations could not be generated" });
  }
}
