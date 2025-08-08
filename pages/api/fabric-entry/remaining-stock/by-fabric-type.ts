// pages/api/fabric-entry/remaining-stock/by-fabric-type.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { startDate, endDate } = req.query;

    const parsedStart = startDate ? new Date(startDate as string) : undefined;
    const parsedEnd = endDate ? new Date(endDate as string) : undefined;

    const entries = await prisma.fabricEntry.findMany({
      where: {
        ...(parsedStart && { entryDate: { gte: parsedStart } }),
        ...(parsedEnd && { entryDate: { lte: parsedEnd } }),
      },
      include: {
        fabricType: true, // 💡 Gerekli alan
      },
    });

    const exits = await prisma.fabricExit.findMany({
      where: {
        ...(parsedStart && { exitDate: { gte: parsedStart } }),
        ...(parsedEnd && { exitDate: { lte: parsedEnd } }),
      },
      include: {
        fabricEntry: {
          include: {
            fabricType: true,
          },
        },
      },
    });

    const grouped: Record<string, { totalEntry: number; totalUsed: number }> = {};

    entries.forEach(entry => {
      const key = entry.fabricType.name;
      grouped[key] = grouped[key] || { totalEntry: 0, totalUsed: 0 };
      grouped[key].totalEntry += entry.weightKg || 0;
    });

    exits.forEach(exit => {
      const key = exit.fabricEntry.fabricType.name;
      grouped[key] = grouped[key] || { totalEntry: 0, totalUsed: 0 };
      grouped[key].totalUsed += exit.weightKg || 0;
    });

    const result = Object.entries(grouped).map(([fabricType, data]) => ({
      fabricType,
      totalEntry: data.totalEntry,
      totalUsed: data.totalUsed,
      totalRemaining: data.totalEntry - data.totalUsed,
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error("API Error [by-fabric-type]:", error);
    res.status(500).json({ error: "Sunucu hatası" });
  }
}
