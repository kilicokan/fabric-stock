import { prisma } from "../../../lib/prisma";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const { name, color, weightKg } = req.body;

    try {
      // Kumaş türü var mı kontrol et
      let fabricType = await prisma.fabricType.findFirst({
        where: { name, color }
      });

      // Yoksa oluştur
      if (!fabricType) {
        fabricType = await prisma.fabricType.create({
          data: { name, color }
        });
      }

      // Kumaş giriş kaydı oluştur
      const entry = await prisma.fabricEntry.create({
        data: {
          fabricTypeId: fabricType.id,
          weightKg: parseFloat(weightKg)
        }
      });

      res.status(200).json(entry);
    } catch (error) {
      console.error("Kumaş girişi hatası:", error);
      res.status(500).json({ error: "Sunucu hatası" });
    }

  } else {
    res.status(405).end(); // Method Not Allowed
  }
}
