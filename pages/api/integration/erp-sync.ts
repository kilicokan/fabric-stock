import type { NextApiRequest, NextApiResponse } from "next";
import jwt from "jsonwebtoken";
import { FasonTracking, OrderStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getJwtSecret } from "@/lib/runtime-config";

type SyncAction = "sync_status" | "sync_completion";

type SyncRequestBody = {
  action?: SyncAction;
  workOrderId?: number | string;
  status?: string;
  completionData?: Record<string, unknown>;
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

const isSyncAction = (value: unknown): value is SyncAction =>
  value === "sync_status" || value === "sync_completion";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const tokenHeader = req.headers.authorization;
    const token = tokenHeader?.replace(/^Bearer\s+/i, "") || "";

    if (!token) {
      return res.status(401).json({ error: "Token bulunamadi" });
    }

    jwt.verify(token, getJwtSecret());

    const body = (req.body || {}) as SyncRequestBody;
    if (!isSyncAction(body.action)) {
      return res.status(400).json({ error: "Invalid action" });
    }

    const workOrderId = parsePositiveInt(body.workOrderId);
    if (!workOrderId) {
      return res.status(400).json({ error: "workOrderId zorunludur" });
    }

    if (body.action === "sync_status") {
      return syncWorkOrderStatus(workOrderId, body.status, res);
    }

    return syncWorkOrderCompletion(workOrderId, body.completionData || {}, res);
  } catch (error: unknown) {
    console.error("ERP Sync Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function syncWorkOrderStatus(workOrderId: number, status: string | undefined, res: NextApiResponse) {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: {
      fasonTrackings: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!workOrder) {
    return res.status(404).json({ error: "Work order not found" });
  }

  if (!process.env.ERP_API_URL || !process.env.ERP_API_TOKEN) {
    return res.status(503).json({ error: "ERP entegrasyon ayarlari eksik" });
  }

  const erpData = {
    externalErpId: workOrder.externalErpId,
    orderNo: workOrder.orderNo,
    status: status || workOrder.status,
    lastUpdate: new Date().toISOString(),
    tracking: workOrder.fasonTrackings[0] || null,
  };

  try {
    const erpResponse = await fetch(`${process.env.ERP_API_URL}/work-orders/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ERP_API_TOKEN}`,
      },
      body: JSON.stringify(erpData),
    });

    if (!erpResponse.ok) {
      const responseText = await erpResponse.text();
      throw new Error(`ERP API error: ${erpResponse.status} ${responseText}`);
    }

    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        status: mapOrderStatus(status),
        updatedAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Status synced to ERP successfully",
      erpResponse: await erpResponse.json(),
    });
  } catch (fetchError: unknown) {
    console.error("ERP API Error:", fetchError);
    return res.status(502).json({
      error: "Failed to sync with ERP system",
      details: fetchError instanceof Error ? fetchError.message : "Unknown error",
    });
  }
}

async function syncWorkOrderCompletion(
  workOrderId: number,
  completionData: Record<string, unknown>,
  res: NextApiResponse,
) {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: {
      fasonTrackings: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!workOrder) {
    return res.status(404).json({ error: "Work order not found" });
  }

  if (!process.env.ERP_API_URL || !process.env.ERP_API_TOKEN) {
    return res.status(503).json({ error: "ERP entegrasyon ayarlari eksik" });
  }

  const erpData = {
    externalErpId: workOrder.externalErpId,
    orderNo: workOrder.orderNo,
    completionDate: new Date().toISOString(),
    totalProcessTime: calculateTotalProcessTime(workOrder.fasonTrackings),
    processHistory: workOrder.fasonTrackings.map((tracking) => ({
      processType: tracking.processType,
      status: tracking.status,
      startDate: tracking.startDate,
      endDate: tracking.endDate,
      notes: tracking.notes,
      problemNotes: tracking.problemNotes,
    })),
    ...completionData,
  };

  try {
    const erpResponse = await fetch(`${process.env.ERP_API_URL}/work-orders/completion`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ERP_API_TOKEN}`,
      },
      body: JSON.stringify(erpData),
    });

    if (!erpResponse.ok) {
      const responseText = await erpResponse.text();
      throw new Error(`ERP API error: ${erpResponse.status} ${responseText}`);
    }

    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        status: OrderStatus.TESLIM_EDILDI,
        updatedAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Completion data synced to ERP successfully",
      erpResponse: await erpResponse.json(),
    });
  } catch (fetchError: unknown) {
    console.error("ERP API Error:", fetchError);
    return res.status(502).json({
      error: "Failed to sync completion data with ERP system",
      details: fetchError instanceof Error ? fetchError.message : "Unknown error",
    });
  }
}

function calculateTotalProcessTime(trackings: FasonTracking[]): number {
  let totalMinutes = 0;

  trackings.forEach((tracking) => {
    if (tracking.startDate && tracking.endDate) {
      const diffMinutes = (tracking.endDate.getTime() - tracking.startDate.getTime()) / (1000 * 60);
      totalMinutes += diffMinutes;
    }
  });

  return totalMinutes;
}
