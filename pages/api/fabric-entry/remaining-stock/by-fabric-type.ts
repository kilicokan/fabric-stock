import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type StockSummaryRow = {
  fabricType: string;
  color: string;
  totalEntry: number;
  totalUsed: number;
  totalRemaining: number;
  remainingKg: number;
};

type DateFilter = {
  gte?: Date;
  lte?: Date;
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

const normalizeText = (value: string | null | undefined, fallback: string): string => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 ? normalized : fallback;
};

const normalizeColorTokens = (value: string | null | undefined): string[] => {
  const raw = typeof value === "string" ? value : "";
  const tokens = raw
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  return tokens.length > 0 ? tokens : ["Belirtilmedi"];
};

const normalizeUnitType = (value: string | null | undefined): "kg" | "m" => {
  const normalized = normalizeText(value, "kg").toLocaleLowerCase("tr-TR");
  return normalized.startsWith("m") ? "m" : "kg";
};

const makeKey = (fabricType: string, color: string): string => `${fabricType}||${color}`;

const ensureRow = (pool: Map<string, StockSummaryRow>, fabricType: string, color: string): StockSummaryRow => {
  const key = makeKey(fabricType, color);
  const existing = pool.get(key);
  if (existing) return existing;

  const created: StockSummaryRow = {
    fabricType,
    color,
    totalEntry: 0,
    totalUsed: 0,
    totalRemaining: 0,
    remainingKg: 0,
  };
  pool.set(key, created);
  return created;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
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
      select: {
        quantityKg: true,
        fabric: { select: { name: true } },
        color: { select: { name: true } },
      },
    });

    const exits = await prisma.fabricExit.findMany({
      where: Object.keys(exitDateFilter).length > 0 ? { createdAt: exitDateFilter } : undefined,
      select: {
        fabricType: true,
        color: true,
        unitType: true,
        productWeightKg: true,
        productLengthMeter: true,
      },
    });

    const documents = await prisma.$queryRaw<
      Array<{
        quantity: number | null;
        unitType: string | null;
        fabricName: string | null;
        colorName: string | null;
      }>
    >(Prisma.sql`
      SELECT
        fd."quantity",
        fd."unitType",
        f."name" AS "fabricName",
        c."name" AS "colorName"
      FROM "FabricDocument" fd
      LEFT JOIN "Fabric" f ON f."id" = fd."fabricId"
      LEFT JOIN "Color" c ON c."id" = fd."colorId"
      WHERE 1=1
      ${startDate ? Prisma.sql`AND fd."date" >= ${startDate}` : Prisma.empty}
      ${finishDate ? Prisma.sql`AND fd."date" <= ${finishDate}` : Prisma.empty}
    `);

    const summary = new Map<string, StockSummaryRow>();

    entries.forEach((entry) => {
      const fabricType = normalizeText(entry.fabric?.name, "Bilinmeyen Kumaş");
      const color = normalizeText(entry.color?.name, "Belirtilmedi");
      const row = ensureRow(summary, fabricType, color);
      row.totalEntry += Number(entry.quantityKg) || 0;
    });

    documents.forEach((document) => {
      if (normalizeUnitType(document.unitType) !== "kg") return;

      const quantity = Number(document.quantity) || 0;
      if (quantity <= 0) return;

      const fabricType = normalizeText(document.fabricName, "Bilinmeyen Kumas");
      const color = normalizeText(document.colorName, "Belirtilmedi");
      const row = ensureRow(summary, fabricType, color);
      row.totalEntry += quantity;
    });

    exits.forEach((exit) => {
      const unit = normalizeUnitType(exit.unitType);

      const fabricType = normalizeText(exit.fabricType, "Bilinmeyen Kumaş");
      const colorTokens = normalizeColorTokens(exit.color);
      const totalWeight =
        unit === "m" ? Number(exit.productLengthMeter) || 0 : Number(exit.productWeightKg) || 0;
      if (totalWeight <= 0) return;

      const distributedWeight = totalWeight / colorTokens.length;
      colorTokens.forEach((colorToken) => {
        const row = ensureRow(summary, fabricType, colorToken);
        row.totalUsed += distributedWeight;
      });
    });

    const rows = Array.from(summary.values())
      .map((row) => {
        const totalRemaining = row.totalEntry - row.totalUsed;
        return {
          ...row,
          totalEntry: Number(row.totalEntry.toFixed(3)),
          totalUsed: Number(row.totalUsed.toFixed(3)),
          totalRemaining: Number(totalRemaining.toFixed(3)),
          remainingKg: Number(totalRemaining.toFixed(3)),
        };
      })
      .sort((a, b) => {
        const typeOrder = a.fabricType.localeCompare(b.fabricType, "tr", { sensitivity: "base" });
        if (typeOrder !== 0) return typeOrder;
        return a.color.localeCompare(b.color, "tr", { sensitivity: "base" });
      });

    return res.status(200).json(rows);
  } catch (error) {
    console.error("Kumaş kalan stok API hatası:", error);
    return res.status(500).json({ error: "Kalan stok verisi alınamadı" });
  }
}
