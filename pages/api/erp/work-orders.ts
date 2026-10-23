import type { NextApiRequest, NextApiResponse } from "next";
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
    const { start_date, end_date, status } = req.query;

    const where: any = {};
    if (start_date || end_date) {
      where.createdAt = {};
      if (start_date) where.createdAt.gte = new Date(start_date as string);
      if (end_date) where.createdAt.lte = new Date(end_date as string);
    }
    if (typeof status === "string") {
      where.status = status.toUpperCase();
    }

    const orders = await prisma.workOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { assignedUser: { select: { name: true } } },
    });

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

    const lines = orders.map(
      (o) =>
        `- ${o.orderNo} | ${o.productCode} - ${o.productName || "?"} | Musteri: ${o.customerName || "-"} | Miktar: ${o.quantity} | Durum: ${formatStatus(o.status)} | Atanan: ${o.assignedUser?.name || "-"} | ${new Date(o.createdAt).toLocaleDateString("tr-TR")}`
    );

    res.status(200).json({
      data: {
        text: orders.length > 0 ? `Bulunan is emirleri (${orders.length}):\n${lines.join("\n")}` : "Is emru bulunamadi.",
        items: orders.map((o) => ({
          id: o.id,
          orderNo: o.orderNo,
          productCode: o.productCode,
          productName: o.productName,
          customerName: o.customerName,
          quantity: o.quantity,
          status: formatStatus(o.status),
          assignedUser: o.assignedUser?.name,
          createdAt: o.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("ERP Work Orders error:", error);
    res.status(500).json({ error: "Is emirleri sorgulanirken hata olustu" });
  }
}