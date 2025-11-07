import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // return only work orders that are assigned to mobile
    const workOrders = await prisma.workOrder.findMany({
      where: { assignedToMobile: true },
      select: {
        id: true,
        orderNo: true,
        productCode: true,
        productName: true,
        quantity: true,
        customerName: true,
        status: true,
        deliveryDate: true,
        priority: true,
        assignedToMobile: true,
        assignedUserId: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json(workOrders);
  } catch (error) {
    console.error('mobile endpoint error', error);
    return res.status(500).json({ error: 'Server error' });
  }
}