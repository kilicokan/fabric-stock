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

    const customerWhere: any = {};
    const fabricWhere: any = {};

    if (start_date) {
      customerWhere.createdAt = { ...customerWhere.createdAt, gte: new Date(start_date as string) };
      fabricWhere.createdAt = { ...fabricWhere.createdAt, gte: new Date(start_date as string) };
    }
    if (end_date) {
      customerWhere.createdAt = { ...customerWhere.createdAt, lte: new Date(end_date as string) };
      fabricWhere.createdAt = { ...fabricWhere.createdAt, lte: new Date(end_date as string) };
    }
    if (typeof status === "string") {
      const statusMap: Record<string, any> = {
        bekliyor: { approved: false },
        onaylandi: { approved: true },
        iptal: { approved: false, status: "IPTAL_EDILDI" },
        tamamlandi: { status: "TESLIM_EDILDI" },
      };
      if (statusMap[status]) {
        Object.assign(customerWhere, statusMap[status]);
      }
      if (["bekliyor", "onaylandi", "iptal", "tamamlandi"].includes(status)) {
        fabricWhere.status = status.toUpperCase();
      }
    }

    const [customerOrders, fabricOrders] = await Promise.all([
      prisma.customerOrder.findMany({
        where: customerWhere,
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.fabricOrder.findMany({
        where: fabricWhere,
        include: { fabric: { select: { name: true } }, supplier: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

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

    const parts: string[] = [];
    if (customerOrders.length > 0) {
      parts.push(`Musteri siparisleri (${customerOrders.length}):`);
      parts.push(
        ...customerOrders.map(
          (o) =>
            `- ${o.orderNo} | Musteri: ${o.customer.name} | Durum: ${o.approved ? "Onayli" : "Onay Bekliyor"} | ${new Date(o.createdAt).toLocaleDateString("tr-TR")}`
        )
      );
    }
    if (fabricOrders.length > 0) {
      parts.push(`Kumas siparisleri (${fabricOrders.length}):`);
      parts.push(
        ...fabricOrders.map(
          (o) =>
            `- ${o.orderNumber} | Kumas: ${o.fabric.name} | Tedarikci: ${o.supplier.name} | Miktar: ${o.quantity} ${o.unitType} | Durum: ${o.status}`
        )
      );
    }

    res.status(200).json({
      data: {
        text: parts.length > 0 ? parts.join("\n") : "Siparis bulunamadi.",
        customerOrders: customerOrders.map((o) => ({
          id: o.id,
          orderNo: o.orderNo,
          customer: o.customer.name,
          approved: o.approved,
          createdAt: o.createdAt,
        })),
        fabricOrders: fabricOrders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          fabric: o.fabric.name,
          supplier: o.supplier.name,
          quantity: o.quantity,
          unitType: o.unitType,
          status: o.status,
        })),
      },
    });
  } catch (error) {
    console.error("ERP Orders error:", error);
    res.status(500).json({ error: "Siparisler sorgulanirken hata olustu" });
  }
}