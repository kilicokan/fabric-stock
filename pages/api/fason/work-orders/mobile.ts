import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Enable CORS for mobile tracker access
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // return only work orders that are assigned to mobile
    const workOrders = await prisma.workOrder.findMany({
      where: { assignedToMobile: true },
      include: {
        fasonTrackings: {
          include: {
            workshop: true
          },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Transform data to match mobile app expectations
    const transformedWorkOrders = workOrders.map(order => {
      // Map status to mobile app format
      const statusMap: { [key: string]: string } = {
        'BEKLIYOR': 'pending',
        'ALINDI': 'in-progress',
        'ATÖLYEDE': 'in-progress',
        'HAZIR': 'completed',
        'TESLIM_EDILDI': 'completed',
        'SORUN_VAR': 'pending'
      };

      // Map priority to mobile app format
      const priorityMap: { [key: string]: string } = {
        'LOW': 'normal',
        'MEDIUM': 'medium',
        'HIGH': 'high',
        'URGENT': 'high'
      };

      // Calculate progress based on status
      const progressMap: { [key: string]: number } = {
        'BEKLIYOR': 0,
        'ALINDI': 25,
        'ATÖLYEDE': 50,
        'HAZIR': 75,
        'TESLIM_EDILDI': 100,
        'SORUN_VAR': 0
      };

      // Calculate remaining days
      let remainingDays = null;
      if (order.deliveryDate) {
        const today = new Date();
        const delivery = new Date(order.deliveryDate);
        const diffTime = delivery.getTime() - today.getTime();
        remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      // Get workshop name from latest tracking
      const latestTracking = order.fasonTrackings?.[0];
      const workshopName = latestTracking?.workshop?.name || '';

      return {
        id: order.id,
        orderNo: order.orderNo,
        productCode: order.productCode,
        productName: order.productName || '',
        quantity: order.quantity,
        customerName: order.customerName || '',
        status: statusMap[order.status] || 'pending',
        priority: priorityMap[order.priority] || 'medium',
        dueDate: order.deliveryDate?.toISOString() || null,
        unit: 'adet',
        workshopName,
        progress: progressMap[order.status] || 0,
        remainingDays,
        createdAt: order.createdAt.toISOString()
      };
    });

    return res.status(200).json({ workOrders: transformedWorkOrders });
  } catch (error) {
    console.error('mobile endpoint error', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
