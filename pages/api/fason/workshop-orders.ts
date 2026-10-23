import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma, ProcessStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";

type WorkshopOrder = {
  id: number;
  orderNo: string;
  productCode: string;
  productName: string;
  quantity: number;
  customerName: string;
  status: string;
  workshopName: string;
  workshopId: number;
  totalPrice: number;
  assignedQuantity: number;
  unitPrice: number;
  createdAt: string;
  processType: string;
};

type WorkshopOrdersPayload = {
  orders: WorkshopOrder[];
  statistics: {
    total: number;
    byStatus: Record<string, number>;
    totalAmount: number;
    averageAmount: number;
    totalQuantity: number;
  };
  count: number;
};

const PROCESS_STATUS_VALUES = new Set<string>(Object.values(ProcessStatus));

const isProcessStatus = (value: unknown): value is ProcessStatus =>
  typeof value === "string" && PROCESS_STATUS_VALUES.has(value);

const parseOptionalNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json(errorResponse("Method not allowed"));
  }

  const user = verifyToken(req.headers.authorization);
  if (!user) {
    return res.status(401).json(errorResponse("Unauthorized", "UNAUTHORIZED"));
  }

  try {
    return await handleGet(req, res);
  } catch (error: unknown) {
    console.error("Workshop orders API error:", error);
    return res.status(500).json(errorResponse("Internal server error"));
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const { workshopId, status, minQuantity, maxQuantity, minAmount, maxAmount } = req.query;

  const where: Prisma.FasonTrackingWhereInput = {
    workshopId: { not: null },
  };

  if (typeof workshopId === "string" && workshopId.trim()) {
    const workshopIdNumber = parseOptionalNumber(workshopId);
    if (!workshopIdNumber || workshopIdNumber <= 0) {
      return res.status(400).json(errorResponse("Gecersiz workshopId", "VALIDATION_ERROR"));
    }
    where.workshopId = workshopIdNumber;
  }

  if (status !== undefined) {
    if (!isProcessStatus(status)) {
      return res.status(400).json(errorResponse("Gecersiz status", "VALIDATION_ERROR"));
    }
    where.status = status;
  }

  const trackings = await prisma.fasonTracking.findMany({
    where,
    include: {
      workOrder: true,
      workshop: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const workshopOrders: WorkshopOrder[] = trackings.map((tracking) => ({
    id: tracking.workOrder.id,
    orderNo: tracking.workOrder.orderNo,
    productCode: tracking.workOrder.productCode,
    productName: tracking.workOrder.productName || "",
    quantity: tracking.assignedQuantity || tracking.workOrder.quantity,
    customerName: tracking.workOrder.customerName || "",
    status: tracking.status,
    workshopName: tracking.workshop?.name || "",
    workshopId: tracking.workshopId || 0,
    totalPrice: tracking.totalPrice || 0,
    assignedQuantity: tracking.assignedQuantity || 0,
    unitPrice: tracking.unitPrice || 0,
    createdAt: tracking.createdAt.toISOString(),
    processType: tracking.processType,
  }));

  const uniqueOrders = Array.from(new Map(workshopOrders.map((order) => [order.id, order])).values());

  let filtered = uniqueOrders;

  const minQuantityNumber = parseOptionalNumber(minQuantity);
  const maxQuantityNumber = parseOptionalNumber(maxQuantity);
  const minAmountNumber = parseOptionalNumber(minAmount);
  const maxAmountNumber = parseOptionalNumber(maxAmount);

  if (minQuantityNumber !== null) {
    filtered = filtered.filter((order) => order.quantity >= minQuantityNumber);
  }

  if (maxQuantityNumber !== null) {
    filtered = filtered.filter((order) => order.quantity <= maxQuantityNumber);
  }

  if (minAmountNumber !== null) {
    filtered = filtered.filter((order) => order.totalPrice >= minAmountNumber);
  }

  if (maxAmountNumber !== null) {
    filtered = filtered.filter((order) => order.totalPrice <= maxAmountNumber);
  }

  const statistics: WorkshopOrdersPayload["statistics"] = {
    total: filtered.length,
    byStatus: {},
    totalAmount: 0,
    averageAmount: 0,
    totalQuantity: 0,
  };

  filtered.forEach((order) => {
    statistics.byStatus[order.status] = (statistics.byStatus[order.status] || 0) + 1;
    statistics.totalAmount += order.totalPrice;
    statistics.totalQuantity += order.quantity;
  });

  if (filtered.length > 0) {
    statistics.averageAmount = statistics.totalAmount / filtered.length;
  }

  const payload: WorkshopOrdersPayload = {
    orders: filtered,
    statistics,
    count: filtered.length,
  };

  return res.status(200).json(successResponse(payload));
}
