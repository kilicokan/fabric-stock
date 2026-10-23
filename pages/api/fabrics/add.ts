import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";
import { withErrorHandler } from "@/lib/middleware/withErrorHandler";

const isWarehouseCompatibilityError = (error: unknown): boolean => {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes("unknown field `warehouse`") ||
    message.includes("unknown argument `warehouseid`") ||
    message.includes("cannot read properties of undefined") ||
    message.includes("does not exist")
  );
};

type WarehouseDelegate = {
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

const getWarehouseDelegate = (): WarehouseDelegate | null => {
  const candidate = (prisma as unknown as { warehouse?: unknown }).warehouse;
  if (!candidate || typeof candidate !== "object") return null;
  return candidate as WarehouseDelegate;
};

async function resolveWarehouse(
  warehouseId: unknown,
  depot: unknown
): Promise<{ warehouseId: number | null; depot: string | null }> {
  const parsedWarehouseId =
    warehouseId === null || warehouseId === undefined || warehouseId === ""
      ? null
      : Number(warehouseId);

  const normalizedDepot = typeof depot === "string" && depot.trim() ? depot.trim() : null;
  const warehouseDelegate = getWarehouseDelegate();

  if (parsedWarehouseId !== null && warehouseDelegate) {
    if (!Number.isInteger(parsedWarehouseId) || parsedWarehouseId <= 0) {
      throw new Error("Gecersiz depo secimi.");
    }

    const warehouse = await warehouseDelegate.findUnique({
      where: { id: parsedWarehouseId },
      select: { id: true, code: true },
    });

    if (!warehouse) {
      throw new Error("Secilen depo bulunamadi.");
    }

    return { warehouseId: warehouse.id, depot: warehouse.code };
  }

  if (normalizedDepot && warehouseDelegate) {
    const warehouse = await warehouseDelegate.findFirst({
      where: {
        OR: [
          { code: normalizedDepot.toUpperCase() },
          { name: { equals: normalizedDepot, mode: "insensitive" } },
        ],
      },
      select: { id: true, code: true },
    });

    if (warehouse) {
      return { warehouseId: warehouse.id, depot: warehouse.code };
    }
  }

  return { warehouseId: null, depot: normalizedDepot };
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiAuth(req, res, {
    requireLicense: true,
    feature: 'stock',
  });
  if (!auth) return;

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { code, name, property, unit, stockQuantity, width, length, depot, warehouseId, averageGrammage } = req.body;

    const resolvedWarehouse = await resolveWarehouse(warehouseId, depot);

    const baseData = {
      code,
      name,
      property,
      unit,
      stockQuantity: parseFloat(stockQuantity || 0),
      width: width ? parseFloat(width) : null,
      length: length ? parseFloat(length) : null,
      depot: resolvedWarehouse.depot,
      averageGrammage: averageGrammage === '' || averageGrammage == null ? null : parseFloat(averageGrammage),
    };

    let fabric;
    try {
      fabric = await prisma.fabric.create({
        data:
          resolvedWarehouse.warehouseId === null
            ? baseData
            : {
                ...baseData,
                warehouseId: resolvedWarehouse.warehouseId,
              },
      });
    } catch (error) {
      if (!isWarehouseCompatibilityError(error)) {
        throw error;
      }
      fabric = await prisma.fabric.create({
        data: baseData,
      });
    }

    return res.status(200).json(fabric);
  } catch (error: unknown) {
    console.error("Fabric create error:", error);
    return res.status(500).json({
      message: "Error creating fabric",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export default withErrorHandler(handler);
