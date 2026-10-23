import type { NextApiRequest, NextApiResponse } from "next";
import { OrderStatus } from "@prisma/client";
import prisma from "@/lib/prisma";

type WebhookAction = "create" | "update" | "delete";

type IncomingWorkOrder = {
  externalErpId?: string;
  orderNo?: string;
  productCode?: string;
  productName?: string | null;
  quantity?: number | string;
  customerName?: string | null;
  deliveryDate?: string | null;
  notes?: string | null;
  status?: string;
};

type WebhookBody = {
  action?: WebhookAction;
  workOrder?: IncomingWorkOrder;
};

const ORDER_STATUS_VALUES = new Set<string>(Object.values(OrderStatus));

const resolveAtolyeStatus = (): OrderStatus => {
  const status = Object.values(OrderStatus).find((item) => item.toUpperCase().includes("LYEDE"));
  return (status as OrderStatus | undefined) || OrderStatus.BEKLIYOR;
};

const mapOrderStatus = (rawStatus: string | undefined): OrderStatus => {
  if (!rawStatus) return OrderStatus.BEKLIYOR;

  const normalized = rawStatus.trim().toUpperCase();
  const mapped =
    {
      BEKLIYOR: OrderStatus.BEKLIYOR,
      KESIM: OrderStatus.ALINDI,
      ALINDI: OrderStatus.ALINDI,
      DIKIM: resolveAtolyeStatus(),
      ATOLYEDE: resolveAtolyeStatus(),
      BASKI_NAKIS: OrderStatus.HAZIR,
      HAZIR: OrderStatus.HAZIR,
      TESLIM_EDILDI: OrderStatus.TESLIM_EDILDI,
      TESLIM: OrderStatus.TESLIM_EDILDI,
      SORUN_VAR: OrderStatus.SORUN_VAR,
    }[normalized] || normalized;

  return ORDER_STATUS_VALUES.has(mapped) ? (mapped as OrderStatus) : OrderStatus.BEKLIYOR;
};

const parsePositiveInt = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
};

const parseOptionalDate = (value: unknown): Date | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isWebhookAction = (value: unknown): value is WebhookAction =>
  value === "create" || value === "update" || value === "delete";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = req.headers["x-api-key"];
    const apiKeyValue = Array.isArray(apiKey) ? apiKey[0] : apiKey;

    if (!apiKeyValue || apiKeyValue !== process.env.ERP_WEBHOOK_API_KEY) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    const body = (req.body || {}) as WebhookBody;

    if (!isWebhookAction(body.action)) {
      return res.status(400).json({ error: "Invalid action" });
    }

    const workOrder = body.workOrder || {};

    if (body.action === "create") {
      return createWorkOrder(workOrder, res);
    }

    if (body.action === "update") {
      return updateWorkOrder(workOrder, res);
    }

    return deleteWorkOrder(workOrder.externalErpId, res);
  } catch (error: unknown) {
    console.error("ERP Webhook Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function createWorkOrder(orderData: IncomingWorkOrder, res: NextApiResponse) {
  const externalErpId = String(orderData.externalErpId || "").trim();
  const orderNo = String(orderData.orderNo || "").trim();
  const productCode = String(orderData.productCode || "").trim();
  const quantity = parsePositiveInt(orderData.quantity);

  if (!externalErpId || !orderNo || !productCode || !quantity) {
    return res.status(400).json({
      error: "externalErpId, orderNo, productCode ve quantity zorunludur",
    });
  }

  const existingOrder = await prisma.workOrder.findFirst({
    where: { externalErpId },
    select: { id: true },
  });

  if (existingOrder) {
    return res.status(409).json({
      error: "Work order already exists",
      workOrderId: existingOrder.id,
    });
  }

  const workOrder = await prisma.workOrder.create({
    data: {
      externalErpId,
      orderNo,
      productCode,
      productName: orderData.productName || null,
      quantity,
      customerName: orderData.customerName || null,
      deliveryDate: parseOptionalDate(orderData.deliveryDate),
      notes: orderData.notes || null,
      status: mapOrderStatus(orderData.status),
    },
    select: { id: true },
  });

  return res.status(201).json({
    success: true,
    workOrderId: workOrder.id,
    message: "Work order created successfully",
  });
}

async function updateWorkOrder(orderData: IncomingWorkOrder, res: NextApiResponse) {
  const externalErpId = String(orderData.externalErpId || "").trim();
  if (!externalErpId) {
    return res.status(400).json({ error: "externalErpId zorunludur" });
  }

  const workOrder = await prisma.workOrder.findFirst({
    where: { externalErpId },
    select: { id: true },
  });

  if (!workOrder) {
    return res.status(404).json({ error: "Work order not found" });
  }

  const updatePayload: {
    orderNo?: string;
    productCode?: string;
    productName?: string | null;
    quantity?: number;
    customerName?: string | null;
    deliveryDate?: Date | null;
    notes?: string | null;
    status?: OrderStatus;
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };

  if (typeof orderData.orderNo === "string" && orderData.orderNo.trim()) {
    updatePayload.orderNo = orderData.orderNo.trim();
  }

  if (typeof orderData.productCode === "string" && orderData.productCode.trim()) {
    updatePayload.productCode = orderData.productCode.trim();
  }

  if (typeof orderData.productName === "string") {
    updatePayload.productName = orderData.productName.trim() || null;
  }

  const quantity = parsePositiveInt(orderData.quantity);
  if (quantity) {
    updatePayload.quantity = quantity;
  }

  if (typeof orderData.customerName === "string") {
    updatePayload.customerName = orderData.customerName.trim() || null;
  }

  if (orderData.deliveryDate !== undefined) {
    updatePayload.deliveryDate = parseOptionalDate(orderData.deliveryDate);
  }

  if (typeof orderData.notes === "string") {
    updatePayload.notes = orderData.notes.trim() || null;
  }

  if (typeof orderData.status === "string" && orderData.status.trim()) {
    updatePayload.status = mapOrderStatus(orderData.status);
  }

  const updatedOrder = await prisma.workOrder.update({
    where: { id: workOrder.id },
    data: updatePayload,
    select: { id: true },
  });

  return res.status(200).json({
    success: true,
    workOrderId: updatedOrder.id,
    message: "Work order updated successfully",
  });
}

async function deleteWorkOrder(externalErpId: string | undefined, res: NextApiResponse) {
  const normalizedExternalId = String(externalErpId || "").trim();
  if (!normalizedExternalId) {
    return res.status(400).json({ error: "externalErpId zorunludur" });
  }

  const workOrder = await prisma.workOrder.findFirst({
    where: { externalErpId: normalizedExternalId },
    select: { id: true },
  });

  if (!workOrder) {
    return res.status(404).json({ error: "Work order not found" });
  }

  await prisma.fasonTracking.deleteMany({
    where: { workOrderId: workOrder.id },
  });

  await prisma.workOrder.delete({
    where: { id: workOrder.id },
  });

  return res.status(200).json({
    success: true,
    message: "Work order deleted successfully",
  });
}
