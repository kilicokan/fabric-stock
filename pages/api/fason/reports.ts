import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

interface WorkshopReport {
  id: number;
  name: string;
  specialization: string;
  currentGoods: number;
  unitPrice: number;
  totalValue: number;
  balance: number;
  lastWorkDate: string;
  totalWorks: number;
  completedWorks: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Yalnızca GET metodu destekleniyor.' });
  }

  try {
    // Get all workshops with only required fields to keep payload light
    const workshops = await prisma.fasonWorkshop.findMany({
      select: {
        id: true,
        name: true,
        specialization: true,
        balance: true,
        fasonTrackings: {
          select: {
            createdAt: true,
            workOrder: {
              select: {
                id: true,
                quantity: true,
                status: true
              }
            }
          }
        }
      }
    });

    const reports: WorkshopReport[] = workshops.map((workshop) => {
      const uniqueWorkOrderIds = new Set<number>();
      let currentGoods = 0;
      let totalWorks = 0;
      let completedWorks = 0;
      let lastTrackingDate: Date | null = null;

      for (const tracking of workshop.fasonTrackings) {
        if (!lastTrackingDate || tracking.createdAt > lastTrackingDate) {
          lastTrackingDate = tracking.createdAt;
        }

        const workOrder = tracking.workOrder;
        if (!workOrder || uniqueWorkOrderIds.has(workOrder.id)) {
          continue;
        }

        uniqueWorkOrderIds.add(workOrder.id);
        totalWorks += 1;

        if (workOrder.status === 'TESLIM_EDILDI') {
          completedWorks += 1;
        } else {
          currentGoods += workOrder.quantity || 0;
        }
      }

      // WorkOrder modelinde unitPrice olmadığı için 0 bırakılıyor
      const unitPrice = 0;
      const totalValue = currentGoods * unitPrice;
      const balance = workshop.balance;

      const lastWorkDate = lastTrackingDate
        ? lastTrackingDate.toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      return {
        id: workshop.id,
        name: workshop.name,
        specialization: workshop.specialization,
        currentGoods,
        unitPrice: Math.round(unitPrice * 100) / 100, // Round to 2 decimal places
        totalValue: Math.round(totalValue * 100) / 100,
        balance: Math.round(balance * 100) / 100,
        lastWorkDate,
        totalWorks,
        completedWorks
      };
    });

    res.status(200).json(reports);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Dış Kaynak Üretim raporları alınırken hata:', error);
    res.status(500).json({
      message: 'Dış Kaynak Üretim raporları alınırken hata oluştu',
      error: message
    });
  }
}
