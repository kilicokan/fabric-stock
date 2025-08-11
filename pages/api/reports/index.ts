import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const entries = await prisma.fabricEntry.findMany({
      include: {
        fabricType: true,
        color: true,
      },
    });

    const exits = await prisma.fabricExit.findMany({
      include: {
        fabricType: true,
        color: true,
      },
    });

    // İkisini birleştir
    const allData = [
      ...entries.map((e) => ({
        id: e.id,
        fabricType: e.fabricType,
        color: e.color,
        qty: e.qty,
        date: e.date,
        action: "Giriş",
      })),
      ...exits.map((x) => ({
        id: x.id,
        fabricType: x.fabricType,
        color: x.color,
        qty: x.qty,
        date: x.date,
        action: "Çıkış",
      })),
    ];

    res.status(200).json(allData);
  } catch (error) {
    console.error("API Hatası:", error);
    res.status(500).json({ error: "Rapor verileri alınamadı" });
  }
}
