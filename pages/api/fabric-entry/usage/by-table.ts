// pages/api/fabric-entry/usage/by-table.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { startDate, endDate } = req.query;

    const exits = await prisma.fabricExit.findMany({
      where: {
        ...(startDate && { exitDate: { gte: new Date(startDate as string) } }),
        ...(endDate && { exitDate: { lte: new Date(endDate as string) } }),
      },
    });

    const grouped: Record<string, number> = {};

    exits.forEach(exit => {
      const key = exit.cuttingTable;
      if (!key) return;
      grouped[key] = (grouped[key] || 0) + (exit.weightKg || 0);
    });

    const result = Object.entries(grouped).map(([cuttingTable, totalUsed]) => ({
      cuttingTable,
      totalUsed,
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error("API Error [by-table]:", error);
    res.status(500).json({ error: "Sunucu hatası" });
  }
}
