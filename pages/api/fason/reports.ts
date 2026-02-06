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
    // Get all workshops with their fason trackings and work orders
    const workshops = await prisma.fasonWorkshop.findMany({
      include: {
        fasonTrackings: {
          include: {
            workOrder: true
          }
        }
      }
    });

    const reports: WorkshopReport[] = workshops.map((workshop) => {
      // Get unique work orders from trackings
      const workOrders = workshop.fasonTrackings.map(tracking => tracking.workOrder);
      const uniqueWorkOrders = workOrders.filter((wo, index, self) =>
        self.findIndex(w => w.id === wo.id) === index
      );

      // Calculate current goods (sum of quantities from work orders that are not completed)
      const currentGoods = uniqueWorkOrders
        .filter(wo => wo.status !== 'TESLIM_EDILDI')
        .reduce((sum, wo) => sum + wo.quantity, 0);

      // Calculate unit price (average from work orders, but since unitPrice isn't in WorkOrder, use a default or calculate differently)
      // Note: WorkOrder doesn't have unitPrice in schema, so using 0 for now
      const unitPrice = 0;

      // Calculate total value
      const totalValue = currentGoods * unitPrice;

      // Use balance from workshop model
      const balance = workshop.balance;

      // Get last work date from trackings
      const lastWorkDate = workshop.fasonTrackings.length > 0
        ? workshop.fasonTrackings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt.toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      // Calculate total works and completed works
      const totalWorks = uniqueWorkOrders.length;
      const completedWorks = uniqueWorkOrders.filter(wo => wo.status === 'TESLIM_EDILDI').length;

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
  } catch (error: any) {
    console.error('Fason raporları alınırken hata:', error);
    res.status(500).json({
      message: 'Fason raporları alınırken hata oluştu',
      error: error.message
    });
  } finally {
    await prisma.$disconnect();
  }
}
