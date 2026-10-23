import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const parsePositiveInt = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ message: "Method not allowed" });
  }

  if (!verifyToken(req.headers.authorization)) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const workOrderId = parsePositiveInt(req.body?.workOrderId);
  const cuttingTableId = parsePositiveInt(req.body?.cuttingTableId);
  const requestedWorkshopId =
    typeof req.body?.workshopId === "undefined" || req.body?.workshopId === null || req.body?.workshopId === ""
      ? null
      : parsePositiveInt(req.body?.workshopId);

  if (!workOrderId) {
    return res.status(400).json({ message: "Gecerli workOrderId gerekli" });
  }

  if (!cuttingTableId) {
    return res.status(400).json({ message: "Kesim masasi secilmesi zorunludur" });
  }

  if (req.body?.workshopId && !requestedWorkshopId) {
    return res.status(400).json({ message: "Gecerli workshopId gerekli" });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const workOrder = await tx.workOrder.findUnique({
        where: { id: workOrderId },
        select: {
          id: true,
          orderNo: true,
          quantity: true,
          status: true,
          productCode: true,
          productName: true,
          customerName: true,
        },
      });

      if (!workOrder) {
        throw new Error("WORK_ORDER_NOT_FOUND");
      }

      if (workOrder.status === "TESLIM_EDILDI") {
        throw new Error("WORK_ORDER_CLOSED");
      }

      const existingCuttingTracking = await tx.fasonTracking.findFirst({
        where: {
          workOrderId,
          processType: "KESIM",
          status: { not: "IPTAL_EDILDI" },
        },
        select: {
          id: true,
          workshopId: true,
          status: true,
        },
      });

      if (existingCuttingTracking) {
        throw new Error("ALREADY_ASSIGNED");
      }

      const cuttingTable = await tx.cuttingTable.findUnique({
        where: { id: cuttingTableId },
        select: {
          id: true,
          name: true,
          assignedUserId: true,
          assignedUser: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      });

      if (!cuttingTable) {
        throw new Error("CUTTING_TABLE_NOT_FOUND");
      }

      if (!cuttingTable.assignedUser || cuttingTable.assignedUser.role !== "FASON_TRACKER") {
        throw new Error("CUTTING_TABLE_USER_NOT_ASSIGNED");
      }

      const workshop = requestedWorkshopId
        ? await tx.fasonWorkshop.findUnique({
            where: { id: requestedWorkshopId },
            select: {
              id: true,
              name: true,
              isActive: true,
              specialization: true,
            },
          })
        : await tx.fasonWorkshop.findFirst({
            where: {
              isActive: true,
              specialization: { in: ["KESIM", "TUM"] },
            },
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              isActive: true,
              specialization: true,
            },
          });

      if (!workshop) {
        throw new Error("WORKSHOP_NOT_FOUND");
      }

      if (!workshop.isActive) {
        throw new Error("WORKSHOP_NOT_ACTIVE");
      }

      if (!["KESIM", "TUM"].includes(workshop.specialization)) {
        throw new Error("WORKSHOP_NOT_CUTTING");
      }

      const assignment = await tx.fasonTracking.create({
        data: {
          workOrderId: workOrder.id,
          workshopId: workshop.id,
          cuttingTableId: cuttingTable.id,
          userId: cuttingTable.assignedUser.id,
          processType: "KESIM",
          status: "BEKLIYOR",
          assignedQuantity: workOrder.quantity,
          unitPrice: 0,
          totalPrice: 0,
          notes: req.body?.notes || "Kesim onerilerinden otomatik atandi.",
        },
        select: {
          id: true,
          workOrderId: true,
          workshopId: true,
          cuttingTableId: true,
          processType: true,
          status: true,
          assignedQuantity: true,
          createdAt: true,
        },
      });

      await tx.workOrder.update({
        where: { id: workOrder.id },
        data: {
          status: "ALINDI",
          assignedToMobile: true,
          assignedUserId: cuttingTable.assignedUser.id,
          mobileAssignmentDate: new Date(),
          updatedAt: new Date(),
        },
      });

      return {
        workOrderId: workOrder.id,
        orderNo: workOrder.orderNo,
        workshop: {
          id: workshop.id,
          name: workshop.name,
        },
        cuttingTable: {
          id: cuttingTable.id,
          name: cuttingTable.name,
        },
        assignedUser: {
          id: cuttingTable.assignedUser.id,
          name: cuttingTable.assignedUser.name,
          email: cuttingTable.assignedUser.email,
        },
        assignment,
      };
    });

    return res.status(201).json({
      message: "Is emri kesime atandi",
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "UNKNOWN";

    if (message === "WORK_ORDER_NOT_FOUND") {
      return res.status(404).json({ message: "Is emri bulunamadi" });
    }

    if (message === "WORK_ORDER_CLOSED") {
      return res.status(400).json({ message: "Kapanmis is emri kesime atanamaz" });
    }

    if (message === "CUTTING_TABLE_NOT_FOUND") {
      return res.status(404).json({ message: "Kesim masasi bulunamadi" });
    }

    if (message === "CUTTING_TABLE_USER_NOT_ASSIGNED") {
      return res.status(400).json({ message: "Secilen kesim masasina Fason Takipci kullanicisi eslestirilmemis" });
    }

    if (message === "ALREADY_ASSIGNED") {
      return res.status(409).json({ message: "Bu is emri zaten kesime atanmis" });
    }

    if (message === "WORKSHOP_NOT_FOUND") {
      return res.status(404).json({ message: "Kesim atolyesi bulunamadi" });
    }

    if (message === "WORKSHOP_NOT_ACTIVE") {
      return res.status(400).json({ message: "Secilen atolye aktif degil" });
    }

    if (message === "WORKSHOP_NOT_CUTTING") {
      return res.status(400).json({ message: "Secilen atolyenin uzmanligi kesim degil" });
    }

    console.error("Cutting assignment API error:", error);
    return res.status(500).json({ message: "Kesim atamasi yapilamadi" });
  }
}
