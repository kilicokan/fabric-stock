import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id || Array.isArray(id)) return res.status(400).json({ error: 'Invalid id' });

  const numericId = parseInt(id as string, 10);
  if (Number.isNaN(numericId)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const workOrder = await prisma.workOrder.findFirst({
      where: { id: numericId, assignedToMobile: true },
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
      }
    });

    if (!workOrder) return res.status(404).json({ error: 'Not found' });

    return res.status(200).json(workOrder);
  } catch (err) {
    console.error('mobile single endpoint error', err);
    return res.status(500).json({ error: 'Server error' });
  }
}