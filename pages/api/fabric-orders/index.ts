import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import prisma from "@/utils/db";

type FabricOrderResponse = {
  id: number;
  orderNumber: number;
  orderDate: string;
  supplierId: number;
  supplierName: string;
  fabricId: number;
  fabricName: string;
  colorId: number;
  colorName: string;
  patternId: number | null;
  patternName: string;
  quantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  unitType: string;
  arrivalDate: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type DbOrderRow = {
  id: number;
  orderNumber: number;
  orderDate: Date;
  supplierId: number;
  supplierName: string;
  fabricId: number;
  fabricName: string;
  colorId: number;
  colorName: string;
  patternId: number | null;
  patternName: string;
  quantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  unitType: string;
  arrivalDate: Date | null;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type QueryClient = Pick<Prisma.TransactionClient, "$queryRaw" | "$executeRaw">;

const ORDER_SELECT_SQL = Prisma.sql`
  SELECT
    fo."id",
    fo."orderNumber",
    fo."orderDate",
    fo."supplierId",
    s."name" AS "supplierName",
    fo."fabricId",
    f."name" AS "fabricName",
    fo."colorId",
    c."name" AS "colorName",
    fo."patternId",
    p."name" AS "patternName",
    fo."quantity",
    COALESCE(fd."receivedQuantity", 0) AS "receivedQuantity",
    GREATEST(fo."quantity" - COALESCE(fd."receivedQuantity", 0), 0) AS "remainingQuantity",
    fo."unitType",
    fo."arrivalDate",
    fo."status",
    fo."notes",
    fo."createdAt",
    fo."updatedAt"
  FROM "FabricOrder" fo
  LEFT JOIN (
    SELECT
      "fabricOrderId",
      COALESCE(SUM("quantity"), 0) AS "receivedQuantity"
    FROM "FabricDocument"
    WHERE "fabricOrderId" IS NOT NULL
GROUP BY "fabricOrderId"
  ) fd ON fd."fabricOrderId" = fo."id"
  INNER JOIN "Supplier" s ON s."id" = fo."supplierId"
  INNER JOIN "Fabric" f ON f."id" = fo."fabricId"
  INNER JOIN "Color" c ON c."id" = fo."colorId"
  LEFT JOIN "FabricPattern" p ON p."id" = fo."patternId"
`;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error";

const toIso = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const mapRow = (row: DbOrderRow): FabricOrderResponse => ({
  id: Number(row.id),
  orderNumber: Number(row.orderNumber),
  orderDate: toIso(row.orderDate) || new Date().toISOString(),
  supplierId: Number(row.supplierId),
  supplierName: String(row.supplierName || ""),
  fabricId: Number(row.fabricId),
  fabricName: String(row.fabricName || ""),
  colorId: Number(row.colorId),
  colorName: String(row.colorName || ""),
  patternId: row.patternId == null ? null : Number(row.patternId),
  patternName: String(row.patternName || ""),
  quantity: Number(row.quantity || 0),
  receivedQuantity: Number(row.receivedQuantity || 0),
  remainingQuantity: Number(row.remainingQuantity || 0),
  unitType: String(row.unitType || ""),
  arrivalDate: toIso(row.arrivalDate),
  status: String(row.status || ""),
  notes: row.notes ? String(row.notes) : null,
  createdAt: toIso(row.createdAt) || new Date().toISOString(),
  updatedAt: toIso(row.updatedAt) || new Date().toISOString(),
});

const parseOptionalDate = (value: unknown): Date | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return NaN;
};

const toNullablePositiveNumber = (value: unknown): number | null => {
  const parsed = toNumber(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const isOrderNumberCollision = (error: unknown): boolean => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  const metaMessage =
    typeof error.meta === "object" && error.meta && "message" in error.meta
      ? String((error.meta as { message?: unknown }).message || "")
      : "";

  return (
    error.code === "P2002" ||
    metaMessage.includes("FabricOrder_orderNumber_key") ||
    metaMessage.toLowerCase().includes("ordernumber")
  );
};

const listOrders = async (client: QueryClient): Promise<FabricOrderResponse[]> => {
  const rows = await client.$queryRaw<DbOrderRow[]>(Prisma.sql`
    ${ORDER_SELECT_SQL}
    ORDER BY fo."orderNumber" DESC, fo."id" DESC
  `);

  return rows.map(mapRow);
};

const getOrderById = async (client: QueryClient, id: number): Promise<FabricOrderResponse | null> => {
  const rows = await client.$queryRaw<DbOrderRow[]>(Prisma.sql`
    ${ORDER_SELECT_SQL}
    WHERE fo."id" = ${id}
    LIMIT 1
  `);

  if (!rows.length) return null;
  return mapRow(rows[0]);
};

const getNextOrderNumber = async (client: QueryClient): Promise<number> => {
  const rows = await client.$queryRaw<Array<{ nextOrderNumber: number }>>(Prisma.sql`
    SELECT COALESCE(MAX("orderNumber"), 0) + 1 AS "nextOrderNumber"
    FROM "FabricOrder"
  `);

  return Number(rows[0]?.nextOrderNumber || 1);
};

const createOrderWithAutoNumber = async (payload: {
  orderDate: Date;
  supplierId: number;
  fabricId: number;
  colorId: number;
  patternId: number | null;
  quantity: number;
  unitType: string;
  arrivalDate: Date | null;
  status: string;
  notes: string | null;
}): Promise<FabricOrderResponse> => {
  let lastError: unknown;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const nextNumber = await getNextOrderNumber(tx);

        const inserted = await tx.$queryRaw<Array<{ id: number }>>(Prisma.sql`
          INSERT INTO "FabricOrder" (
            "orderNumber",
            "orderDate",
            "supplierId",
            "fabricId",
            "colorId",
            "patternId",
            "quantity",
            "unitType",
            "arrivalDate",
            "status",
            "notes",
            "createdAt",
            "updatedAt"
          ) VALUES (
            ${nextNumber},
            ${payload.orderDate},
            ${payload.supplierId},
            ${payload.fabricId},
            ${payload.colorId},
            ${payload.patternId},
            ${payload.quantity},
            ${payload.unitType},
            ${payload.arrivalDate},
            ${payload.status},
            ${payload.notes},
            NOW(),
            NOW()
          )
          RETURNING "id"
        `);

        const createdId = Number(inserted[0]?.id || 0);
        if (!createdId) {
          throw new Error("Siparis ekleme sonrasi ID alinamadi");
        }

        const createdOrder = await getOrderById(tx, createdId);
        if (!createdOrder) {
          throw new Error("Olusturulan siparis okunamadi");
        }

        return createdOrder;
      });
    } catch (error: unknown) {
      lastError = error;
      if (!isOrderNumberCollision(error)) {
        throw error;
      }
    }
  }

  throw lastError;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    try {
      const orders = await listOrders(prisma);
      return res.status(200).json(orders);
    } catch (error: unknown) {
      console.error("Fabric orders GET error:", error);
      return res
        .status(500)
        .json({ message: "Kumas siparisleri alinamadi", error: getErrorMessage(error) });
    }
  }

  if (req.method === "POST") {
const supplierId = toNumber(req.body?.supplierId);
    const fabricId = toNumber(req.body?.fabricId);
    const colorId = toNumber(req.body?.colorId);
    const resolvedPatternId = toNullablePositiveNumber(req.body?.patternId);
    const quantity = toNumber(req.body?.quantity);
    const unitType = String(req.body?.unitType || "").trim();
    const status = String(req.body?.status || "Beklemede").trim() || "Beklemede";
    const notesRaw = String(req.body?.notes || "").trim();
    const orderDate = parseOptionalDate(req.body?.orderDate) || new Date();
    const arrivalDate = parseOptionalDate(req.body?.arrivalDate);

if (
      !supplierId ||
      !fabricId ||
      !colorId ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !unitType
    ) {
      return res.status(400).json({
        message:
          "Tedarikci, kumas, renk, miktar (0'dan buyuk) ve birim zorunludur",
      });
    }

try {
      const created = await createOrderWithAutoNumber({
        orderDate,
        supplierId,
        fabricId,
        colorId,
        patternId: resolvedPatternId,
        quantity,
        unitType,
        arrivalDate,
        status,
        notes: notesRaw || null,
      });

      return res.status(201).json(created);
    } catch (error: unknown) {
      console.error("Fabric orders POST error:", error);
      return res
        .status(500)
        .json({ message: "Kumas siparisi olusturulamadi", error: getErrorMessage(error) });
    }
  }

if (req.method === "PUT") {
    const id = toNumber(req.body?.id);
    const supplierId = toNumber(req.body?.supplierId);
    const fabricId = toNumber(req.body?.fabricId);
    const colorId = toNumber(req.body?.colorId);
    const resolvedPatternId = toNullablePositiveNumber(req.body?.patternId);
    const quantity = toNumber(req.body?.quantity);
    const unitType = String(req.body?.unitType || "").trim();
    const status = String(req.body?.status || "").trim();
    const notesRaw = String(req.body?.notes || "").trim();
    const orderDate = parseOptionalDate(req.body?.orderDate);
    const arrivalDate = parseOptionalDate(req.body?.arrivalDate);

if (
      !id ||
      !supplierId ||
      !fabricId ||
      !colorId ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !unitType
    ) {
      return res.status(400).json({
        message:
          "ID, tedarikci, kumas, renk, miktar (0'dan buyuk) ve birim zorunludur",
      });
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const updateRows = await tx.$queryRaw<Array<{ id: number }>>(Prisma.sql`
          UPDATE "FabricOrder"
          SET
            "orderDate" = COALESCE(${orderDate}, "orderDate"),
            "supplierId" = ${supplierId},
            "fabricId" = ${fabricId},
"colorId" = ${colorId},
            "patternId" = ${resolvedPatternId},
            "quantity" = ${quantity},
            "unitType" = ${unitType},
            "arrivalDate" = ${arrivalDate},
            "status" = ${status || "Beklemede"},
            "notes" = ${notesRaw || null},
            "updatedAt" = NOW()
          WHERE "id" = ${id}
          RETURNING "id"
        `);

        if (!updateRows.length) {
          return null;
        }

        return getOrderById(tx, id);
      });

      if (!updated) {
        return res.status(404).json({ message: "Siparis bulunamadi" });
      }

      return res.status(200).json(updated);
    } catch (error: unknown) {
      console.error("Fabric orders PUT error:", error);
      return res
        .status(500)
        .json({ message: "Kumas siparisi guncellenemedi", error: getErrorMessage(error) });
    }
  }

  if (req.method === "DELETE") {
    const id = toNumber(req.body?.id);
    if (!id) {
      return res.status(400).json({ message: "ID zorunludur" });
    }

    try {
      const deleted = await prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
        DELETE FROM "FabricOrder"
        WHERE "id" = ${id}
        RETURNING "id"
      `);

      if (!deleted.length) {
        return res.status(404).json({ message: "Siparis bulunamadi" });
      }

      return res.status(200).json({ message: "Kumas siparisi silindi" });
    } catch (error: unknown) {
      console.error("Fabric orders DELETE error:", error);
      return res
        .status(500)
        .json({ message: "Kumas siparisi silinemedi", error: getErrorMessage(error) });
    }
  }

  res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
  return res.status(405).json({ message: "Method not allowed" });
}
