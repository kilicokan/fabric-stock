// pages/api/customer-orders/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import pool from "@/utils/db";

type OrderItemPayload = {
  productCode?: string;
  color?: string;
  description?: string | null;
  notes?: string | null;
  quantity?: string | number;
  unit?: string | null;
  deliveryDate?: string | null;
  unitPrice?: string | number;
  totalPrice?: string | number;
};

type WorkOrderSummary = {
  totalItems: number;
  createdCount: number;
  pendingAssignmentCount: number;
  converted: boolean;
  workOrders: Array<{
    id: number;
    orderNo: string;
    status: string;
    assignedToMobile: boolean;
  }>;
};

type SalesDocumentType = "INVOICE" | "DISPATCH";

const normalizeDocumentType = (value: unknown): SalesDocumentType => {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized === "DISPATCH" ? "DISPATCH" : "INVOICE";
};

const parseOptionalDate = (value: unknown): Date | null => {
  if (!value || typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Bilinmeyen hata";

const getErrorCode = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String((error as { code?: unknown }).code || "");
  }
  return "";
};

const isMissingColumnError = (error: unknown): boolean => {
  const code = getErrorCode(error);
  const message = getErrorMessage(error);
  const lower = message.toLowerCase();
  const hasLegacyUnknownArg =
    lower.includes("unknown argument `documenttype`") ||
    lower.includes("unknown argument `documentdate`") ||
    lower.includes("unknown argument `documentno`") ||
    lower.includes("unknown argument `dispatchdate`") ||
    lower.includes("unknown argument `dispatchno`") ||
    lower.includes("unknown argument `inwarehousecode`") ||
    lower.includes("unknown argument `outwarehousecode`") ||
    lower.includes("unknown argument `currencycode`") ||
    lower.includes("unknown argument `currencyrate`") ||
    lower.includes("unknown argument `note`");
  return (
    code === "P2022" ||
    lower.includes("does not exist") ||
    lower.includes("colum") ||
    message.includes("SalesDocumentType") ||
    hasLegacyUnknownArg
  );
};

const parseNumberOrDefault = (value: unknown, fallback = 0): number => {
  const normalized = String(value ?? "")
    .trim()
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toOrderItemCreateInput = (item: OrderItemPayload) => ({
  productCode: String(item.productCode || "").trim(),
  color: String(item.color || "").trim(),
  description: item.description ? String(item.description).trim() : null,
  notes: item.notes ? String(item.notes).trim() : null,
  quantity: parseNumberOrDefault(item.quantity, 0),
  unit: item.unit ? String(item.unit).trim() : null,
  deliveryDate: item.deliveryDate ? new Date(item.deliveryDate) : null,
  unitPrice: parseNumberOrDefault(item.unitPrice, 0),
  totalPrice: parseNumberOrDefault(item.totalPrice, 0),
});

const hasSalesDocumentColumns = async (): Promise<boolean> => {
  const rows = await pool.$queryRawUnsafe<Array<{ column_name: string }>>(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='CustomerOrder'
      AND column_name IN (
        'documentType',
        'documentDate',
        'documentNo',
        'dispatchDate',
        'dispatchNo',
        'inWarehouseCode',
        'outWarehouseCode',
        'currencyCode',
        'currencyRate',
        'note'
      )
  `);
  return rows.length >= 10;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    try {
      const parseOrderId = (raw: string | string[] | undefined): number | null => {
        const value = Array.isArray(raw) ? raw[0] : raw;
        const parsed = Number(value);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
      };

      const includeConfig = {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        items: true,
      };

      const requestedOrderId = parseOrderId(req.query.id);
      const requestedScopeRaw = Array.isArray(req.query.scope) ? req.query.scope[0] : req.query.scope;
      const requestedScope = String(requestedScopeRaw || "")
        .trim()
        .toLowerCase();
      const onlyOrderScope = requestedScope === "order";
      const requestedDocumentType = req.query.documentType
        ? normalizeDocumentType(Array.isArray(req.query.documentType) ? req.query.documentType[0] : req.query.documentType)
        : null;
      const requestedDocumentPrefix = requestedDocumentType
        ? requestedDocumentType === "DISPATCH"
          ? "SI-"
          : "SF-"
        : null;

      let customerOrders;
      if (requestedOrderId) {
        customerOrders = await pool.customerOrder.findMany({
          where: { id: requestedOrderId },
          include: includeConfig,
        });
      } else {
        try {
          customerOrders = await pool.customerOrder.findMany({
            where: requestedDocumentType
              ? {
                  documentType: requestedDocumentType,
                  // Sales document lists should show only real document numbers (SF-/SI-),
                  // while non-prefixed records stay in order lists.
                  orderNo: { startsWith: requestedDocumentPrefix || "" },
                }
              : onlyOrderScope
                ? {
                    NOT: {
                      OR: [{ orderNo: { startsWith: "SF-" } }, { orderNo: { startsWith: "SI-" } }],
                    },
                  }
                : undefined,
            include: includeConfig,
            orderBy: {
              createdAt: "desc",
            },
          });
        } catch (queryError: unknown) {
          if (!isMissingColumnError(queryError)) {
            throw queryError;
          }

          const hasColumns = await hasSalesDocumentColumns();
          if (hasColumns && requestedDocumentType) {
            const prefixLike = `${requestedDocumentPrefix}%`;
            const ids = await pool.$queryRawUnsafe<Array<{ id: number }>>(
              `
                SELECT "id"
                FROM "public"."CustomerOrder"
                WHERE "documentType" = $1::"public"."SalesDocumentType"
                  AND "orderNo" LIKE $2
                ORDER BY "createdAt" DESC
              `,
              requestedDocumentType,
              prefixLike
            );

            const orderIds = ids.map((row) => row.id);
            customerOrders = orderIds.length
              ? await pool.customerOrder.findMany({
                  where: { id: { in: orderIds } },
                  include: includeConfig,
                  orderBy: {
                    createdAt: "desc",
                  },
                })
              : [];
          } else {
            // Legacy schema fallback: document columns are unavailable in DB.
            customerOrders = await pool.customerOrder.findMany({
              where: onlyOrderScope
                ? {
                    NOT: {
                      OR: [{ orderNo: { startsWith: "SF-" } }, { orderNo: { startsWith: "SI-" } }],
                    },
                  }
                : undefined,
              include: includeConfig,
              orderBy: {
                createdAt: "desc",
              },
            });
          }
        }
      }

      if (requestedOrderId && customerOrders.length === 0) {
        return res.status(404).json({ message: "Kayit bulunamadi." });
      }

      const productCodes: string[] = Array.from(
        new Set(
          customerOrders
            .flatMap((order) =>
              order.items.map((item) => String(item.productCode || "")).filter(Boolean)
            )
        )
      );

      const products = productCodes.length
        ? await pool.product.findMany({
            where: {
              modelNo: { in: productCodes },
            },
            select: {
              modelNo: true,
              recipes: {
                include: {
                  fabric: true,
                  accessory: true,
                },
              },
            },
          })
        : [];

      type RecipeEntry = {
        resourceType?: string;
        fabric?: { name?: string | null } | null;
        accessory?: { name?: string | null } | null;
        unit?: string;
        quantityPerUnit?: number | string;
      };

      const recipeMap = new Map<string, RecipeEntry[]>(
        products.map((product) => [
          product.modelNo,
          Array.isArray(product.recipes) ? (product.recipes as RecipeEntry[]) : [],
        ])
      );

      const orderIds = customerOrders.map((order) => order.id);
      const orderIdSet = new Set(orderIds);
      const workOrderBuckets = new Map<number, WorkOrderSummary["workOrders"]>();
      const approvalMap = new Map<number, { approved: boolean; approvedAt: Date | null }>();

      const relatedWorkOrders =
        orderIds.length > 0
          ? await pool.workOrder.findMany({
              where: {
                externalErpId: {
                  startsWith: "customer-order:",
                },
              },
              select: {
                id: true,
                orderNo: true,
                status: true,
                assignedToMobile: true,
                externalErpId: true,
              },
            })
          : [];

      if (orderIds.length > 0) {
        const approvalRows = await pool.$queryRawUnsafe<
          Array<{ id: number; approved: boolean; approvedAt: Date | null }>
        >(
          `SELECT "id", "approved", "approvedAt"
           FROM "CustomerOrder"
           WHERE "id" = ANY($1::int[])`,
          orderIds
        );

        approvalRows.forEach((row) => {
          approvalMap.set(Number(row.id), {
            approved: Boolean(row.approved),
            approvedAt: row.approvedAt ? new Date(row.approvedAt) : null,
          });
        });
      }

      relatedWorkOrders.forEach((workOrder) => {
        const rawReference = workOrder.externalErpId || "";
        const match = /^customer-order:(\d+):item:\d+$/i.exec(rawReference);
        if (!match) return;

        const orderId = Number(match[1]);
        if (!orderIdSet.has(orderId)) return;

        const bucket = workOrderBuckets.get(orderId);
        const summaryItem = {
          id: workOrder.id,
          orderNo: workOrder.orderNo,
          status: workOrder.status,
          assignedToMobile: Boolean(workOrder.assignedToMobile),
        };

        if (bucket) {
          bucket.push(summaryItem);
        } else {
          workOrderBuckets.set(orderId, [summaryItem]);
        }
      });

      const enrichedOrders = customerOrders.map((order) => {
        const requirementMap = new Map<string, { materialName: string; unit: string; totalQuantity: number }>();

        order.items.forEach((item) => {
          const recipes = recipeMap.get(item.productCode) || [];

          recipes.forEach((recipe) => {
            const materialName =
              recipe.resourceType === "FABRIC"
                ? recipe.fabric?.name || "KumaÅŸ"
                : recipe.accessory?.name || "Aksesuar";
            const key = `${materialName}__${recipe.unit}`;
            const current = requirementMap.get(key);
            const calculatedQuantity = Number(item.quantity) * Number(recipe.quantityPerUnit || 0);

            if (current) {
              current.totalQuantity += calculatedQuantity;
            } else {
              requirementMap.set(key, {
                materialName,
                unit: recipe.unit || "",
                totalQuantity: calculatedQuantity,
              });
            }
          });
        });

        const orderWorkOrders = workOrderBuckets.get(order.id) || [];
        const pendingAssignmentCount = orderWorkOrders.filter((item) => !item.assignedToMobile).length;
        const approvalInfo = approvalMap.get(order.id);

        return {
          ...order,
          approved: approvalInfo?.approved || false,
          approvedAt: approvalInfo?.approvedAt || null,
          materialRequirements: Array.from(requirementMap.values()),
          workOrderSummary: {
            totalItems: order.items.length,
            createdCount: orderWorkOrders.length,
            pendingAssignmentCount,
            converted: orderWorkOrders.length > 0,
            workOrders: orderWorkOrders,
          },
        };
      });

      if (requestedOrderId) {
        return res.status(200).json(enrichedOrders[0]);
      }

      res.status(200).json(enrichedOrders);
    } catch (error: unknown) {
      console.error("PostgreSQL GET error:", error);
      res.status(500).json({ message: "Kayitlar alinamadi.", error: getErrorMessage(error) });
    }
  }

  else if (req.method === "POST") {
    const { orderNo, customerId, items, documentType, documentDate, documentNo, dispatchDate, dispatchNo, inWarehouseCode, outWarehouseCode, currencyCode, currencyRate, note } = req.body as {
      orderNo?: string;
      customerId?: string | number;
      items?: OrderItemPayload[];
      documentType?: string;
      documentDate?: string | null;
      documentNo?: string | null;
      dispatchDate?: string | null;
      dispatchNo?: string | null;
      inWarehouseCode?: string | null;
      outWarehouseCode?: string | null;
      currencyCode?: string | null;
      currencyRate?: string | number | null;
      note?: string | null;
    };

    if (!orderNo || !customerId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Belge no, musteri ve en az bir urun zorunludur." });
    }

    try {
      const customerIdNum = Number(customerId);
      if (!Number.isInteger(customerIdNum) || customerIdNum <= 0) {
        return res.status(400).json({ message: "Gecerli bir musteri secilmelidir." });
      }

      const preparedItems = items.map(toOrderItemCreateInput);
      const hasInvalidItem = preparedItems.some(
        (item) =>
          !item.productCode ||
          !item.color ||
          !Number.isFinite(item.quantity) ||
          item.quantity <= 0 ||
          !Number.isFinite(item.unitPrice) ||
          item.unitPrice < 0 ||
          !Number.isFinite(item.totalPrice) ||
          item.totalPrice < 0
      );
      if (hasInvalidItem) {
        return res.status(400).json({
          message: "Satirlarda urun kodu, renk, miktar (>0), birim fiyat ve tutar gecerli olmalidir.",
        });
      }

      const customerExists = await pool.customer.findUnique({
        where: { id: customerIdNum },
        select: { id: true },
      });
      if (!customerExists) {
        return res.status(404).json({ message: "Secilen musteri bulunamadi." });
      }

      const includeConfig = {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        items: true,
      };

      let customerOrder;
      try {
        customerOrder = await pool.customerOrder.create({
          data: {
            orderNo: String(orderNo).trim(),
            customerId: customerIdNum,
            documentType: normalizeDocumentType(documentType),
            documentDate: parseOptionalDate(documentDate) || new Date(),
            documentNo: documentNo ? String(documentNo).trim() : null,
            dispatchDate: parseOptionalDate(dispatchDate),
            dispatchNo: dispatchNo ? String(dispatchNo).trim() : null,
            inWarehouseCode: inWarehouseCode ? String(inWarehouseCode).trim() : null,
            outWarehouseCode: outWarehouseCode ? String(outWarehouseCode).trim() : null,
            currencyCode: currencyCode ? String(currencyCode).trim() : "TRY",
            currencyRate:
              currencyRate !== null && currencyRate !== undefined && String(currencyRate).trim() !== ""
                ? parseNumberOrDefault(currencyRate, 1)
                : 1,
            note: note ? String(note).trim() : null,
            items: {
              create: preparedItems,
            },
          },
          include: includeConfig,
        });
      } catch (createError: unknown) {
        if (!isMissingColumnError(createError)) {
          throw createError;
        }

        const hasColumns = await hasSalesDocumentColumns();
        if (!hasColumns) {
          // Legacy schema fallback (no sales-document columns in DB).
          customerOrder = await pool.customerOrder.create({
            data: {
              orderNo: String(orderNo).trim(),
              customerId: customerIdNum,
              items: {
                create: preparedItems,
              },
            },
            include: includeConfig,
          });
        } else {
          // Legacy Prisma client fallback: DB has columns, but client does not know them.
          customerOrder = await pool.$transaction(async (tx) => {
            const inserted = await tx.$queryRawUnsafe<Array<{ id: number }>>(
              `
                INSERT INTO "public"."CustomerOrder"
                ("orderNo","customerId","documentType","documentDate","documentNo","dispatchDate","dispatchNo","inWarehouseCode","outWarehouseCode","currencyCode","currencyRate","note","createdAt","updatedAt","approved")
                VALUES
                ($1,$2,$3::"public"."SalesDocumentType",$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW(),false)
                RETURNING "id"
              `,
              String(orderNo).trim(),
              customerIdNum,
              normalizeDocumentType(documentType),
              parseOptionalDate(documentDate) || new Date(),
              documentNo ? String(documentNo).trim() : null,
              parseOptionalDate(dispatchDate),
              dispatchNo ? String(dispatchNo).trim() : null,
              inWarehouseCode ? String(inWarehouseCode).trim() : null,
              outWarehouseCode ? String(outWarehouseCode).trim() : null,
              currencyCode ? String(currencyCode).trim() : "TRY",
              currencyRate !== null && currencyRate !== undefined && String(currencyRate).trim() !== ""
                ? parseNumberOrDefault(currencyRate, 1)
                : 1,
              note ? String(note).trim() : null
            );

            const orderId = inserted?.[0]?.id;
            if (!orderId) {
              throw new Error("CustomerOrder insert failed: no id returned");
            }

            await tx.customerOrderItem.createMany({
              data: preparedItems.map((item) => ({
                orderId,
                productCode: item.productCode,
                color: item.color,
                description: item.description,
                notes: item.notes,
                quantity: item.quantity,
                unit: item.unit,
                deliveryDate: item.deliveryDate,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
              })),
            });

            return tx.customerOrder.findUnique({
              where: { id: orderId },
              include: includeConfig,
            });
          });
        }
      }

      res.status(201).json(customerOrder);
    } catch (error: unknown) {
      console.error("PostgreSQL POST error:", error);
      const code = getErrorCode(error);
      if (code === "P2003") {
        return res.status(400).json({ message: "Musteri referansi gecersiz." });
      }
      if (code === "P2002") {
        return res.status(409).json({ message: "Ayni belge bilgileriyle kayit zaten mevcut." });
      }
      res.status(500).json({ message: "Belge kaydedilemedi.", error: getErrorMessage(error) });
    }
  }

  else if (req.method === "PUT") {
    const { id, orderNo, customerId, items, documentType, documentDate, documentNo, dispatchDate, dispatchNo, inWarehouseCode, outWarehouseCode, currencyCode, currencyRate, note } = req.body as {
      id?: string | number;
      orderNo?: string;
      customerId?: string | number;
      items?: OrderItemPayload[];
      documentType?: string;
      documentDate?: string | null;
      documentNo?: string | null;
      dispatchDate?: string | null;
      dispatchNo?: string | null;
      inWarehouseCode?: string | null;
      outWarehouseCode?: string | null;
      currencyCode?: string | null;
      currencyRate?: string | number | null;
      note?: string | null;
    };

    if (!id || !orderNo || !customerId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "ID, fis no, musteri ve en az bir urun zorunludur." });
    }

    try {
      const orderIdNum = Number(id);
      const customerIdNum = Number(customerId);

      if (!Number.isInteger(orderIdNum) || orderIdNum <= 0) {
        return res.status(400).json({ message: "Gecerli bir kayit ID degeri girilmelidir." });
      }
      if (!Number.isInteger(customerIdNum) || customerIdNum <= 0) {
        return res.status(400).json({ message: "Gecerli bir musteri secilmelidir." });
      }

      const preparedItems = items.map(toOrderItemCreateInput);
      const hasInvalidItem = preparedItems.some(
        (item) =>
          !item.productCode ||
          !item.color ||
          !Number.isFinite(item.quantity) ||
          item.quantity <= 0 ||
          !Number.isFinite(item.unitPrice) ||
          item.unitPrice < 0 ||
          !Number.isFinite(item.totalPrice) ||
          item.totalPrice < 0
      );
      if (hasInvalidItem) {
        return res.status(400).json({
          message: "Satirlarda urun kodu, renk, miktar (>0), birim fiyat ve tutar gecerli olmalidir.",
        });
      }

      const customerExists = await pool.customer.findUnique({
        where: { id: customerIdNum },
        select: { id: true },
      });
      if (!customerExists) {
        return res.status(404).json({ message: "Secilen musteri bulunamadi." });
      }

      const includeConfig = {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        items: true,
      };

      let customerOrder;
      try {
        customerOrder = await pool.$transaction(async (tx) =>
          tx.customerOrder.update({
            where: { id: orderIdNum },
            data: {
              orderNo: String(orderNo).trim(),
              customerId: customerIdNum,
              documentType: normalizeDocumentType(documentType),
              documentDate: parseOptionalDate(documentDate),
              documentNo: documentNo ? String(documentNo).trim() : null,
              dispatchDate: parseOptionalDate(dispatchDate),
              dispatchNo: dispatchNo ? String(dispatchNo).trim() : null,
              inWarehouseCode: inWarehouseCode ? String(inWarehouseCode).trim() : null,
              outWarehouseCode: outWarehouseCode ? String(outWarehouseCode).trim() : null,
              currencyCode: currencyCode ? String(currencyCode).trim() : "TRY",
              currencyRate:
                currencyRate !== null && currencyRate !== undefined && String(currencyRate).trim() !== ""
                  ? parseNumberOrDefault(currencyRate, 1)
                  : 1,
              note: note ? String(note).trim() : null,
              items: {
                deleteMany: {},
                create: preparedItems,
              },
            },
            include: includeConfig,
          })
        );
      } catch (updateError: unknown) {
        if (!isMissingColumnError(updateError)) {
          throw updateError;
        }

        const hasColumns = await hasSalesDocumentColumns();
        if (!hasColumns) {
          customerOrder = await pool.$transaction(async (tx) =>
            tx.customerOrder.update({
              where: { id: orderIdNum },
              data: {
                orderNo: String(orderNo).trim(),
                customerId: customerIdNum,
                items: {
                  deleteMany: {},
                  create: preparedItems,
                },
              },
              include: includeConfig,
            })
          );
        } else {
          customerOrder = await pool.$transaction(async (tx) => {
            const updated = await tx.$queryRawUnsafe<Array<{ id: number }>>(
              `
                UPDATE "public"."CustomerOrder"
                SET
                  "orderNo" = $2,
                  "customerId" = $3,
                  "documentType" = $4::"public"."SalesDocumentType",
                  "documentDate" = $5,
                  "documentNo" = $6,
                  "dispatchDate" = $7,
                  "dispatchNo" = $8,
                  "inWarehouseCode" = $9,
                  "outWarehouseCode" = $10,
                  "currencyCode" = $11,
                  "currencyRate" = $12,
                  "note" = $13,
                  "updatedAt" = NOW()
                WHERE "id" = $1
                RETURNING "id"
              `,
              orderIdNum,
              String(orderNo).trim(),
              customerIdNum,
              normalizeDocumentType(documentType),
              parseOptionalDate(documentDate),
              documentNo ? String(documentNo).trim() : null,
              parseOptionalDate(dispatchDate),
              dispatchNo ? String(dispatchNo).trim() : null,
              inWarehouseCode ? String(inWarehouseCode).trim() : null,
              outWarehouseCode ? String(outWarehouseCode).trim() : null,
              currencyCode ? String(currencyCode).trim() : "TRY",
              currencyRate !== null && currencyRate !== undefined && String(currencyRate).trim() !== ""
                ? parseNumberOrDefault(currencyRate, 1)
                : 1,
              note ? String(note).trim() : null
            );

            if (!updated?.[0]?.id) {
              return null;
            }

            await tx.customerOrderItem.deleteMany({
              where: { orderId: orderIdNum },
            });

            await tx.customerOrderItem.createMany({
              data: preparedItems.map((item) => ({
                orderId: orderIdNum,
                productCode: item.productCode,
                color: item.color,
                description: item.description,
                notes: item.notes,
                quantity: item.quantity,
                unit: item.unit,
                deliveryDate: item.deliveryDate,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
              })),
            });

            return tx.customerOrder.findUnique({
              where: { id: orderIdNum },
              include: includeConfig,
            });
          });
        }
      }

      if (!customerOrder) {
        return res.status(404).json({ message: "Kayit bulunamadi." });
      }

      res.status(200).json(customerOrder);
    } catch (error: unknown) {
      console.error("PostgreSQL PUT error:", error);
      const code = getErrorCode(error);
      if (code === "P2025") {
        return res.status(404).json({ message: "Kayit bulunamadi." });
      }
      if (code === "P2003") {
        return res.status(400).json({ message: "Musteri referansi gecersiz." });
      }
      res.status(500).json({ message: "Belge guncellenemedi.", error: getErrorMessage(error) });
    }
  }

  else if (req.method === "DELETE") {
    const { id } = req.body as { id?: string | number };

    if (!id) {
      return res.status(400).json({ message: "ID zorunludur" });
    }

    try {
      await pool.customerOrder.delete({
        where: { id: Number(id) },
      });

      res.status(200).json({ message: "Kayit basariyla silindi." });
    } catch (error: unknown) {
      console.error("PostgreSQL DELETE error:", error);
      res.status(500).json({ message: "Kayit silinemedi.", error: getErrorMessage(error) });
    }
  }

  else {
    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    res.status(405).json({ message: "Method not allowed" });
  }
}
