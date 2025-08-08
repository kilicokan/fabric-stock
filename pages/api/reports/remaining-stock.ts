import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.entryDate = {};
      if (startDate) dateFilter.entryDate.gte = new Date(startDate as string);
      if (endDate) dateFilter.entryDate.lte = new Date(endDate as string);
    }

    // 📌 Toplam giriş, kullanım ve kalan stok hesaplama
    const fabricTypes = await prisma.fabricType.findMany({
      include: {
        entries: {
          include: { exits: true },
          where: dateFilter,
        },
      },
    });

    const result = fabricTypes.map((type) => {
      const totalEntry = type.entries.reduce((sum, e) => sum + (e.weightKg || 0), 0);
      const totalUsed = type.entries.reduce((sum, e) =>
        sum + e.exits.reduce((esum, ex) => esum + (ex.weightKg || 0), 0), 0);
      const totalRemaining = totalEntry - totalUsed;

      return {
        fabricTypeId: type.id,
        fabricType: type.name,
        totalEntry,
        totalUsed,
        totalRemaining,
      };
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("❌ Stok raporu API hatası:", error);
    res.status(500).json({ error: "Stok raporu alınamadı." });
  }
}
