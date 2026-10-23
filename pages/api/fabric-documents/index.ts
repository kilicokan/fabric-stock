import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import prisma from "@/utils/db";

type FabricDocumentResponse = {
  id: number;
  documentType: string;
  fgType: string;
  fgNumber: string;
  date: string;
  orderNo: string | null;
  supplierCode: string;
  supplierName: string;
  documentNumber: string;
  entryWarehouseCode: string;
  exitWarehouseCode: string;
  total: number;
  fabricOrderId: number | null;
  fabricOrderNumber: number | null;
  fabricId: number | null;
  fabricName: string;
  colorId: number | null;
  colorName: string;
  quantity: number;
  unitType: string;
  createdAt: string;
  updatedAt: string;
};

type DbDocumentRow = {
  id: number;
  documentType: string;
  fgType: string | null;
  fgNumber: string | null;
  date: Date;
  orderNo: string | null;
  supplierCode: string | null;
  supplierName: string | null;
  documentNumber: string;
  entryWarehouseCode: string | null;
  exitWarehouseCode: string | null;
  total: number;
  fabricOrderId: number | null;
  fabricOrderNumber: number | null;
  fabricId: number | null;
  fabricName: string | null;
  colorId: number | null;
  colorName: string | null;
  quantity: number;
  unitType: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type FabricOrderBaseRow = {
  id: number;
  orderNumber: number;
  fabricId: number;
  colorId: number;
  unitType: string;
  quantity: number;
};

type FabricOrderValidation = FabricOrderBaseRow & {
  receivedQuantity: number;
};

type QueryClient = Pick<Prisma.TransactionClient, "$queryRaw" | "$executeRaw">;

const DOCUMENT_SELECT_SQL = Prisma.sql`
  SELECT
    fd."id",
    fd."type" AS "documentType",
    fd."fgType",
    fd."fgNumber",
    fd."date",
    fd."orderNo",
    fd."supplierCode",
    fd."supplierName",
    fd."number" AS "documentNumber",
    fd."entryWarehouseCode",
    fd."exitWarehouseCode",
    fd."total",
    fd."fabricOrderId",
    fo."orderNumber" AS "fabricOrderNumber",
    fd."fabricId",
    f."name" AS "fabricName",
    fd."colorId",
    c."name" AS "colorName",
    fd."quantity",
    fd."unitType",
    fd."createdAt",
    fd."updatedAt"
  FROM "FabricDocument" fd
  LEFT JOIN "FabricOrder" fo ON fo."id" = fd."fabricOrderId"
  LEFT JOIN "Fabric" f ON f."id" = fd."fabricId"
  LEFT JOIN "Color" c ON c."id" = fd."colorId"
`;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error";

const toIso = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return NaN;
};

const parseRequiredDate = (value: unknown): Date | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeText = (value: unknown): string => String(value || "").trim();

const normalizeUnitType = (value: unknown): string =>
  String(value || "kg").toLowerCase().startsWith("m") ? "m" : "kg";

const normalizeDocumentType = (value: unknown): string =>
  String(value || "irsaliye").toLowerCase().startsWith("f") ? "fatura" : "irsaliye";

const mapRow = (row: DbDocumentRow): FabricDocumentResponse => ({
  id: Number(row.id),
  documentType: String(row.documentType || "irsaliye"),
  fgType: String(row.fgType || ""),
  fgNumber: String(row.fgNumber || ""),
  date: toIso(row.date) || new Date().toISOString(),
  orderNo: row.orderNo ? String(row.orderNo) : null,
  supplierCode: String(row.supplierCode || ""),
  supplierName: String(row.supplierName || ""),
  documentNumber: String(row.documentNumber || ""),
  entryWarehouseCode: String(row.entryWarehouseCode || ""),
  exitWarehouseCode: String(row.exitWarehouseCode || ""),
  total: Number(row.total || 0),
  fabricOrderId: row.fabricOrderId ? Number(row.fabricOrderId) : null,
  fabricOrderNumber: row.fabricOrderNumber ? Number(row.fabricOrderNumber) : null,
  fabricId: row.fabricId ? Number(row.fabricId) : null,
  fabricName: String(row.fabricName || ""),
  colorId: row.colorId ? Number(row.colorId) : null,
  colorName: String(row.colorName || ""),
  quantity: Number(row.quantity || 0),
  unitType: String(row.unitType || "kg"),
  createdAt: toIso(row.createdAt) || new Date().toISOString(),
  updatedAt: toIso(row.updatedAt) || new Date().toISOString(),
});

const listDocuments = async (client: QueryClient): Promise<FabricDocumentResponse[]> => {
  const rows = await client.$queryRaw<DbDocumentRow[]>(Prisma.sql`
    ${DOCUMENT_SELECT_SQL}
    ORDER BY fd."date" DESC, fd."id" DESC
  `);

  return rows.map(mapRow);
};

const getDocumentById = async (client: QueryClient, id: number): Promise<FabricDocumentResponse | null> => {
  const rows = await client.$queryRaw<DbDocumentRow[]>(Prisma.sql`
    ${DOCUMENT_SELECT_SQL}
    WHERE fd."id" = ${id}
    LIMIT 1
  `);

  if (!rows.length) return null;
  return mapRow(rows[0]);
};

const hasDocumentNumberConflict = async (
  client: QueryClient,
  documentNumber: string,
  excludedId?: number
): Promise<boolean> => {
  const whereExcluded = typeof excludedId === "number" ? Prisma.sql`AND "id" <> ${excludedId}` : Prisma.empty;

  const rows = await client.$queryRaw<Array<{ id: number }>>(Prisma.sql`
    SELECT "id"
    FROM "FabricDocument"
    WHERE "number" = ${documentNumber}
    ${whereExcluded}
    LIMIT 1
  `);

  return rows.length > 0;
};

const getFabricOrderValidation = async (
  client: QueryClient,
  fabricOrderId: number,
  excludedDocumentId?: number
): Promise<FabricOrderValidation | null> => {
  const orderRows = await client.$queryRaw<FabricOrderBaseRow[]>(Prisma.sql`
    SELECT
      "id",
      "orderNumber",
      "fabricId",
      "colorId",
      "unitType",
      "quantity"
    FROM "FabricOrder"
    WHERE "id" = ${fabricOrderId}
    LIMIT 1
  `);

  if (!orderRows.length) return null;

  const whereExcluded =
    typeof excludedDocumentId === "number" ? Prisma.sql`AND "id" <> ${excludedDocumentId}` : Prisma.empty;

  const receivedRows = await client.$queryRaw<Array<{ receivedQuantity: number }>>(Prisma.sql`
    SELECT COALESCE(SUM("quantity"), 0) AS "receivedQuantity"
    FROM "FabricDocument"
    WHERE "fabricOrderId" = ${fabricOrderId}
    ${whereExcluded}
  `);

  return {
    ...orderRows[0],
    receivedQuantity: Number(receivedRows[0]?.receivedQuantity || 0),
  };
};

const isFinancialModuleUnavailable = (error: unknown): boolean => {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("financialtransaction") ||
    message.includes("partytype") ||
    message.includes("transactiondirection") ||
    message.includes("transactionsource") ||
    message.includes("does not exist")
  );
};

const resolveSupplierIdByName = async (client: QueryClient, supplierName: string): Promise<number | null> => {
  const normalized = normalizeText(supplierName);
  if (!normalized) return null;

  const rows = await client.$queryRaw<Array<{ id: number }>>(Prisma.sql`
    SELECT "id"
    FROM "Supplier"
    WHERE LOWER(TRIM("name")) = LOWER(TRIM(${normalized}))
    LIMIT 1
  `);

  return rows.length ? Number(rows[0].id) : null;
};

const syncSupplierLedgerForDocument = async (
  client: QueryClient,
  payload: {
    documentId: number;
    documentType: string;
    documentNumber: string;
    supplierName: string;
    date: Date;
    total: number;
  }
): Promise<void> => {
  try {
    const referenceId = `FABRIC_DOCUMENT:${payload.documentId}`;
    const normalizedType = normalizeDocumentType(payload.documentType);

    if (normalizedType !== "fatura" || payload.total <= 0) {
      await client.$queryRaw(Prisma.sql`
        DELETE FROM "FinancialTransaction"
        WHERE "referenceId" = ${referenceId}
      `);
      return;
    }

    const supplierId = await resolveSupplierIdByName(client, payload.supplierName);
    const existing = await client.$queryRaw<Array<{ id: number }>>(Prisma.sql`
      SELECT "id"
      FROM "FinancialTransaction"
      WHERE "referenceId" = ${referenceId}
      LIMIT 1
    `);

    if (existing.length > 0) {
      await client.$queryRaw(Prisma.sql`
        UPDATE "FinancialTransaction"
        SET
          "partyType" = 'SUPPLIER',
          "supplierId" = ${supplierId},
          "customerId" = NULL,
          "direction" = 'DEBIT',
          "source" = 'DOCUMENT',
          "documentType" = 'FABRIC_FATURA',
          "referenceNo" = ${payload.documentNumber},
          "transactionDate" = ${payload.date},
          "dueDate" = NULL,
          "amount" = ${payload.total},
          "currency" = 'TRY',
          "description" = ${`Kumas alim faturasi: ${payload.documentNumber}`},
          "updatedAt" = NOW()
        WHERE "id" = ${Number(existing[0].id)}
      `);
      return;
    }

    await client.$queryRaw(Prisma.sql`
      INSERT INTO "FinancialTransaction" (
        "partyType",
        "customerId",
        "supplierId",
        "direction",
        "source",
        "documentType",
        "referenceNo",
        "referenceId",
        "transactionDate",
        "dueDate",
        "amount",
        "currency",
        "description",
        "createdBy",
        "createdAt",
        "updatedAt"
      ) VALUES (
        'SUPPLIER',
        NULL,
        ${supplierId},
        'DEBIT',
        'DOCUMENT',
        'FABRIC_FATURA',
        ${payload.documentNumber},
        ${referenceId},
        ${payload.date},
        NULL,
        ${payload.total},
        'TRY',
        ${`Kumas alim faturasi: ${payload.documentNumber}`},
        NULL,
        NOW(),
        NOW()
      )
    `);
  } catch (error: unknown) {
    if (isFinancialModuleUnavailable(error)) return;
    throw error;
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    try {
      const documents = await listDocuments(prisma);
      return res.status(200).json(documents);
    } catch (error: unknown) {
      console.error("Fabric documents GET error:", error);
      return res.status(500).json({ message: "Kumas belgeleri alinamadi", error: getErrorMessage(error) });
    }
  }

  if (req.method === "POST" || req.method === "PUT") {
    const id = toNumber(req.body?.id);
    const documentType = normalizeDocumentType(req.body?.documentType || req.body?.type);
    const fgType = normalizeText(req.body?.fgType);
    const fgNumber = normalizeText(req.body?.fgNumber);
    const documentNumber = normalizeText(req.body?.documentNumber || req.body?.number);
    const orderNo = normalizeText(req.body?.orderNo);
    const supplierCode = normalizeText(req.body?.supplierCode);
    const supplierName = normalizeText(req.body?.supplierName);
    const entryWarehouseCode = normalizeText(req.body?.entryWarehouseCode);
    const exitWarehouseCode = normalizeText(req.body?.exitWarehouseCode);
    const date = parseRequiredDate(req.body?.date);
    const total = toNumber(req.body?.total);
    const fabricOrderId = toNumber(req.body?.fabricOrderId);
    const rawFabricId = toNumber(req.body?.fabricId);
    const rawColorId = toNumber(req.body?.colorId);
    const rawQuantity = toNumber(req.body?.quantity);
    const rawUnitType = normalizeUnitType(req.body?.unitType);

    if (req.method === "PUT" && !id) {
      return res.status(400).json({ message: "Guncelleme icin belge ID zorunludur" });
    }

    if (!fgNumber || !documentNumber || !date) {
      return res.status(400).json({
        message: "FG numarasi, belge numarasi ve belge tarihi zorunludur",
      });
    }

    if (!Number.isFinite(total) || total < 0) {
      return res.status(400).json({ message: "Toplam tutar sifir veya pozitif sayi olmalidir" });
    }

    if (!fabricOrderId) {
      return res.status(400).json({
        message: "Siparisten dusum icin kumas siparisi secimi zorunludur",
      });
    }

    if (!Number.isFinite(rawQuantity) || rawQuantity <= 0) {
      return res.status(400).json({ message: "Miktar 0'dan buyuk olmali" });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const numberConflict = await hasDocumentNumberConflict(
          tx,
          documentNumber,
          req.method === "PUT" ? id : undefined
        );

        if (numberConflict) {
          return { error: "Belge numarasi zaten kullaniliyor", status: 409 as const };
        }

        const orderValidation = await getFabricOrderValidation(
          tx,
          fabricOrderId,
          req.method === "PUT" ? id : undefined
        );

        if (!orderValidation) {
          return { error: "Secilen kumas siparisi bulunamadi", status: 400 as const };
        }

        const resolvedFabricId = Number(orderValidation.fabricId || rawFabricId || 0);
        const resolvedColorId = Number(orderValidation.colorId || rawColorId || 0);
        const resolvedUnitType = normalizeUnitType(orderValidation.unitType || rawUnitType);

        if (!resolvedFabricId || !resolvedColorId) {
          return {
            error: "Secilen siparis icin kumas veya renk bilgisi eksik",
            status: 400 as const,
          };
        }

        const remainingQuantity = Math.max(
          Number(orderValidation.quantity || 0) - Number(orderValidation.receivedQuantity || 0),
          0
        );

        if (rawQuantity > remainingQuantity + 0.0001) {
          return {
            error: `Gelen miktar siparis kalanini asamaz (kalan: ${remainingQuantity})`,
            status: 400 as const,
          };
        }

        if (req.method === "POST") {
          const inserted = await tx.$queryRaw<Array<{ id: number }>>(Prisma.sql`
            INSERT INTO "FabricDocument" (
              "type",
              "number",
              "date",
              "customer",
              "warehouse",
              "total",
              "fgType",
              "fgNumber",
              "orderNo",
              "supplierCode",
              "supplierName",
              "entryWarehouseCode",
              "exitWarehouseCode",
              "fabricOrderId",
              "fabricId",
              "colorId",
              "quantity",
              "unitType",
              "createdAt",
              "updatedAt"
            ) VALUES (
              ${documentType},
              ${documentNumber},
              ${date},
              ${supplierName || "-"},
              ${entryWarehouseCode || "-"},
              ${Number(total)},
              ${fgType || null},
              ${fgNumber},
              ${orderNo || null},
              ${supplierCode || null},
              ${supplierName || null},
              ${entryWarehouseCode || null},
              ${exitWarehouseCode || null},
              ${fabricOrderId},
              ${resolvedFabricId},
              ${resolvedColorId},
              ${Number(rawQuantity)},
              ${resolvedUnitType},
              NOW(),
              NOW()
            )
            RETURNING "id"
          `);

          const createdId = Number(inserted[0]?.id || 0);
          if (!createdId) {
            return { error: "Belge kaydi olusturulamadi", status: 500 as const };
          }

          const createdDocument = await getDocumentById(tx, createdId);
          if (!createdDocument) {
            return { error: "Olusturulan belge okunamadi", status: 500 as const };
          }

          await syncSupplierLedgerForDocument(tx, {
            documentId: createdId,
            documentType,
            documentNumber,
            supplierName,
            date,
            total: Number(total),
          });

          return { data: createdDocument, status: 201 as const };
        }

        const updatedRows = await tx.$queryRaw<Array<{ id: number }>>(Prisma.sql`
          UPDATE "FabricDocument"
          SET
            "type" = ${documentType},
            "number" = ${documentNumber},
            "date" = ${date},
            "customer" = ${supplierName || "-"},
            "warehouse" = ${entryWarehouseCode || "-"},
            "total" = ${Number(total)},
            "fgType" = ${fgType || null},
            "fgNumber" = ${fgNumber},
            "orderNo" = ${orderNo || null},
            "supplierCode" = ${supplierCode || null},
            "supplierName" = ${supplierName || null},
            "entryWarehouseCode" = ${entryWarehouseCode || null},
            "exitWarehouseCode" = ${exitWarehouseCode || null},
            "fabricOrderId" = ${fabricOrderId},
            "fabricId" = ${resolvedFabricId},
            "colorId" = ${resolvedColorId},
            "quantity" = ${Number(rawQuantity)},
            "unitType" = ${resolvedUnitType},
            "updatedAt" = NOW()
          WHERE "id" = ${id}
          RETURNING "id"
        `);

        if (!updatedRows.length) {
          return { error: "Belge bulunamadi", status: 404 as const };
        }

        const updatedDocument = await getDocumentById(tx, id);
        if (!updatedDocument) {
          return { error: "Guncellenen belge okunamadi", status: 500 as const };
        }

        await syncSupplierLedgerForDocument(tx, {
          documentId: id,
          documentType,
          documentNumber,
          supplierName,
          date,
          total: Number(total),
        });

        return { data: updatedDocument, status: 200 as const };
      });

      if ("error" in result) {
        return res.status(result.status).json({ message: result.error });
      }

      return res.status(result.status).json(result.data);
    } catch (error: unknown) {
      console.error("Fabric documents save error:", error);
      return res.status(500).json({ message: "Kumas belgesi kaydedilemedi", error: getErrorMessage(error) });
    }
  }

  if (req.method === "DELETE") {
    const id = toNumber(req.body?.id);
    if (!id) {
      return res.status(400).json({ message: "Belge ID zorunludur" });
    }

    try {
      const deleted = await prisma.$transaction(async (tx) => {
        const removed = await tx.$queryRaw<Array<{ id: number }>>(Prisma.sql`
          DELETE FROM "FabricDocument"
          WHERE "id" = ${id}
          RETURNING "id"
        `);

        if (!removed.length) return removed;

        await syncSupplierLedgerForDocument(tx, {
          documentId: id,
          documentType: "irsaliye",
          documentNumber: "",
          supplierName: "",
          date: new Date(),
          total: 0,
        });

        return removed;
      });

      if (!deleted.length) {
        return res.status(404).json({ message: "Belge bulunamadi" });
      }

      return res.status(200).json({ message: "Belge silindi" });
    } catch (error: unknown) {
      console.error("Fabric documents DELETE error:", error);
      return res.status(500).json({ message: "Kumas belgesi silinemedi", error: getErrorMessage(error) });
    }
  }

  res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
  return res.status(405).json({ message: "Method not allowed" });
}
