import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type StockCalculationRow = {
  id: number;
  fabricName: string;
  color: string;
  totalIn: number;
  totalOut: number;
  currentStock: number;
  defectiveQuantity: number;
  unit: string;
  category: string;
  minStockLevel: number;
  lastUpdated: string;
};

type MutableRow = Omit<StockCalculationRow, "id" | "lastUpdated"> & {
  lastUpdatedTs: number;
};

const DEFAULT_MIN_STOCK_LEVEL = 10;

const normalizeText = (value: string | null | undefined): string =>
  typeof value === "string" ? value.trim() : "";

const normalizeKey = (value: string): string =>
  value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("tr-TR");

const normalizeColorTokens = (rawColor: string | null | undefined): string[] => {
  const raw = normalizeText(rawColor);
  if (!raw) return [];
  return raw
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
};

const normalizeUnitType = (unitType: string | null | undefined): "kg" | "m" => {
  const normalized = normalizeText(unitType).toLocaleLowerCase("tr-TR");
  return normalized.startsWith("m") ? "m" : "kg";
};

const round = (value: number): number => Number(value.toFixed(3));

const isWarehouseCompatibilityError = (error: unknown): boolean => {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes("unknown field `warehouse`") ||
    message.includes("cannot read properties of undefined") ||
    message.includes("does not exist")
  );
};

const buildRowKey = (fabricName: string, color: string): string =>
  `${normalizeKey(fabricName)}||${normalizeKey(color)}`;

const ensureRow = (
  pool: Map<string, MutableRow>,
  fabricName: string,
  color: string,
  unit: string,
  category: string
): MutableRow => {
  const key = buildRowKey(fabricName, color);
  const existing = pool.get(key);
  if (existing) return existing;

  const created: MutableRow = {
    fabricName,
    color,
    totalIn: 0,
    totalOut: 0,
    currentStock: 0,
    defectiveQuantity: 0,
    unit,
    category,
    minStockLevel: DEFAULT_MIN_STOCK_LEVEL,
    lastUpdatedTs: 0,
  };
  pool.set(key, created);
  return created;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Only GET method is supported" });
  }

  try {
    let fabrics: Array<{
      id: number;
      name: string;
      unit: string | null;
      depot: string | null;
      property: string | null;
      defectiveQuantity: number;
      warehouse?: {
        code: string | null;
        name: string | null;
      } | null;
    }> = [];

    try {
      fabrics = await prisma.fabric.findMany({
        select: {
          id: true,
          name: true,
          unit: true,
          depot: true,
          property: true,
          defectiveQuantity: true,
          warehouse: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      });
    } catch (error) {
      if (!isWarehouseCompatibilityError(error)) {
        throw error;
      }
      fabrics = await prisma.fabric.findMany({
        select: {
          id: true,
          name: true,
          unit: true,
          depot: true,
          property: true,
          defectiveQuantity: true,
        },
      });
    }

    const [entries, exits, documents] = await Promise.all([
      prisma.fabricEntry.findMany({
        select: {
          fabricId: true,
          quantityKg: true,
          entryDate: true,
          color: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.fabricExit.findMany({
        select: {
          fabricType: true,
          color: true,
          unitType: true,
          productWeightKg: true,
          productLengthMeter: true,
          createdAt: true,
        },
      }),
      prisma.$queryRaw<
        Array<{
          fabricId: number | null;
          quantity: number | null;
          unitType: string | null;
          date: Date;
          fabricName: string | null;
          fabricUnit: string | null;
          fabricDepot: string | null;
          fabricProperty: string | null;
          colorName: string | null;
        }>
      >(Prisma.sql`
        SELECT
          fd."fabricId",
          fd."quantity",
          fd."unitType",
          fd."date",
          f."name" AS "fabricName",
          f."unit" AS "fabricUnit",
          f."depot" AS "fabricDepot",
          f."property" AS "fabricProperty",
          c."name" AS "colorName"
        FROM "FabricDocument" fd
        LEFT JOIN "Fabric" f ON f."id" = fd."fabricId"
        LEFT JOIN "Color" c ON c."id" = fd."colorId"
        WHERE COALESCE(fd."quantity", 0) > 0
      `),
    ]);

    const fabricById = new Map<number, (typeof fabrics)[number]>();
    const fabricByNameKey = new Map<string, (typeof fabrics)[number]>();
    fabrics.forEach((fabric) => {
      fabricById.set(fabric.id, fabric);
      fabricByNameKey.set(normalizeKey(fabric.name), fabric);
    });

    const rows = new Map<string, MutableRow>();
    const fabricColorsByFabricId = new Map<number, string[]>();

    entries.forEach((entry) => {
      const fabric = fabricById.get(entry.fabricId);
      const fabricName = normalizeText(fabric?.name) || "Bilinmeyen Kumaş";
      const color = normalizeText(entry.color?.name) || "Belirtilmedi";
      const unit = normalizeText(fabric?.unit) || "KG";
      const category =
        normalizeText(fabric?.warehouse?.code) ||
        normalizeText(fabric?.depot) ||
        normalizeText(fabric?.property) ||
        "Genel";

      const row = ensureRow(rows, fabricName, color, unit, category);
      row.totalIn += Number(entry.quantityKg) || 0;
      row.lastUpdatedTs = Math.max(row.lastUpdatedTs, entry.entryDate.getTime());

      if (entry.fabricId) {
        const colors = fabricColorsByFabricId.get(entry.fabricId) || [];
        if (!colors.includes(color)) {
          colors.push(color);
          fabricColorsByFabricId.set(entry.fabricId, colors);
        }
      }
    });

    documents.forEach((document) => {
      if (normalizeUnitType(document.unitType) !== "kg") return;

      const quantity = Number(document.quantity) || 0;
      if (quantity <= 0) return;

      const mappedById = document.fabricId ? fabricById.get(Number(document.fabricId)) : undefined;
      const rawDocumentFabricName = normalizeText(document.fabricName);
      const mappedByName = rawDocumentFabricName
        ? fabricByNameKey.get(normalizeKey(rawDocumentFabricName))
        : undefined;
      const resolvedFabric =
        mappedById ||
        mappedByName || {
          name: document.fabricName,
          unit: document.fabricUnit,
          depot: document.fabricDepot,
          property: document.fabricProperty,
        };

      const fabricName = normalizeText(resolvedFabric?.name) || rawDocumentFabricName || "Bilinmeyen Kumas";
      const color = normalizeText(document.colorName) || "Belirtilmedi";
      const unit = normalizeText(resolvedFabric?.unit) || "KG";
      const category =
        normalizeText((resolvedFabric as { warehouse?: { code?: string | null } } | undefined)?.warehouse?.code) ||
        normalizeText(resolvedFabric?.depot) ||
        normalizeText(resolvedFabric?.property) ||
        "Genel";

      const row = ensureRow(rows, fabricName, color, unit, category);
      row.totalIn += quantity;
      row.lastUpdatedTs = Math.max(row.lastUpdatedTs, document.date.getTime());
    });

    exits.forEach((exit) => {
      const unitType = normalizeUnitType(exit.unitType);

      const rawFabricType = normalizeText(exit.fabricType) || "Bilinmeyen Kumaş";
      const mappedFabric = fabricByNameKey.get(normalizeKey(rawFabricType));
      const fabricName = normalizeText(mappedFabric?.name) || rawFabricType;
      const unit = normalizeText(mappedFabric?.unit) || "KG";
      const category =
        normalizeText(mappedFabric?.warehouse?.code) ||
        normalizeText(mappedFabric?.depot) ||
        normalizeText(mappedFabric?.property) ||
        "Genel";

      const colors = normalizeColorTokens(exit.color);
      const colorTokens = colors.length > 0 ? colors : ["Belirtilmedi"];

      const totalOut =
        unitType === "m"
          ? Number(exit.productLengthMeter) || 0
          : Number(exit.productWeightKg) || 0;
      if (totalOut <= 0) return;

      const sharedOut = totalOut / colorTokens.length;
      colorTokens.forEach((colorToken) => {
        const row = ensureRow(rows, fabricName, colorToken, unit, category);
        row.totalOut += sharedOut;
        row.lastUpdatedTs = Math.max(row.lastUpdatedTs, exit.createdAt.getTime());
      });
    });

    fabrics.forEach((fabric) => {
      const fabricName = normalizeText(fabric.name);
      if (!fabricName) return;

      const fabricDefective = Number(fabric.defectiveQuantity) || 0;
      if (fabricDefective <= 0) return;

      const category =
        normalizeText(fabric.warehouse?.code) ||
        normalizeText(fabric.depot) ||
        normalizeText(fabric.property) ||
        "Genel";

      const colorTokens =
        fabricColorsByFabricId.get(fabric.id)?.map((token) => normalizeText(token)) || [];

      const tokens = colorTokens.length > 0 ? colorTokens : ["Belirtilmedi"];
      const sharedDefective = fabricDefective / tokens.length;

      tokens.forEach((colorToken) => {
        const row = ensureRow(rows, fabricName, colorToken, normalizeText(fabric.unit) || "KG", category);
        row.defectiveQuantity = Math.max(row.defectiveQuantity, 0) + sharedDefective;
        row.lastUpdatedTs = Math.max(row.lastUpdatedTs, Date.now());
      });
    });

    const result: StockCalculationRow[] = Array.from(rows.values())
      .map((row) => {
        const currentStock = row.totalIn - row.totalOut;
        return {
          id: 0,
          fabricName: row.fabricName,
          color: row.color,
          totalIn: round(row.totalIn),
          totalOut: round(row.totalOut),
          currentStock: round(currentStock),
          defectiveQuantity: round(row.defectiveQuantity),
          unit: row.unit,
          category: row.category,
          minStockLevel: row.minStockLevel,
          lastUpdated:
            row.lastUpdatedTs > 0 ? new Date(row.lastUpdatedTs).toISOString() : new Date().toISOString(),
        };
      })
      .filter((row) => row.totalIn > 0 || row.totalOut > 0 || row.defectiveQuantity > 0)
      .sort((a, b) => {
        const nameOrder = a.fabricName.localeCompare(b.fabricName, "tr", { sensitivity: "base" });
        if (nameOrder !== 0) return nameOrder;
        return a.color.localeCompare(b.color, "tr", { sensitivity: "base" });
      })
      .map((row, index) => ({
        ...row,
        id: index + 1,
      }));

    return res.status(200).json(result);
  } catch (error) {
    console.error("Stock calculation error:", error);
    return res.status(500).json({ error: "Stock calculation failed" });
  }
}
