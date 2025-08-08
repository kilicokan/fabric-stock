import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    try {
      const { fabricType, color, weightKg, lengthMeter } = req.body;

      const newEntry = await prisma.fabricEntry.create({
        data: {
          fabricType,
          color,
          weightKg: weightKg ? parseFloat(weightKg) : null,
          lengthMeter: lengthMeter ? parseFloat(lengthMeter) : null,
        },
      });

      return res.status(200).json(newEntry);
    } catch (error) {
      console.error("Kumaş girişi hatası:", error);
      return res.status(500).json({ error: "Kayıt sırasında hata oluştu" });
    }
  } else {
    return res.status(405).json({ error: "Yalnızca POST metodu destekleniyor" });
  }
}
