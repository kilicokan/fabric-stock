import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";

type WarehousePayload = {
  id?: number | string;
  code?: string;
  name?: string;
  description?: string | null;
  isActive?: boolean;
};

type WarehouseRow = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type WarehouseDelegate = {
  findMany: (...args: unknown[]) => Promise<unknown[]>;
  create: (...args: unknown[]) => Promise<unknown>;
  update: (...args: unknown[]) => Promise<unknown>;
  findUnique: (...args: unknown[]) => Promise<unknown>;
  delete: (...args: unknown[]) => Promise<unknown>;
};

const toId = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeCode = (value: unknown): string =>
  typeof value === "string" ? value.trim().toUpperCase() : "";

const normalizeName = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const normalizeDescription = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isUniqueConstraint = (error: unknown): boolean => {
  if (typeof error !== "object" || !error) return false;

  const code = "code" in error ? String((error as { code?: unknown }).code) : "";
  if (code === "P2002") return true;

  const metaCode =
    "meta" in error
      ? String(((error as { meta?: { code?: unknown } }).meta?.code as unknown) || "")
      : "";
  if (metaCode === "23505") return true;

  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return message.includes("duplicate key value") || message.includes("unique constraint");
};

const getErrorCode = (error: unknown): string => {
  if (typeof error !== "object" || !error || !("code" in error)) return "";
  return String((error as { code?: unknown }).code || "");
};

const isWarehouseStorageCompatibilityError = (error: unknown): boolean => {
  const code = getErrorCode(error);
  if (code === "P2021" || code === "P2022") return true;

  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (!message) return false;

  if (message.includes("table `public.warehouse` does not exist")) return true;
  if (message.includes("relation \"warehouse\" does not exist")) return true;
  if (message.includes("unknown field") && message.includes("warehouse")) return true;

  return false;
};

const getWarehouseDelegate = (): WarehouseDelegate | null => {
  const candidate = (prisma as unknown as { warehouse?: unknown }).warehouse;
  if (!candidate || typeof candidate !== "object") return null;
  return candidate as WarehouseDelegate;
};

async function ensureLegacyWarehouseTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Warehouse" (
      "id" SERIAL PRIMARY KEY,
      "code" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Warehouse_code_key"
    ON "Warehouse"("code")
  `);
}

async function listLegacyWarehouses(includeSummary: boolean): Promise<unknown[]> {
  await ensureLegacyWarehouseTable();

  const rows = await prisma.$queryRaw<WarehouseRow[]>`
    SELECT "id", "code", "name", "description", "isActive", "createdAt", "updatedAt"
    FROM "Warehouse"
    ORDER BY "isActive" DESC, "code" ASC
  `;

  if (!includeSummary) {
    return rows;
  }

  const fabricSummary = await prisma.$queryRaw<
    Array<{ depot: string | null; fabricCount: bigint | number; fabricStockTotal: number | null }>
  >`
    SELECT
      TRIM(COALESCE("depot", '')) AS "depot",
      COUNT(*) AS "fabricCount",
      COALESCE(SUM("stockQuantity"), 0) AS "fabricStockTotal"
    FROM "Fabric"
    GROUP BY 1
  `;

  const summaryByDepot = new Map<string, { fabrics: number; fabricStockTotal: number }>();
  fabricSummary.forEach((entry) => {
    const key = String(entry.depot || "").trim().toUpperCase();
    if (!key) return;
    summaryByDepot.set(key, {
      fabrics: toNumber(entry.fabricCount),
      fabricStockTotal: toNumber(entry.fabricStockTotal || 0),
    });
  });

  return rows.map((row) => {
    const summary = summaryByDepot.get(row.code.trim().toUpperCase()) || {
      fabrics: 0,
      fabricStockTotal: 0,
    };

    return {
      ...row,
      _count: {
        fabrics: summary.fabrics,
        accessories: 0,
        products: 0,
      },
      fabricStockTotal: summary.fabricStockTotal,
      accessoryStockTotal: 0,
    };
  });
}

async function createLegacyWarehouse(payload: WarehousePayload): Promise<WarehouseRow> {
  await ensureLegacyWarehouseTable();
  const code = normalizeCode(payload.code);
  const name = normalizeName(payload.name);

  const created = await prisma.$queryRaw<WarehouseRow[]>`
    INSERT INTO "Warehouse" ("code", "name", "description", "isActive", "createdAt", "updatedAt")
    VALUES (
      ${code},
      ${name},
      ${normalizeDescription(payload.description)},
      ${typeof payload.isActive === "boolean" ? payload.isActive : true},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    RETURNING "id", "code", "name", "description", "isActive", "createdAt", "updatedAt"
  `;

  return created[0];
}

async function updateLegacyWarehouse(payload: WarehousePayload): Promise<WarehouseRow | null> {
  await ensureLegacyWarehouseTable();

  const id = toId(payload.id);
  if (!id) return null;

  const existingRows = await prisma.$queryRaw<WarehouseRow[]>`
    SELECT "id", "code", "name", "description", "isActive", "createdAt", "updatedAt"
    FROM "Warehouse"
    WHERE "id" = ${id}
    LIMIT 1
  `;

  const existing = existingRows[0];
  if (!existing) return null;

  const nextCode = normalizeCode(payload.code);
  if (nextCode && nextCode !== existing.code) {
    await prisma.$executeRaw`
      UPDATE "Fabric"
      SET "depot" = ${nextCode}
      WHERE TRIM(COALESCE("depot", '')) = ${existing.code}
    `;
  }

  const updated = await prisma.$queryRaw<WarehouseRow[]>`
    UPDATE "Warehouse"
    SET
      "code" = ${nextCode},
      "name" = ${normalizeName(payload.name)},
      "description" = ${normalizeDescription(payload.description)},
      "isActive" = ${typeof payload.isActive === "boolean" ? payload.isActive : true},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
    RETURNING "id", "code", "name", "description", "isActive", "createdAt", "updatedAt"
  `;

  return updated[0] || null;
}

async function deleteLegacyWarehouse(id: number): Promise<{ ok: boolean; reason?: "not_found" | "has_relations" }> {
  await ensureLegacyWarehouseTable();

  const rows = await prisma.$queryRaw<Array<{ id: number; code: string }>>`
    SELECT "id", "code"
    FROM "Warehouse"
    WHERE "id" = ${id}
    LIMIT 1
  `;

  const warehouse = rows[0];
  if (!warehouse) {
    return { ok: false, reason: "not_found" };
  }

  const relationRows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
    SELECT COUNT(*) AS "count"
    FROM "Fabric"
    WHERE TRIM(COALESCE("depot", '')) = ${warehouse.code}
  `;

  const relationCount = toNumber(relationRows[0]?.count || 0);
  if (relationCount > 0) {
    return { ok: false, reason: "has_relations" };
  }

  await prisma.$executeRaw`
    DELETE FROM "Warehouse"
    WHERE "id" = ${id}
  `;

  return { ok: true };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiAuth(req, res, {
    requireLicense: true,
    feature: "stock",
  });
  if (!auth) return;

  try {
    const warehouseDelegate = getWarehouseDelegate();

    if (req.method === "GET") {
      const includeSummary = req.query.withSummary !== "false";

      if (!warehouseDelegate) {
        const legacyPayload = await listLegacyWarehouses(includeSummary);
        return res.status(200).json(legacyPayload);
      }

      let warehouses: Array<{
        id: number;
        code: string;
        name: string;
        description: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        _count?: { fabrics: number; accessories: number; products: number };
        fabrics?: Array<{ stockQuantity: number }>;
        accessories?: Array<{ stockQuantity: number }>;
      }>;
      try {
        warehouses = (await warehouseDelegate.findMany({
          orderBy: [{ isActive: "desc" }, { code: "asc" }],
          include: includeSummary
            ? {
                _count: {
                  select: {
                    fabrics: true,
                    accessories: true,
                    products: true,
                  },
                },
                fabrics: {
                  select: {
                    stockQuantity: true,
                  },
                },
                accessories: {
                  select: {
                    stockQuantity: true,
                  },
                },
              }
            : undefined,
        })) as Array<{
          id: number;
          code: string;
          name: string;
          description: string | null;
          isActive: boolean;
          createdAt: Date;
          updatedAt: Date;
          _count?: { fabrics: number; accessories: number; products: number };
          fabrics?: Array<{ stockQuantity: number }>;
          accessories?: Array<{ stockQuantity: number }>;
        }>;
      } catch (error) {
        if (!isWarehouseStorageCompatibilityError(error)) {
          throw error;
        }
        const legacyPayload = await listLegacyWarehouses(includeSummary);
        return res.status(200).json(legacyPayload);
      }

      const payload = warehouses.map((warehouse) => {
        if (!includeSummary) return warehouse;

        const fabricStockTotal = (warehouse.fabrics || []).reduce(
          (sum, row) => sum + (Number(row.stockQuantity) || 0),
          0
        );
        const accessoryStockTotal = (warehouse.accessories || []).reduce(
          (sum, row) => sum + (Number(row.stockQuantity) || 0),
          0
        );

        return {
          id: warehouse.id,
          code: warehouse.code,
          name: warehouse.name,
          description: warehouse.description,
          isActive: warehouse.isActive,
          createdAt: warehouse.createdAt,
          updatedAt: warehouse.updatedAt,
          _count: warehouse._count || {
            fabrics: 0,
            accessories: 0,
            products: 0,
          },
          fabricStockTotal,
          accessoryStockTotal,
        };
      });

      return res.status(200).json(payload);
    }

    if (req.method === "POST") {
      const payload = req.body as WarehousePayload;
      const code = normalizeCode(payload.code);
      const name = normalizeName(payload.name);

      if (!code || !name) {
        return res.status(400).json({ message: "Depo kodu ve depo adi zorunludur." });
      }

      if (!warehouseDelegate) {
        const createdLegacy = await createLegacyWarehouse(payload);
        return res.status(201).json(createdLegacy);
      }

      let created: unknown;
      try {
        created = await warehouseDelegate.create({
          data: {
            code,
            name,
            description: normalizeDescription(payload.description),
            isActive: typeof payload.isActive === "boolean" ? payload.isActive : true,
          },
        });
      } catch (error) {
        if (!isWarehouseStorageCompatibilityError(error)) {
          throw error;
        }
        const createdLegacy = await createLegacyWarehouse(payload);
        return res.status(201).json(createdLegacy);
      }

      return res.status(201).json(created);
    }

    if (req.method === "PUT") {
      const payload = req.body as WarehousePayload;
      const id = toId(payload.id);
      const code = normalizeCode(payload.code);
      const name = normalizeName(payload.name);

      if (!id || !code || !name) {
        return res.status(400).json({ message: "ID, depo kodu ve depo adi zorunludur." });
      }

      if (!warehouseDelegate) {
        const updatedLegacy = await updateLegacyWarehouse(payload);
        if (!updatedLegacy) {
          return res.status(404).json({ message: "Depo bulunamadi." });
        }
        return res.status(200).json(updatedLegacy);
      }

      let updated: unknown;
      try {
        updated = await warehouseDelegate.update({
          where: { id },
          data: {
            code,
            name,
            description: normalizeDescription(payload.description),
            isActive: typeof payload.isActive === "boolean" ? payload.isActive : true,
          },
        });
      } catch (error) {
        if (!isWarehouseStorageCompatibilityError(error)) {
          throw error;
        }
        const updatedLegacy = await updateLegacyWarehouse(payload);
        if (!updatedLegacy) {
          return res.status(404).json({ message: "Depo bulunamadi." });
        }
        return res.status(200).json(updatedLegacy);
      }

      return res.status(200).json(updated);
    }

    if (req.method === "DELETE") {
      const payload = req.body as WarehousePayload;
      const id = toId(payload.id);
      if (!id) {
        return res.status(400).json({ message: "ID zorunludur." });
      }

      if (!warehouseDelegate) {
        const deleted = await deleteLegacyWarehouse(id);
        if (!deleted.ok && deleted.reason === "not_found") {
          return res.status(404).json({ message: "Depo bulunamadi." });
        }
        if (!deleted.ok && deleted.reason === "has_relations") {
          return res.status(400).json({
            message: "Bu depoya bagli kayitlar oldugu icin silinemez. Once baglantilari kaldirin.",
          });
        }
        return res.status(200).json({ message: "Depo silindi." });
      }

      let warehouse: {
        _count: { fabrics: number; accessories: number; products: number };
      } | null;
      try {
        warehouse = (await warehouseDelegate.findUnique({
          where: { id },
          include: {
            _count: {
              select: {
                fabrics: true,
                accessories: true,
                products: true,
              },
            },
          },
        })) as {
          _count: { fabrics: number; accessories: number; products: number };
        } | null;
      } catch (error) {
        if (!isWarehouseStorageCompatibilityError(error)) {
          throw error;
        }
        const deleted = await deleteLegacyWarehouse(id);
        if (!deleted.ok && deleted.reason === "not_found") {
          return res.status(404).json({ message: "Depo bulunamadi." });
        }
        if (!deleted.ok && deleted.reason === "has_relations") {
          return res.status(400).json({
            message: "Bu depoya bagli kayitlar oldugu icin silinemez. Once baglantilari kaldirin.",
          });
        }
        return res.status(200).json({ message: "Depo silindi." });
      }

      if (!warehouse) {
        return res.status(404).json({ message: "Depo bulunamadi." });
      }

      const relationCount = warehouse._count.fabrics + warehouse._count.accessories + warehouse._count.products;
      if (relationCount > 0) {
        return res.status(400).json({
          message: "Bu depoya bagli kayitlar oldugu icin silinemez. Once baglantilari kaldirin.",
        });
      }

      await warehouseDelegate.delete({ where: { id } });
      return res.status(200).json({ message: "Depo silindi." });
    }

    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    return res.status(405).json({ message: `Method ${req.method} not allowed` });
  } catch (error: unknown) {
    console.error("Warehouse API error:", error);
    if (isUniqueConstraint(error)) {
      return res.status(409).json({ message: "Depo kodu benzersiz olmalidir." });
    }
    return res.status(500).json({
      message: "Sunucu hatasi",
      error: error instanceof Error ? error.message : "Bilinmeyen hata",
    });
  }
}
