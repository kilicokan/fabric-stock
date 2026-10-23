import type { NextApiRequest, NextApiResponse } from "next";
import { ProcessStatus, ProcessType } from "@prisma/client";
import prisma from "@/lib/prisma";

type CompletedWorkOrder = {
  id: number;
  workshopName: string;
  productName: string;
  receivedQuantity: number;
  defectiveQuantity: number;
  unitPrice: number;
  processType: string;
  completedDate: string;
  status: string;
};

const PROCESS_TYPE_VALUES = new Set<string>(Object.values(ProcessType));

const isProcessType = (value: unknown): value is ProcessType =>
  typeof value === "string" && PROCESS_TYPE_VALUES.has(value);

const COMPLETED_STATUSES: ProcessStatus[] = [ProcessStatus.HAZIR, ProcessStatus.TESLIM_EDILDI];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const searchQuery = typeof req.query.searchQuery === "string" ? req.query.searchQuery.trim() : "";
    const processType = req.query.processType;

    const where: {
      status: { in: ProcessStatus[] };
      processType?: ProcessType;
      workshopId: { not: null };
    } = {
      status: { in: COMPLETED_STATUSES },
      workshopId: { not: null },
    };

    if (processType && processType !== "all") {
      if (!isProcessType(processType)) {
        return res.status(400).json({ error: "Gecersiz processType" });
      }
      where.processType = processType;
    }

    const trackings = await prisma.fasonTracking.findMany({
      where,
      include: {
        workshop: {
          select: { name: true },
        },
        workOrder: {
          select: {
            orderNo: true,
            productName: true,
            productCode: true,
            quantity: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    let completedOrders: CompletedWorkOrder[] = trackings.map((tracking) => {
      const assigned = tracking.assignedQuantity ?? tracking.workOrder.quantity;
      const received = tracking.receivedQuantity ?? assigned;
      const defective = Math.max((assigned || 0) - (received || 0), 0);

      return {
        id: tracking.id,
        workshopName: tracking.workshop?.name || "Bilinmiyor",
        productName: tracking.workOrder.productName || tracking.workOrder.productCode || "Urun",
        receivedQuantity: received,
        defectiveQuantity: defective,
        unitPrice: tracking.unitPrice || 0,
        processType: tracking.processType,
        completedDate: (tracking.endDate || tracking.updatedAt).toISOString(),
        status: tracking.status,
      };
    });

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      completedOrders = completedOrders.filter((order) =>
        order.workshopName.toLowerCase().includes(query) ||
        order.productName.toLowerCase().includes(query),
      );
    }

    return res.status(200).json({
      success: true,
      data: completedOrders,
      total: completedOrders.length,
    });
  } catch (error: unknown) {
    console.error("Completed reports error:", error);
    return res.status(500).json({
      error: "Failed to fetch completed reports",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
