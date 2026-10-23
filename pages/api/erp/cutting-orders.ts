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
    const { start_date, end_date } = req.query;

    const where: any = {};
    if (start_date || end_date) {
      where.createdAt = {};
      if (start_date) where.createdAt.gte = new Date(start_date as string);
      if (end_date) where.createdAt.lte = new Date(end_date as string);
    }

    const exits = await prisma.fabricExit.findMany({
      where,
      include: { cuttingTable: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    const lines = exits.map(
      (e) =>
        `- ${e.orderNo} | Model: ${e.modelNo} (${e.modelName || "-"}) | Rapor: ${e.reportNumber || "-"} | Kat: ${e.layerCount} | Masaya: ${e.cuttingTable?.name || "-"} | ${new Date(e.createdAt).toLocaleDateString("tr-TR")}`
    );

    res.status(200).json({
      data: {
        text: exits.length > 0 ? `Bulunan kesim emirleri (${exits.length}):\n${lines.join("\n")}` : "Kesim emri bulunamadi.",
        items: exits.map((e) => ({
          id: e.id,
          orderNo: e.orderNo,
          modelNo: e.modelNo,
          modelName: e.modelName,
          reportNumber: e.reportNumber,
          layerCount: e.layerCount,
          cuttingTable: e.cuttingTable?.name,
          createdAt: e.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("ERP Cutting Orders error:", error);
    res.status(500).json({ error: "Kesim emirleri sorgulanirken hata olustu" });
  }
}