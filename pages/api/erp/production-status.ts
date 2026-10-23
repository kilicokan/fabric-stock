import type { NextApiRequest, NextApiResponse } from "next";
import type { AccessoryOrder, FabricExit, WorkOrder } from "@prisma/client";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Yalnizca GET metodu destekleniyor" });
  }

  if (!verifyToken(req.headers.authorization)) {
    return res.status(401).json({ error: "Giris gerekli" });
  }

  try {
    const { order_id, work_order_id } = req.query;
    const workOrderId = typeof work_order_id === "string" ? Number(work_order_id) : null;

    if (work_order_id && (!Number.isSafeInteger(workOrderId) || workOrderId <= 0)) {
      return res.status(400).json({ error: "Gecerli bir is emri ID'si gerekli" });
    }

    const formatStatus = (value?: string | null): string => {
      if (!value) return "-";
      const map: Record<string, string> = {
        BEKLIYOR: "Bekliyor",
        ALINDI: "Alindi",
        ATÖLYEDE: "Atolyede",
        HAZIR: "Hazir",
        TESLIM_EDILDI: "Teslim Edildi",
        SORUN_VAR: "Sorun Var",
        IPTAL_EDILDI: "Iptal Edildi",
      };
      return map[value.toUpperCase()] || value;
    };

    let workOrders: WorkOrder[] = [];
    let fabricExits: (FabricExit & { cuttingTable: { name: string } })[] = [];
    let accessoryOrders: AccessoryOrder[] = [];

    if (workOrderId) {
      workOrders = await prisma.workOrder.findMany({
        where: { id: workOrderId },
        take: 1,
      });
    } else if (order_id) {
      workOrders = await prisma.workOrder.findMany({
        where: { orderNo: { contains: order_id as string } },
        take: 5,
      });
    } else {
      [workOrders, fabricExits, accessoryOrders] = await Promise.all([
        prisma.workOrder.findMany({ take: 20, orderBy: { createdAt: "desc" } }),
        prisma.fabricExit.findMany({
          take: 20,
          orderBy: { createdAt: "desc" },
          include: { cuttingTable: { select: { name: true } } },
        }),
        prisma.accessoryOrder.findMany({ take: 20, orderBy: { orderDate: "desc" } }),
      ]);
    }

    const parts: string[] = [];

    if (workOrders.length > 0) {
      const statusCounts = workOrders.reduce<Record<string, number>>((acc, o) => {
        const s = formatStatus(o.status);
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {});

      parts.push(`Is emirleri toplam: ${workOrders.length}`);
      parts.push(...Object.entries(statusCounts).map(([s, c]) => `  - ${s}: ${c}`));

      if (workOrders.length <= 10) {
        parts.push("");
        parts.push("Detay:");
        parts.push(
          ...workOrders.map(
            (o) =>
              `- ${o.orderNo} | ${o.productCode} - ${o.productName || "?"} | Miktar: ${o.quantity} | Durum: ${formatStatus(o.status)}`
          )
        );
      }
    }

    if (fabricExits.length > 0) {
      parts.push(`\nAktif kesim/cikislar: ${fabricExits.length}`);
      if (fabricExits.length <= 10) {
        parts.push(
          ...fabricExits.map(
            (e) =>
              `- ${e.orderNo} | Model: ${e.modelNo} | Kat: ${e.layerCount} | Masaya: ${e.cuttingTable?.name || "-"}`
          )
        );
      }
    }

    if (accessoryOrders.length > 0) {
      parts.push(`\nAksesuar siparisleri: ${accessoryOrders.length}`);
    }

    res.status(200).json({
      data: {
        text: parts.length > 0 ? parts.join("\n") : "Uretim verisi bulunamadi.",
        workOrders: workOrders.map((o) => ({
          id: o.id,
          orderNo: o.orderNo,
          productCode: o.productCode,
          productName: o.productName,
          quantity: o.quantity,
          status: formatStatus(o.status),
        })),
        fabricExits: fabricExits.map((e) => ({
          id: e.id,
          orderNo: e.orderNo,
          modelNo: e.modelNo,
          layerCount: e.layerCount,
        })),
      },
    });
  } catch (error) {
    console.error("ERP Production Status error:", error);
    res.status(500).json({ error: "Uretim durumu sorgulanirken hata olustu" });
  }
}