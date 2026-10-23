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
    const { product_code, product_name } = req.query;

    const where: any = {};
    if (product_code) {
      where.code = { contains: product_code as string, mode: "insensitive" };
    }
    if (product_name) {
      where.name = { contains: product_name as string, mode: "insensitive" };
    }

    const fabrics = await prisma.fabric.findMany({
      where,
      include: { warehouse: { select: { name: true } } },
      orderBy: { stockQuantity: "desc" },
      take: 50,
    });

    const lines = fabrics.map((f) => {
      const wh = f.warehouse?.name || "-";
      return `${f.name} (${f.code || "kod yok"}): ${f.stockQuantity} ${f.unit || "kg"} | Depo: ${wh}`;
    });

    res.status(200).json({
      data: {
        text: fabrics.length > 0
          ? `Bulunan kumas stoklari (${fabrics.length}):\n${lines.join("\n")}`
          : "Kumas stogu bulunamadi.",
        items: fabrics.map((f) => ({
          id: f.id,
          name: f.name,
          code: f.code,
          stockQuantity: f.stockQuantity,
          unit: f.unit,
          warehouse: f.warehouse?.name,
        })),
      },
    });
  } catch (error) {
    console.error("ERP Stock error:", error);
    res.status(500).json({ error: "Stok sorgulanirken hata olustu" });
  }
}