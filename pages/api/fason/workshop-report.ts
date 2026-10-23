import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

interface WorkshopServiceCost {
  workshopId: number;
  workshopName: string;
  workshopType: string;
  cost: number;
  quantity: number;
}

interface WorkOrderReport {
  id: number;
  modelCode: string;
  modelName: string;
  cuttingNumber: string;
  slipNumber: string;
  totalQuantity: number;
  services: WorkshopServiceCost[];
  totalCost: number;
  createdAt: string;
  status: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authUser = verifyToken(req.headers.authorization);
    if (!authUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { orderId } = req.query;
    const parsedOrderId = Number(orderId);
    if (!Number.isInteger(parsedOrderId) || parsedOrderId <= 0) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    const workOrder = await prisma.workOrder.findUnique({
      where: { id: parsedOrderId },
      include: {
        fasonTrackings: {
          include: {
            workshop: true,
          },
        },
      },
    });

    if (!workOrder) {
      return res.status(404).json({ error: 'Work order not found' });
    }

    const serviceMap = new Map<number, WorkshopServiceCost>();

    workOrder.fasonTrackings.forEach((tracking) => {
      if (!tracking.workshop) return;

      const workshopId = tracking.workshop.id;
      const trackingCost = Number(tracking.totalPrice || 0);
      const trackingQuantity = Number(tracking.receivedQuantity ?? tracking.assignedQuantity ?? 0);

      if (!serviceMap.has(workshopId)) {
        serviceMap.set(workshopId, {
          workshopId,
          workshopName: tracking.workshop.name,
          workshopType: tracking.workshop.specialization,
          cost: trackingCost,
          quantity: trackingQuantity,
        });
        return;
      }

      const existing = serviceMap.get(workshopId)!;
      existing.cost += trackingCost;
      existing.quantity += trackingQuantity;
    });

    const services = Array.from(serviceMap.values());
    const totalCost = services.reduce((sum, service) => sum + service.cost, 0);

    const report: WorkOrderReport = {
      id: workOrder.id,
      modelCode: workOrder.productCode,
      modelName: workOrder.productName || '',
      cuttingNumber: workOrder.orderNo,
      slipNumber: '',
      totalQuantity: workOrder.quantity || 0,
      services,
      totalCost,
      createdAt: workOrder.createdAt.toISOString(),
      status: workOrder.status,
    };

    return res.status(200).json({ report });
  } catch (error) {
    console.error('Workshop report error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
