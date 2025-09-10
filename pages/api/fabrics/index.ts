import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "../../../lib/prisma"; // prisma client buradan import edilmeli

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    try {
      const { name, color, quantity } = req.body;

      if (!name || !color || !quantity) {
        return res.status(400).json({ message: "Tüm alanlar gerekli." });
      }

      const fabric = await prisma.fabric.create({
        data: {
          name,
          color,
          quantity: parseFloat(quantity),
        },
      });

      return res.status(201).json(fabric);
    } catch (error: any) {
      console.error("Kumaş ekleme hatası:", error);
      return res.status(500).json({ message: "Kumaş eklenemedi", error: error.message });
    }
  }

  if (req.method === "GET") {
    try {
      const fabrics = await prisma.fabric.findMany({
        orderBy: { createdAt: "desc" },
      });
      return res.status(200).json(fabrics);
    } catch (error: any) {
      console.error("Kumaş listeleme hatası:", error);
      return res.status(500).json({ message: "Kumaşlar alınamadı", error: error.message });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ message: `Method ${req.method} not allowed` });
}
