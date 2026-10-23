import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";

type ErrorLike = {
  code?: unknown;
  message?: string;
};

const getErrorMessage = (error: unknown): string => {
  if (typeof error === "object" && error !== null) {
    const candidate = error as ErrorLike;
    if (typeof candidate.message === "string") return candidate.message;
  }
  return "Bilinmeyen hata";
};

const getErrorCode = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String((error as ErrorLike).code || "");
  }
  return "";
};

const isMissingColumnError = (error: unknown): boolean => {
  const code = getErrorCode(error);
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return code === "P2022" || message.includes("does not exist");
};

const isTransientDbError = (error: unknown): boolean => {
  const code = getErrorCode(error);
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return code === "P2037" || message.includes("too many clients");
};

const isWarehouseCompatibilityError = (error: unknown): boolean => {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes("unknown field `warehouse`") ||
    message.includes("unknown argument `warehouseid`") ||
    message.includes("cannot read properties of undefined") ||
    message.includes("does not exist")
  );
};

type WarehouseClientDelegate = {
  findUnique: (args: { where: { id: number }; select: { id: true } }) => Promise<{ id: number } | null>;
};

const getWarehouseDelegate = (): WarehouseClientDelegate | null => {
  const candidate = (prisma as unknown as { warehouse?: unknown }).warehouse;
  if (!candidate || typeof candidate !== "object") {
    return null;
  }
  return candidate as WarehouseClientDelegate;
};

const parseWarehouseId = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return Number.NaN;
  return parsed;
};

let hasAccessoryWarehouseColumnCache: boolean | null = null;

async function hasAccessoryWarehouseColumn(): Promise<boolean> {
  if (hasAccessoryWarehouseColumnCache !== null) {
    return hasAccessoryWarehouseColumnCache;
  }

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'Accessory' AND column_name = 'warehouseId'"
    );
    hasAccessoryWarehouseColumnCache = rows.length > 0;
  } catch {
    hasAccessoryWarehouseColumnCache = false;
  }

  return hasAccessoryWarehouseColumnCache;
}

async function resolveWarehouseId(value: unknown): Promise<number | null> {
  const parsedId = parseWarehouseId(value);
  if (parsedId === null) return null;
  if (Number.isNaN(parsedId)) throw new Error("Gecersiz depo secimi.");

  const warehouseDelegate = getWarehouseDelegate();
  if (!warehouseDelegate) {
    return null;
  }

  const warehouse = await warehouseDelegate.findUnique({
    where: { id: parsedId },
    select: { id: true },
  });

  if (!warehouse) {
    throw new Error("Secilen depo bulunamadi.");
  }

  return warehouse.id;
}

const accessorySelectWithoutWarehouse = {
  id: true,
  code: true,
  name: true,
  unit: true,
  stockQuantity: true,
  createdAt: true,
  updatedAt: true,
} as const;

const accessorySelectWithWarehouse = {
  ...accessorySelectWithoutWarehouse,
  warehouse: {
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
    },
  },
} as const;

const accessorySelectCore = {
  id: true,
  code: true,
  name: true,
} as const;

async function listAccessoriesSafe() {
  const canUseWarehouse = await hasAccessoryWarehouseColumn();

  try {
    return await prisma.accessory.findMany({
      orderBy: { name: "asc" },
      select: canUseWarehouse ? accessorySelectWithWarehouse : accessorySelectWithoutWarehouse,
    });
  } catch (error) {
    if (isWarehouseCompatibilityError(error) || isMissingColumnError(error)) {
      try {
        return await prisma.accessory.findMany({
          orderBy: { name: "asc" },
          select: accessorySelectWithoutWarehouse,
        });
      } catch (innerError) {
        if (!isMissingColumnError(innerError)) throw innerError;
        return prisma.accessory.findMany({
          orderBy: { name: "asc" },
          select: accessorySelectCore,
        });
      }
    }
    throw error;
  }
}

async function getAccessoryByIdSafe(id: number) {
  const canUseWarehouse = await hasAccessoryWarehouseColumn();

  try {
    return await prisma.accessory.findUnique({
      where: { id },
      select: canUseWarehouse ? accessorySelectWithWarehouse : accessorySelectWithoutWarehouse,
    });
  } catch (error) {
    if (isWarehouseCompatibilityError(error) || isMissingColumnError(error)) {
      try {
        return await prisma.accessory.findUnique({
          where: { id },
          select: accessorySelectWithoutWarehouse,
        });
      } catch (innerError) {
        if (!isMissingColumnError(innerError)) throw innerError;
        return prisma.accessory.findUnique({
          where: { id },
          select: accessorySelectCore,
        });
      }
    }
    throw error;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      const accessories = await listAccessoriesSafe();
      return res.status(200).json(accessories);
    }

    if (req.method === "POST") {
      const { code, name, unit, stockQuantity, warehouseId } = req.body;

      if (!name || !unit) {
        return res.status(400).json({ message: "Aksesuar adi ve birim zorunludur." });
      }

      const canUseWarehouse = await hasAccessoryWarehouseColumn();
      const resolvedWarehouseId = canUseWarehouse ? await resolveWarehouseId(warehouseId) : null;

      const baseData = {
        code: code?.trim() || null,
        name: name.trim(),
        unit: unit.trim().toLowerCase(),
        stockQuantity: Number(stockQuantity) || 0,
      };

      let createdId: number;
      try {
        const created = await prisma.accessory.create({
          data:
            resolvedWarehouseId === null
              ? baseData
              : {
                  ...baseData,
                  warehouseId: resolvedWarehouseId,
                },
          select: { id: true },
        });
        createdId = created.id;
      } catch (createError) {
        if (!isWarehouseCompatibilityError(createError) && !isMissingColumnError(createError)) {
          throw createError;
        }
        const created = await prisma.accessory.create({
          data: baseData,
          select: { id: true },
        });
        createdId = created.id;
      }

      const accessory = await getAccessoryByIdSafe(createdId);
      return res.status(201).json(accessory);
    }

    if (req.method === "PUT") {
      const { id, code, name, unit, stockQuantity, warehouseId } = req.body;

      if (!id || !name || !unit) {
        return res.status(400).json({ message: "ID, aksesuar adi ve birim zorunludur." });
      }

      const accessoryId = Number(id);
      if (!Number.isInteger(accessoryId) || accessoryId <= 0) {
        return res.status(400).json({ message: "Gecersiz ID." });
      }

      const canUseWarehouse = await hasAccessoryWarehouseColumn();
      const resolvedWarehouseId = canUseWarehouse ? await resolveWarehouseId(warehouseId) : null;

      const baseData = {
        code: code?.trim() || null,
        name: name.trim(),
        unit: unit.trim().toLowerCase(),
        stockQuantity: Number(stockQuantity) || 0,
      };

      let updatedId: number;
      try {
        const updated = await prisma.accessory.update({
          where: { id: accessoryId },
          data:
            resolvedWarehouseId === null
              ? baseData
              : {
                  ...baseData,
                  warehouseId: resolvedWarehouseId,
                },
          select: { id: true },
        });
        updatedId = updated.id;
      } catch (updateError) {
        if (!isWarehouseCompatibilityError(updateError) && !isMissingColumnError(updateError)) {
          throw updateError;
        }
        const updated = await prisma.accessory.update({
          where: { id: accessoryId },
          data: baseData,
          select: { id: true },
        });
        updatedId = updated.id;
      }

      const accessory = await getAccessoryByIdSafe(updatedId);
      return res.status(200).json(accessory);
    }

    if (req.method === "DELETE") {
      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ message: "ID zorunludur." });
      }

      await prisma.accessory.delete({
        where: { id: Number(id) },
        select: { id: true },
      });

      return res.status(200).json({ message: "Aksesuar silindi." });
    }

    return res.status(405).json({ message: "Method not allowed" });
  } catch (error: unknown) {
    console.error("Accessory API error:", error);
    if (req.method === "GET" && (isTransientDbError(error) || isMissingColumnError(error) || isWarehouseCompatibilityError(error))) {
      return res.status(200).json([]);
    }
    return res.status(500).json({ message: "Sunucu hatasi", error: getErrorMessage(error) });
  }
}
