import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from "@/lib/prisma";
import { verifyToken } from '@/lib/auth';
import { parseStoredRoute } from '@/lib/product-route';


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Enable CORS for mobile tracker access
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
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
    const user = verifyToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const mobileUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isActive: true, mobileAccess: true },
    });
    if (!mobileUser?.isActive || !mobileUser.mobileAccess) {
      return res.status(403).json({ error: 'Mobil erişim yetkiniz bulunmuyor.' });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const where = {
      assignedToMobile: true,
      assignedUserId: user.id,
    };

    const [workOrders, total] = await Promise.all([
      prisma.workOrder.findMany({
        where,
        include: {
          fasonTrackings: {
            include: {
              workshop: true,
              cuttingTable: {
                select: { id: true, name: true }
              }
            },
            orderBy: { createdAt: 'desc' },
            take: 5 // Limit nested relations to latest 5
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip
      }),
      prisma.workOrder.count({
        where
      })
    ]);

    // Ürün rotalarını modelNo üzerinden topluca getir
    const routeProducts = await prisma.product.findMany({
      where: { modelNo: { in: [...new Set(workOrders.map(o => o.productCode))] } },
      select: { modelNo: true, routeSteps: true }
    });
    const routeByModel = new Map(routeProducts.map(p => [p.modelNo, parseStoredRoute(p.routeSteps)]));

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
        assignedToMobile: order.assignedToMobile,
        assignedUserId: order.assignedUserId,
        workOrderStatus: order.status,
        centralWarehouseReceived: order.centralWarehouseReceived,
        centralWarehouseStainedQuantity: order.centralWarehouseStainedQuantity,
        centralWarehouseDefectiveQuantity: order.centralWarehouseDefectiveQuantity,
        centralWarehouseRepairQuantity: order.centralWarehouseRepairQuantity,
        centralWarehouseLostQuantity: order.centralWarehouseLostQuantity,
        productCode: order.productCode,
        productName: order.productName || '',
        routeSteps: routeByModel.get(order.productCode) ?? [],
        quantity: order.quantity,
        customerName: order.customerName || '',
        status: statusMap[order.status] || 'pending',
        priority: priorityMap[order.priority] || 'medium',
        dueDate: order.deliveryDate?.toISOString() || null,
        unit: 'adet',
        workshopName,
        cuttingTable: latestTracking?.cuttingTable
          ? { id: latestTracking.cuttingTable.id, name: latestTracking.cuttingTable.name }
          : null,
        fasonTrackings: order.fasonTrackings.map(tracking => ({
          id: tracking.id,
          workOrderId: tracking.workOrderId,
          workshopId: tracking.workshopId,
          assignedQuantity: tracking.assignedQuantity || 0,
          receivedQuantity: tracking.receivedQuantity,
          processType: tracking.processType,
          status: tracking.status,
          unitPrice: tracking.unitPrice,
          cuttingTable: tracking.cuttingTable
            ? { id: tracking.cuttingTable.id, name: tracking.cuttingTable.name }
            : null,
        })),
        progress: progressMap[order.status] || 0,
        remainingDays,
        sewingNotes: order.sewingNotes || null,
        createdAt: order.createdAt.toISOString()
      };
    });

    return res.status(200).json({ 
      workOrders: transformedWorkOrders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('mobile endpoint error', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
