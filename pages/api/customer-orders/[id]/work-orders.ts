import type { NextApiRequest, NextApiResponse } from "next";
import pool from "@/utils/db";

type WorkOrderPreview = {
  itemId: number;
  productCode: string;
  productName: string;
  quantity: number;
  color: string;
  deliveryDate: string | null;
  existingWorkOrder?: {
    id: number;
    orderNo: string;
    status: string;
    assignedToMobile: boolean;
  };
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Bilinmeyen hata";

const parseOrderId = (raw: string | string[] | undefined): number | null => {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeQuantity = (value: unknown): number => {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return 0;
  }
  return Math.ceil(quantity);
};

const buildExternalRef = (orderId: number, itemId: number): string =>
  `customer-order:${orderId}:item:${itemId}`;

const buildBaseWorkOrderNo = (orderNo: string, itemIndex: number): string =>
  `${orderNo}-${String(itemIndex + 1).padStart(2, "0")}`;

const calculatePriority = (deliveryDate: Date | null): "LOW" | "MEDIUM" | "HIGH" | "URGENT" => {
  if (!deliveryDate) return "MEDIUM";

  const now = Date.now();
  const msDiff = deliveryDate.getTime() - now;
  const dayDiff = msDiff / (1000 * 60 * 60 * 24);

  if (dayDiff <= 1) return "URGENT";
  if (dayDiff <= 3) return "HIGH";
  if (dayDiff <= 7) return "MEDIUM";
  return "LOW";
};

const ensureUniqueWorkOrderNo = async (baseNo: string): Promise<string> => {
  let candidate = baseNo;
  let suffix = 2;

  for (;;) {
    const existing = await pool.workOrder.findUnique({
      where: { orderNo: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    candidate = `${baseNo}-${suffix}`;
    suffix += 1;
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const orderId = parseOrderId(req.query.id);
  if (!orderId) {
    return res.status(400).json({ message: "Gecerli siparis id gerekli" });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const order = await pool.customerOrder.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        items: true,
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Siparis bulunamadi" });
    }

    const productCodes = Array.from(
      new Set(order.items.map((item) => item.productCode).filter((code): code is string => Boolean(code)))
    );

    const products =
      productCodes.length > 0
        ? await pool.product.findMany({
            where: {
              modelNo: { in: productCodes },
            },
            select: {
              modelNo: true,
              name: true,
            },
          })
        : [];

    const productNameMap = new Map(products.map((product) => [product.modelNo, product.name]));
    const externalRefs = order.items.map((item) => buildExternalRef(order.id, item.id));

    const existingWorkOrders =
      externalRefs.length > 0
        ? await pool.workOrder.findMany({
            where: {
              externalErpId: { in: externalRefs },
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

    const existingMap = new Map(
      existingWorkOrders.map((item) => [
        item.externalErpId || "",
        {
          id: item.id,
          orderNo: item.orderNo,
          status: item.status,
          assignedToMobile: Boolean(item.assignedToMobile),
        },
      ])
    );

    const previewRows: WorkOrderPreview[] = order.items.map((item) => {
      const externalRef = buildExternalRef(order.id, item.id);
      const preferredProductName = productNameMap.get(item.productCode);
      return {
        itemId: item.id,
        productCode: item.productCode,
        productName: preferredProductName || item.description || item.productCode,
        quantity: normalizeQuantity(item.quantity),
        color: item.color || "",
        deliveryDate: item.deliveryDate ? item.deliveryDate.toISOString() : null,
        existingWorkOrder: existingMap.get(externalRef),
      };
    });

    if (req.method === "GET") {
      return res.status(200).json({
        orderId: order.id,
        orderNo: order.orderNo,
        customerName: order.customer?.name || "",
        totalItems: previewRows.length,
        createdWorkOrders: previewRows.filter((row) => row.existingWorkOrder).length,
        rows: previewRows,
      });
    }

    const created: Array<{ id: number; orderNo: string; productCode: string; quantity: number }> = [];
    const skipped: Array<{ itemId: number; reason: string; existingOrderNo?: string }> = [];

    for (let index = 0; index < order.items.length; index += 1) {
      const item = order.items[index];
      const externalRef = buildExternalRef(order.id, item.id);
      const existing = existingMap.get(externalRef);

      if (existing) {
        skipped.push({
          itemId: item.id,
          reason: "Bu satir icin daha once is emri olusturulmus",
          existingOrderNo: existing.orderNo,
        });
        continue;
      }

      const quantity = normalizeQuantity(item.quantity);
      if (quantity <= 0) {
        skipped.push({
          itemId: item.id,
          reason: "Miktar gecersiz oldugu icin atlandi",
        });
        continue;
      }

      const baseOrderNo = buildBaseWorkOrderNo(order.orderNo, index);
      const workOrderNo = await ensureUniqueWorkOrderNo(baseOrderNo);
      const productName = productNameMap.get(item.productCode) || item.description || item.productCode;
      const deliveryDate = item.deliveryDate ? new Date(item.deliveryDate) : null;

      const notes = [
        `Kaynak siparis: ${order.orderNo}`,
        `Siparis satiri: ${item.id}`,
        item.color ? `Renk: ${item.color}` : "",
        item.notes ? `Not: ${item.notes}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      const createdWorkOrder = await pool.workOrder.create({
        data: {
          orderNo: workOrderNo,
          productCode: item.productCode,
          productName,
          quantity,
          customerName: order.customer?.name || "",
          deliveryDate,
          notes,
          status: "BEKLIYOR",
          priority: calculatePriority(deliveryDate),
          assignedToMobile: false,
          externalErpId: externalRef,
        },
        select: {
          id: true,
          orderNo: true,
          productCode: true,
          quantity: true,
        },
      });

      created.push(createdWorkOrder);
    }

    let resultMessage = "";
    if (created.length > 0 && skipped.length > 0) {
      resultMessage = `${created.length} is emri olusturuldu, ${skipped.length} satir daha once donusturuldugu icin atlandi`;
    } else if (created.length > 0) {
      resultMessage = `${created.length} is emri olusturuldu`;
    } else if (skipped.length > 0) {
      resultMessage = "Bu siparisin tum satirlari daha once is emrine donusturulmus";
    } else {
      resultMessage = "Is emrine donusturulecek uygun satir bulunamadi";
    }

    return res.status(201).json({
      message: resultMessage,
      createdCount: created.length,
      skippedCount: skipped.length,
      created,
      skipped,
    });
  } catch (error: unknown) {
    console.error("Customer order to work order conversion error:", error);
    return res.status(500).json({
      message: "Siparisten is emri olusturulamadi",
      error: getErrorMessage(error),
    });
  }
}
