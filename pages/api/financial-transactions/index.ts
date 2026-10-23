import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";

type PartyType = "CUSTOMER" | "SUPPLIER";
type Direction = "DEBIT" | "CREDIT";
type Source = "MANUAL" | "PAYMENT" | "DOCUMENT" | "ADJUSTMENT";

type TransactionRow = {
  id: number;
  partyType: PartyType;
  customerId: number | null;
  customerName: string | null;
  supplierId: number | null;
  supplierName: string | null;
  direction: Direction;
  source: Source;
  documentType: string | null;
  referenceNo: string | null;
  referenceId: string | null;
  transactionDate: Date;
  dueDate: Date | null;
  amount: number;
  currency: string;
  description: string | null;
  createdBy: number | null;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type QueryClient = Pick<Prisma.TransactionClient, "$queryRaw">;

const PARTY_TYPES = new Set<PartyType>(["CUSTOMER", "SUPPLIER"]);
const DIRECTIONS = new Set<Direction>(["DEBIT", "CREDIT"]);
const SOURCES = new Set<Source>(["MANUAL", "PAYMENT", "DOCUMENT", "ADJUSTMENT"]);

const BASE_SELECT_SQL = Prisma.sql`
  SELECT
    ft."id",
    ft."partyType",
    ft."customerId",
    c."name" AS "customerName",
    ft."supplierId",
    s."name" AS "supplierName",
    ft."direction",
    ft."source",
    ft."documentType",
    ft."referenceNo",
    ft."referenceId",
    ft."transactionDate",
    ft."dueDate",
    ft."amount",
    ft."currency",
    ft."description",
    ft."createdBy",
    u."name" AS "createdByName",
    ft."createdAt",
    ft."updatedAt"
  FROM "FinancialTransaction" ft
  LEFT JOIN "Customer" c ON c."id" = ft."customerId"
  LEFT JOIN "Supplier" s ON s."id" = ft."supplierId"
  LEFT JOIN "User" u ON u."id" = ft."createdBy"
`;

const parsePositiveInt = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
};

const parseAmount = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
};

const parseDate = (value: unknown): Date | null => {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeText = (value: unknown): string => String(value || "").trim();

const normalizePartyType = (value: unknown): PartyType | null => {
  const normalized = normalizeText(value).toUpperCase() as PartyType;
  return PARTY_TYPES.has(normalized) ? normalized : null;
};

const normalizeDirection = (value: unknown): Direction | null => {
  const normalized = normalizeText(value).toUpperCase() as Direction;
  return DIRECTIONS.has(normalized) ? normalized : null;
};

const normalizeSource = (value: unknown): Source | null => {
  const normalized = normalizeText(value).toUpperCase() as Source;
  return SOURCES.has(normalized) ? normalized : null;
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error";

const mapRow = (row: TransactionRow) => ({
  id: Number(row.id),
  partyType: row.partyType,
  customerId: row.customerId ? Number(row.customerId) : null,
  customerName: row.customerName || null,
  supplierId: row.supplierId ? Number(row.supplierId) : null,
  supplierName: row.supplierName || null,
  direction: row.direction,
  source: row.source,
  documentType: row.documentType || null,
  referenceNo: row.referenceNo || null,
  referenceId: row.referenceId || null,
  transactionDate: row.transactionDate.toISOString(),
  dueDate: row.dueDate ? row.dueDate.toISOString() : null,
  amount: Number(row.amount || 0),
  currency: String(row.currency || "TRY"),
  description: row.description || null,
  createdBy: row.createdBy ? Number(row.createdBy) : null,
  createdByName: row.createdByName || null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const buildWhereSql = (filters: {
  partyType: PartyType | null;
  customerId: number | null;
  supplierId: number | null;
  direction: Direction | null;
  source: Source | null;
  fromDate: Date | null;
  toDate: Date | null;
  search: string;
}): Prisma.Sql => {
  const conditions: Prisma.Sql[] = [];

  if (filters.partyType) conditions.push(Prisma.sql`ft."partyType" = ${filters.partyType}`);
  if (filters.customerId) conditions.push(Prisma.sql`ft."customerId" = ${filters.customerId}`);
  if (filters.supplierId) conditions.push(Prisma.sql`ft."supplierId" = ${filters.supplierId}`);
  if (filters.direction) conditions.push(Prisma.sql`ft."direction" = ${filters.direction}`);
  if (filters.source) conditions.push(Prisma.sql`ft."source" = ${filters.source}`);
  if (filters.fromDate) conditions.push(Prisma.sql`ft."transactionDate" >= ${filters.fromDate}`);
  if (filters.toDate) conditions.push(Prisma.sql`ft."transactionDate" <= ${filters.toDate}`);

  if (filters.search) {
    const searchLike = `%${filters.search}%`;
    conditions.push(
      Prisma.sql`(
        COALESCE(ft."referenceNo", '') ILIKE ${searchLike}
        OR COALESCE(ft."description", '') ILIKE ${searchLike}
        OR COALESCE(c."name", '') ILIKE ${searchLike}
        OR COALESCE(s."name", '') ILIKE ${searchLike}
      )`
    );
  }

  if (!conditions.length) return Prisma.empty;

  let whereSql = Prisma.sql`WHERE ${conditions[0]}`;
  for (let index = 1; index < conditions.length; index += 1) {
    whereSql = Prisma.sql`${whereSql} AND ${conditions[index]}`;
  }

  return whereSql;
};

const getTransactionById = async (client: QueryClient, id: number) => {
  const rows = await client.$queryRaw<TransactionRow[]>(Prisma.sql`
    ${BASE_SELECT_SQL}
    WHERE ft."id" = ${id}
    LIMIT 1
  `);

  if (!rows.length) return null;
  return mapRow(rows[0]);
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiAuth(req, res, {
    requireLicense: true,
    feature: "stock",
    requiredAccess: "stock",
  });
  if (!auth) return;

  if (req.method === "GET") {
    const partyType = normalizePartyType(req.query.partyType);
    const customerId = parsePositiveInt(req.query.customerId);
    const supplierId = parsePositiveInt(req.query.supplierId);
    const direction = normalizeDirection(req.query.direction);
    const source = normalizeSource(req.query.source);
    const fromDate = parseDate(req.query.fromDate);
    const toDate = parseDate(req.query.toDate);
    const search = normalizeText(req.query.search);
    const limit = Math.min(parsePositiveInt(req.query.limit) || 200, 1000);

    try {
      const whereSql = buildWhereSql({
        partyType,
        customerId,
        supplierId,
        direction,
        source,
        fromDate,
        toDate,
        search,
      });

      const rows = await prisma.$queryRaw<TransactionRow[]>(Prisma.sql`
        ${BASE_SELECT_SQL}
        ${whereSql}
        ORDER BY ft."transactionDate" DESC, ft."id" DESC
        LIMIT ${limit}
      `);

      const summaryRows = await prisma.$queryRaw<
        Array<{ totalDebit: number; totalCredit: number; balance: number }>
      >(Prisma.sql`
        SELECT
          COALESCE(SUM(CASE WHEN ft."direction" = 'DEBIT' THEN ft."amount" ELSE 0 END), 0) AS "totalDebit",
          COALESCE(SUM(CASE WHEN ft."direction" = 'CREDIT' THEN ft."amount" ELSE 0 END), 0) AS "totalCredit",
          COALESCE(SUM(CASE WHEN ft."direction" = 'DEBIT' THEN ft."amount" ELSE -ft."amount" END), 0) AS "balance"
        FROM "FinancialTransaction" ft
        LEFT JOIN "Customer" c ON c."id" = ft."customerId"
        LEFT JOIN "Supplier" s ON s."id" = ft."supplierId"
        ${whereSql}
      `);

      return res.status(200).json({
        rows: rows.map(mapRow),
        summary: {
          totalDebit: Number(summaryRows[0]?.totalDebit || 0),
          totalCredit: Number(summaryRows[0]?.totalCredit || 0),
          balance: Number(summaryRows[0]?.balance || 0),
        },
      });
    } catch (error: unknown) {
      console.error("Financial transactions GET error:", error);
      return res.status(500).json({
        message: "Finans hareketleri alinamadi",
        error: getErrorMessage(error),
      });
    }
  }

  if (req.method === "POST" || req.method === "PUT") {
    const id = parsePositiveInt(req.body?.id);
    const partyType = normalizePartyType(req.body?.partyType);
    const direction = normalizeDirection(req.body?.direction);
    const source = normalizeSource(req.body?.source) || "MANUAL";
    const amount = parseAmount(req.body?.amount);
    const customerId = parsePositiveInt(req.body?.customerId);
    const supplierId = parsePositiveInt(req.body?.supplierId);
    const transactionDate = parseDate(req.body?.transactionDate) || new Date();
    const dueDate = parseDate(req.body?.dueDate);
    const documentType = normalizeText(req.body?.documentType) || null;
    const referenceNo = normalizeText(req.body?.referenceNo) || null;
    const referenceId = normalizeText(req.body?.referenceId) || null;
    const currency = normalizeText(req.body?.currency || "TRY") || "TRY";
    const description = normalizeText(req.body?.description) || null;
    const createdBy = auth.token.id;

    if (req.method === "PUT" && !id) {
      return res.status(400).json({ message: "Guncelleme icin id zorunludur" });
    }

    if (!partyType || !direction || !amount) {
      return res.status(400).json({
        message: "partyType, direction ve amount alanlari zorunludur",
      });
    }

    if (partyType === "CUSTOMER" && !customerId) {
      return res.status(400).json({ message: "Musteri hareketi icin customerId zorunludur" });
    }

    if (partyType === "SUPPLIER" && !supplierId) {
      return res.status(400).json({ message: "Tedarikci hareketi icin supplierId zorunludur" });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        if (req.method === "POST") {
          const inserted = await tx.$queryRaw<Array<{ id: number }>>(Prisma.sql`
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
              ${partyType},
              ${partyType === "CUSTOMER" ? customerId : null},
              ${partyType === "SUPPLIER" ? supplierId : null},
              ${direction},
              ${source},
              ${documentType},
              ${referenceNo},
              ${referenceId},
              ${transactionDate},
              ${dueDate},
              ${amount},
              ${currency},
              ${description},
              ${createdBy},
              NOW(),
              NOW()
            )
            RETURNING "id"
          `);

          const createdId = Number(inserted[0]?.id || 0);
          if (!createdId) return null;
          return getTransactionById(tx, createdId);
        }

        const updated = await tx.$queryRaw<Array<{ id: number }>>(Prisma.sql`
          UPDATE "FinancialTransaction"
          SET
            "partyType" = ${partyType},
            "customerId" = ${partyType === "CUSTOMER" ? customerId : null},
            "supplierId" = ${partyType === "SUPPLIER" ? supplierId : null},
            "direction" = ${direction},
            "source" = ${source},
            "documentType" = ${documentType},
            "referenceNo" = ${referenceNo},
            "referenceId" = ${referenceId},
            "transactionDate" = ${transactionDate},
            "dueDate" = ${dueDate},
            "amount" = ${amount},
            "currency" = ${currency},
            "description" = ${description},
            "createdBy" = ${createdBy},
            "updatedAt" = NOW()
          WHERE "id" = ${id}
          RETURNING "id"
        `);

        if (!updated.length || !id) return null;
        return getTransactionById(tx, id);
      });

      if (!result) {
        return res.status(404).json({ message: "Finans hareketi bulunamadi veya kaydedilemedi" });
      }

      return res.status(req.method === "POST" ? 201 : 200).json(result);
    } catch (error: unknown) {
      console.error("Financial transactions save error:", error);
      return res.status(500).json({
        message: "Finans hareketi kaydedilemedi",
        error: getErrorMessage(error),
      });
    }
  }

  if (req.method === "DELETE") {
    const id = parsePositiveInt(req.body?.id);
    if (!id) {
      return res.status(400).json({ message: "Silme icin id zorunludur" });
    }

    try {
      const deleted = await prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
        DELETE FROM "FinancialTransaction"
        WHERE "id" = ${id}
        RETURNING "id"
      `);

      if (!deleted.length) {
        return res.status(404).json({ message: "Finans hareketi bulunamadi" });
      }

      return res.status(200).json({ message: "Finans hareketi silindi" });
    } catch (error: unknown) {
      console.error("Financial transactions DELETE error:", error);
      return res.status(500).json({
        message: "Finans hareketi silinemedi",
        error: getErrorMessage(error),
      });
    }
  }

  res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
  return res.status(405).json({ message: "Method not allowed" });
}
