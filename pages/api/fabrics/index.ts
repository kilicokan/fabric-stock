import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";
import { withErrorHandler } from "@/lib/middleware/withErrorHandler";
import { withValidation } from "@/lib/middleware/withValidation";
import { z } from "zod";

const createFabricSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1, "Kumaş adı gerekli"),
  property: z.string().optional(),
  width: z.coerce.number().optional(),
  length: z.coerce.number().optional(),
  depot: z.string().optional(),
  warehouseId: z.coerce.number().optional(),
  unit: z.string().optional(),
  stockQuantity: z.coerce.number().optional(),
  averageGrammage: z.coerce.number().optional(),
});

const updateFabricSchema = z.object({
  id: z.coerce.number().min(1, "Geçersiz ID"),
  code: z.string().optional(),
  name: z.string().min(1, "Kumaş adı gerekli"),
  property: z.string().optional(),
  width: z.coerce.number().optional(),
  length: z.coerce.number().optional(),
  depot: z.string().optional(),
  warehouseId: z.coerce.number().optional(),
  unit: z.string().optional(),
  stockQuantity: z.coerce.number().optional(),
  averageGrammage: z.coerce.number().optional(),
});

function isTransientDbError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  return code === "P2037" || message.toLowerCase().includes("too many clients");
}

function isSchemaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  return code === "P2021" || code === "P2022" || message.includes("does not exist");
}

function isWarehouseCompatibilityError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes("unknown field `warehouse`") ||
    message.includes("unknown argument `warehouseid`") ||
    message.includes("unknown argument `warehouse`") ||
    message.includes("cannot read properties of undefined") ||
    message.includes("does not exist")
  );
}

type WarehouseClientDelegate = {
  findUnique: (args: { where: { id: number }; select: { id: true; code: true } }) => Promise<{
    id: number;
    code: string;
  } | null>;
  findFirst: (args: {
    where: {
      OR: Array<{ code: string } | { name: { equals: string; mode: "insensitive" } }>;
    };
    select: { id: true; code: true };
  }) => Promise<{
    id: number;
    code: string;
  } | null>;
};

function getWarehouseDelegate(): WarehouseClientDelegate | null {
  const candidate = (prisma as unknown as { warehouse?: unknown }).warehouse;
  if (!candidate || typeof candidate !== "object") {
    return null;
  }
  return candidate as WarehouseClientDelegate;
}

type FabricListRow = {
  id: number;
  code?: string | null;
  name: string;
  property?: string | null;
  width?: number | null;
  length?: number | null;
  depot: string | null;
  unit: string | null;
  stockQuantity?: number;
  defectiveQuantity?: number;
  createdAt: Date;
  warehouse?: {
    id: number;
    code: string;
    name: string;
  } | null;
};

function normalizeColorTokens(rawColor: string | null | undefined): string[] {
  if (typeof rawColor !== "string") return [];
  return rawColor
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function makeFabricNameKey(name: string): string {
  return name.trim().toLocaleLowerCase("tr-TR");
}

function isKilogramUnit(unitType: string | null | undefined): boolean {
  const normalized = typeof unitType === "string" ? unitType.trim().toLocaleLowerCase("tr-TR") : "";
  return !normalized.startsWith("m");
}

type FabricEntryGroupByClient = {
  groupBy: (args: {
    by: ["fabricId"];
    _sum: { quantityKg: true };
  }) => Promise<Array<{ fabricId: number; _sum: { quantityKg: number | null } }>>;
};

type FabricExitGroupByClient = {
  groupBy: (args: {
    by: ["fabricType"];
    _sum: { productWeightKg: true };
    where: { fabricType: { not: null } };
  }) => Promise<Array<{ fabricType: string | null; _sum: { productWeightKg: number | null } }>>;
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiAuth(req, res, {
    requireLicense: true,
    feature: "stock",
  });
  if (!auth) return;

  if (req.method === "POST") {
    try {
      const { code, name, property, width, length, depot, warehouseId, unit, stockQuantity, averageGrammage } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Kumas adi gerekli." });
      }

      const normalizedDepot =
        typeof depot === "string" && depot.trim().length > 0 ? depot.trim() : null;
      const parsedWarehouseId =
        warehouseId === null || warehouseId === undefined || warehouseId === ""
          ? null
          : Number(warehouseId);

      let resolvedWarehouseId: number | null = null;
      let resolvedDepot: string | null = normalizedDepot;

      const warehouseDelegate = getWarehouseDelegate();

      if (parsedWarehouseId !== null && warehouseDelegate) {
        if (!Number.isInteger(parsedWarehouseId) || parsedWarehouseId <= 0) {
          return res.status(400).json({ message: "Gecersiz depo secimi." });
        }

        const warehouse = await warehouseDelegate.findUnique({
          where: { id: parsedWarehouseId },
          select: { id: true, code: true },
        });

        if (!warehouse) {
          return res.status(400).json({ message: "Secilen depo bulunamadi." });
        }

        resolvedWarehouseId = warehouse.id;
        resolvedDepot = warehouse.code;
      } else if (normalizedDepot && warehouseDelegate) {
        const matchedWarehouse = await warehouseDelegate.findFirst({
          where: {
            OR: [
              { code: normalizedDepot.toUpperCase() },
              { name: { equals: normalizedDepot, mode: "insensitive" } },
            ],
          },
          select: { id: true, code: true },
        });

        if (matchedWarehouse) {
          resolvedWarehouseId = matchedWarehouse.id;
          resolvedDepot = matchedWarehouse.code;
        }
      }

      const baseData = {
        code,
        name,
        property,
        width: width ? parseFloat(width) : null,
        length: length ? parseFloat(length) : null,
        depot: resolvedDepot,
        unit,
        stockQuantity: stockQuantity ? parseFloat(stockQuantity) : 0,
        averageGrammage: averageGrammage === '' || averageGrammage == null ? null : parseFloat(averageGrammage),
      };

      const safeFabricSelect = {
        id: true,
        code: true,
        name: true,
        property: true,
        width: true,
        length: true,
        depot: true,
        unit: true,
        stockQuantity: true,
         averageGrammage: true,
        createdAt: true,
      } as const;

      let fabric;
      try {
        fabric = await prisma.fabric.create({
          data:
            resolvedWarehouseId === null
              ? baseData
              : {
                  ...baseData,
                  warehouseId: resolvedWarehouseId,
                },
          select: safeFabricSelect,
        });
      } catch (createError) {
        if (!isWarehouseCompatibilityError(createError)) {
          throw createError;
        }
        fabric = await prisma.fabric.create({
          data: baseData,
          select: safeFabricSelect,
        });
      }

      return res.status(201).json({ fabric });
    } catch (error: unknown) {
      console.error("Kumas ekleme hatasi:", error);
      return res.status(500).json({
        message: "Kumas eklenemedi",
        error: error instanceof Error ? error.message : "Bilinmeyen hata",
      });
    }
  }

  if (req.method === "PUT") {
    try {
      const { id, code, name, property, width, length, depot, warehouseId, unit, stockQuantity, averageGrammage } = req.body;
      const fabricId = Number(id);
      if (!Number.isInteger(fabricId) || fabricId <= 0 || !name) {
        return res.status(400).json({ message: "Kumaş ID ve adı gereklidir." });
      }

      const fabric = await prisma.fabric.update({
        where: { id: fabricId },
        data: {
          code: code || null,
          name,
          property: property || null,
          width: width ? Number(width) : null,
          length: length ? Number(length) : null,
          depot: depot || null,
          warehouseId: warehouseId ? Number(warehouseId) : null,
          unit: unit || null,
          stockQuantity: stockQuantity ? Number(stockQuantity) : 0,
          averageGrammage: averageGrammage === '' || averageGrammage == null ? null : Number(averageGrammage),
        },
      });
      return res.status(200).json({ fabric });
    } catch (error) {
      console.error("Kumaş güncelleme hatası:", error);
      return res.status(500).json({ message: "Kumaş güncellenemedi." });
    }
  }

  if (req.method === "GET") {
    try {
      let fabrics: FabricListRow[] = [];
      const safeFabricSelect = {
        id: true,
        code: true,
        name: true,
        property: true,
        width: true,
        length: true,
        depot: true,
        unit: true,
        stockQuantity: true,
        defectiveQuantity: true,
        averageGrammage: true,
        createdAt: true,
      } as const;
      try {
        fabrics = (await prisma.fabric.findMany({
          orderBy: { createdAt: "desc" },
          include: {
            warehouse: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        })) as unknown as FabricListRow[];
      } catch (findError) {
        if (!isWarehouseCompatibilityError(findError)) {
          throw findError;
        }
        fabrics = (await prisma.fabric.findMany({
          orderBy: { createdAt: "desc" },
          select: safeFabricSelect,
        })) as unknown as FabricListRow[];
      }

      let entrySums: Array<{ fabricId: number; _sum: { quantityKg: number | null } }> = [];
      let exitSums: Array<{ fabricType: string | null; _sum: { productWeightKg: number | null } }> = [];
      let entryColors: Array<{ fabricId: number; colorName: string }> = [];
      let exitColors: Array<{ fabricType: string; colorName: string }> = [];
      let documentRows: Array<{
        fabricId: number | null;
        quantity: number;
        unitType: string | null;
        colorName: string;
      }> = [];

      try {
        entrySums = await (prisma.fabricEntry as unknown as FabricEntryGroupByClient).groupBy({
          by: ["fabricId"],
          _sum: { quantityKg: true },
        });
      } catch (error) {
        if (!isTransientDbError(error) && !isSchemaError(error)) {
          throw error;
        }
      }

      try {
        exitSums = await (prisma.fabricExit as unknown as FabricExitGroupByClient).groupBy({
          by: ["fabricType"],
          _sum: { productWeightKg: true },
          where: { fabricType: { not: null } },
        });
      } catch (error) {
        if (!isTransientDbError(error) && !isSchemaError(error)) {
          throw error;
        }
      }

      try {
        const entryColorRows = await prisma.fabricEntry.findMany({
          select: {
            fabricId: true,
            color: {
              select: {
                name: true,
              },
            },
          },
        });

        entryColors = entryColorRows
          .map((row) => ({
            fabricId: row.fabricId,
            colorName: row.color?.name?.trim() || "",
          }))
          .filter((row) => row.colorName.length > 0);
      } catch (error) {
        if (!isTransientDbError(error) && !isSchemaError(error)) {
          throw error;
        }
      }

      try {
        const exitColorRows = await prisma.fabricExit.findMany({
          select: {
            fabricType: true,
            color: true,
          },
          where: {
            fabricType: { not: null },
            color: { not: null },
          },
        });

        exitColors = exitColorRows.flatMap((row) => {
          const fabricType = (row.fabricType || "").trim();
          if (!fabricType) return [];
          return normalizeColorTokens(row.color).map((colorName) => ({ fabricType, colorName }));
        });
      } catch (error) {
        if (!isTransientDbError(error) && !isSchemaError(error)) {
          throw error;
        }
      }

      try {
        const fabricDocumentRows = await prisma.$queryRaw<
          Array<{
            fabricId: number | null;
            quantity: number | null;
            unitType: string | null;
            colorName: string | null;
          }>
        >(Prisma.sql`
          SELECT
            fd."fabricId",
            fd."quantity",
            fd."unitType",
            c."name" AS "colorName"
          FROM "FabricDocument" fd
          LEFT JOIN "Color" c ON c."id" = fd."colorId"
          WHERE fd."fabricId" IS NOT NULL
        `);

        documentRows = fabricDocumentRows.map((row) => ({
          fabricId: row.fabricId ? Number(row.fabricId) : null,
          quantity: Number(row.quantity) || 0,
          unitType: row.unitType,
          colorName: (row.colorName || "").trim(),
        }));
      } catch (error) {
        if (!isTransientDbError(error) && !isSchemaError(error)) {
          throw error;
        }
      }

      const totalInByFabricId = new Map<number, number>(
        entrySums.map((row) => [row.fabricId, row._sum.quantityKg || 0])
      );
      documentRows.forEach((row) => {
        if (!row.fabricId || !isKilogramUnit(row.unitType)) return;
        const quantity = Number(row.quantity) || 0;
        if (quantity <= 0) return;
        totalInByFabricId.set(row.fabricId, Number(totalInByFabricId.get(row.fabricId) || 0) + quantity);
      });

      const totalOutByFabricName = new Map<string, number>(
        exitSums
          .filter((row) => typeof row.fabricType === "string")
          .map((row) => [String(row.fabricType), row._sum.productWeightKg || 0])
      );

      const colorSetByFabricId = new Map<number, Set<string>>();
      entryColors.forEach((row) => {
        if (!colorSetByFabricId.has(row.fabricId)) {
          colorSetByFabricId.set(row.fabricId, new Set<string>());
        }
        colorSetByFabricId.get(row.fabricId)?.add(row.colorName);
      });
      documentRows.forEach((row) => {
        if (!row.fabricId || !isKilogramUnit(row.unitType) || !row.colorName) return;
        if (!colorSetByFabricId.has(row.fabricId)) {
          colorSetByFabricId.set(row.fabricId, new Set<string>());
        }
        colorSetByFabricId.get(row.fabricId)?.add(row.colorName);
      });

      const fabricIdByName = new Map<string, number>();
      fabrics.forEach((fabric) => {
        fabricIdByName.set(makeFabricNameKey(fabric.name), fabric.id);
      });

      exitColors.forEach((row) => {
        const fabricId = fabricIdByName.get(makeFabricNameKey(row.fabricType));
        if (!fabricId) return;
        if (!colorSetByFabricId.has(fabricId)) {
          colorSetByFabricId.set(fabricId, new Set<string>());
        }
        colorSetByFabricId.get(fabricId)?.add(row.colorName);
      });

      const colorByFabricId = new Map<number, string>();
      colorSetByFabricId.forEach((colorSet, fabricId) => {
        colorByFabricId.set(
          fabricId,
          Array.from(colorSet).sort((a, b) => a.localeCompare(b, "tr")).join(", ")
        );
      });

      const fabricsWithStock = fabrics.map((fabric) => {
        const totalIn = totalInByFabricId.get(fabric.id) || 0;
        const totalOut = totalOutByFabricName.get(fabric.name) || 0;
        const derivedColor = colorByFabricId.get(fabric.id);

        return {
          ...fabric,
          color: derivedColor || null,
          stockQuantity: totalIn - totalOut,
          defectiveQuantity: fabric.defectiveQuantity || 0,
          totalIn,
          totalOut,
        };
      });

      return res.status(200).json(fabricsWithStock);
    } catch (error: unknown) {
      console.error("Kumas listeleme hatasi:", error);
      if (isTransientDbError(error) || isSchemaError(error)) {
        return res.status(200).json([]);
      }
      return res.status(500).json({
        message: "Kumaslar alinamadi",
        error: error instanceof Error ? error.message : "Bilinmeyen hata",
      });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ message: `Method ${req.method} not allowed` });
}

export default withErrorHandler(
  withValidation({
    POST: createFabricSchema,
    PUT: updateFabricSchema,
  })(handler)
);
