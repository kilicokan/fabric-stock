import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    try {
      // Hem giriş hem çıkışları alıyoruz (örnek basit rapor)
      const entries = await prisma.fabricEntry.findMany();
      const exits = await prisma.fabricExit.findMany();

      // Burada daha gelişmiş stok hesaplaması yapılabilir
      return res.status(200).json([...entries, ...exits]);
    } catch (error) {
      console.error("Rapor alma hatası:", error);
      return res.status(500).json({ error: "Rapor alınamadı" });
    }
  } else {
    return res.status(405).json({ error: "Yalnızca GET metodu destekleniyor" });
  }
}
