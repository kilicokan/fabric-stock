import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { TokenPayload, verifyToken } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { OrderStatus, Prisma, ProcessStatus, ProcessType } from '@prisma/client';
import { parseStoredRoute } from '@/lib/product-route';
 
const isOrderStatus = (value: unknown): value is OrderStatus =>
  typeof value === 'string' && Object.values(OrderStatus).includes(value as OrderStatus);

const isProcessStatus = (value: unknown): value is ProcessStatus =>
  typeof value === 'string' && Object.values(ProcessStatus).includes(value as ProcessStatus);

const extractOrderItemId = (externalRef?: string | null): number | null => {
  if (!externalRef) return null;
  const match = externalRef.match(/(?:customer-order:\d+:item:|item:)(\d+)/i);
  if (!match || !match[1]) return null;
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const extractCustomerOrderId = (externalRef?: string | null): number | null => {
  if (!externalRef) return null;
  const match = externalRef.match(/customer-order:(\d+):item:/i);
  if (!match || !match[1]) return null;
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const extractColorFromNotes = (notes?: string | null): string => {
  if (!notes) return '';
  const colorMatch = notes.match(/(Renk|Color)\s*[:\-]?\s*([A-Za-z0-9çşığıöüÇŞİĞÖÜ\s]+)/i);
  if (colorMatch && colorMatch[2]) {
    return colorMatch[2].trim();
  }
  return notes.trim();
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle CORS preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    switch (req.method) {
      case 'GET':
        // GET is public for mobile apps (for listing assignedToMobile orders)
        return await handleGet(req, res, verifyToken(req.headers.authorization));
      case 'POST':
        // POST requires authentication
        const user = verifyToken(req.headers.authorization);
        if (!user) {
          res.status(401).json({ error: 'Invalid token' });
          return;
        }
        return await handlePost(req, res, user);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API Error:', error);
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2022'
    ) {
      return res.status(503).json(
        errorResponse(
          "Veritabani semasi guncel degil. Bekleyen kayipsiz migration'i uygulamak icin `npx prisma migrate deploy` calistirin.",
          'SERVICE_UNAVAILABLE'
        )
      );
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// İş emirlerini listele - WorkOrder'dan çek
async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse,
  user: ReturnType<typeof verifyToken> | null
) {
  const { search, status, assignedToMobile, processType, excludeProcessStatus, page = '1', limit = '20' } = req.query;

  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit as string) || 20));
  const skip = (pageNum - 1) * limitNum;

  // Build where clause for WorkOrder
  const where: Prisma.WorkOrderWhereInput = {};

  if (isOrderStatus(status)) {
    where.status = status;
  }

  // Filter mobile-assigned work orders if requested
  if (assignedToMobile === 'true') {
    if (!user) {
      return res.status(401).json({ error: 'Mobil iş emirlerini görmek için giriş yapmalısınız.' });
    }
    const mobileUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isActive: true, mobileAccess: true },
    });
    if (!mobileUser?.isActive || !mobileUser.mobileAccess) {
      return res.status(403).json({ error: 'Mobil erişim yetkiniz bulunmuyor.' });
    }
    where.assignedToMobile = true;
    where.assignedUserId = user.id;
  }

  const trackingFilter: Prisma.FasonTrackingWhereInput = {};
  if (processType) trackingFilter.processType = processType as ProcessType;
  if (isProcessStatus(excludeProcessStatus)) {
    trackingFilter.status = { not: excludeProcessStatus };
  }
  if (user?.role === 'FASON_TRACKER' && assignedToMobile !== 'true') {
    trackingFilter.userId = user.id;
  }
  if (Object.keys(trackingFilter).length > 0) {
    where.fasonTrackings = {
      some: trackingFilter,
    };
  }

  // Search by order number, product name, or customer name
  if (search) {
    where.OR = [
      { orderNo: { contains: search as string, mode: 'insensitive' } },
      { productName: { contains: search as string, mode: 'insensitive' } },
      { customerName: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  // Fetch from WorkOrder table
  const [workOrders, total] = await Promise.all([
    prisma.workOrder.findMany({
      where,
      include: {
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        fasonTrackings: {
          ...(user?.role === 'FASON_TRACKER' && assignedToMobile !== 'true'
            ? { where: { userId: user.id } }
            : {}),
          include: {
            workshop: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            cuttingTable: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limitNum,
      skip
    }),
    prisma.workOrder.count({ where })
  ]);

  // Fetch product images for all productCodes
  const productCodes = [...new Set(workOrders.map(o => o.productCode).filter(Boolean))];
  const products = await prisma.product.findMany({
    where: { modelNo: { in: productCodes } },
    select: { modelNo: true, image: true, routeSteps: true }
  });
  const productImageMap = Object.fromEntries(products.map(p => [p.modelNo, p.image]));
  const productRouteMap = Object.fromEntries(products.map(p => [p.modelNo, parseStoredRoute(p.routeSteps)]));

const orderItemIds = [...new Set(
  workOrders
  .map(o => extractOrderItemId(o.externalErpId))
  .filter((id): id is number => typeof id === 'number')
  )];
  
  // Extract all customer order IDs to fetch all items (for color variants)
  const customerOrderIds = [...new Set(
  workOrders
  .map(o => extractCustomerOrderId(o.externalErpId))
  .filter((id): id is number => typeof id === 'number')
  )];

  const orderItems = orderItemIds.length
  ? await prisma.customerOrderItem.findMany({
      where: { id: { in: orderItemIds } },
      select: { id: true, color: true, orderId: true }
    })
  : [];

  // Also fetch all items for the customer orders to get color variants
  const allOrderItems = customerOrderIds.length
    ? await prisma.customerOrderItem.findMany({
        where: { orderId: { in: customerOrderIds } },
        select: { id: true, color: true, orderId: true }
      })
    : [];

  const orderItemColorMap = new Map(orderItems.map(item => [item.id, item.color || '']));
  
  // Build color variants map per work order
  const workOrderColorVariantsMap = new Map<number, string[]>();
  allOrderItems.forEach(item => {
    const orderId = item.orderId;
    // Find work orders with this customer order ID
    workOrders.forEach(wo => {
      if (extractCustomerOrderId(wo.externalErpId) === orderId) {
        const existing = workOrderColorVariantsMap.get(wo.id) || [];
        if (item.color && !existing.includes(item.color)) {
          existing.push(item.color);
        }
        workOrderColorVariantsMap.set(wo.id, existing);
      }
    });
  });

// Transform WorkOrder to API format
  const formattedOrders = workOrders.map(order => {
  const orderItemId = extractOrderItemId(order.externalErpId);
  const extractedColor = orderItemColorMap.get(orderItemId ?? -1) || extractColorFromNotes(order.notes);
  const colorVariants = workOrderColorVariantsMap.get(order.id) || [];
  // Ensure the primary color is first in the variants list
  const sortedVariants = extractedColor && colorVariants.includes(extractedColor)
    ? [extractedColor, ...colorVariants.filter(c => c !== extractedColor)]
    : colorVariants;

  return {
    id: order.id,
    orderNo: order.orderNo,
    productCode: order.productCode,
    productName: order.productName || '',
    productImage: productImageMap[order.productCode] || null,
    routeSteps: productRouteMap[order.productCode] || [],
    sewingNotes: order.sewingNotes || null,
    quantity: order.quantity,
    customerName: order.customerName || '',
    status: order.status,
    deliveryDate: order.deliveryDate?.toISOString() || null,
    priority: order.priority || 'MEDIUM',
    notes: order.notes,
    productColor: extractedColor,
    colorVariants: sortedVariants.length > 0 ? sortedVariants : (extractedColor ? [extractedColor] : []),
    externalErpId: order.externalErpId || null,
    assignedToMobile: order.assignedToMobile,
    assignedUserId: order.assignedUserId || null,
    assignedUser: order.assignedUser
      ? {
        id: order.assignedUser.id,
        name: order.assignedUser.name || '',
        email: order.assignedUser.email || ''
      }
      : null,
    fasonTrackings: (order.fasonTrackings || []).map(tracking => ({
      id: tracking.id,
      workOrderId: tracking.workOrderId,
      workshopId: tracking.workshopId,
      workshop: tracking.workshop
        ? {
            id: tracking.workshop.id,
            name: tracking.workshop.name,
            specialization: tracking.workshop.specialization
          }
        : null,
      cuttingTable: tracking.cuttingTable
        ? {
            id: tracking.cuttingTable.id,
            name: tracking.cuttingTable.name
          }
        : null,
      user: tracking.user
        ? {
            id: tracking.user.id,
            name: tracking.user.name || '',
            email: tracking.user.email || ''
          }
        : null,
      assignedQuantity: tracking.assignedQuantity || 0,
      unitPrice: tracking.unitPrice || 0,
      totalPrice: tracking.totalPrice || 0,
      processType: tracking.processType,
      status: tracking.status,
      notes: tracking.notes || '',
      createdAt: tracking.createdAt.toISOString()
    })),
    mobileAssignmentDate: order.mobileAssignmentDate?.toISOString() || null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt?.toISOString() || null,
  };
  });

  // Return in API v2 format for compatibility with mobile app
  return res.json(successResponse(formattedOrders, {
    page: pageNum,
    limit: limitNum,
    total,
  }));
}

// Yeni iş emri oluştur
async function handlePost(req: NextApiRequest, res: NextApiResponse, user: TokenPayload) {
  const {
    orderNo,
    productCode,
    productName,
    quantity,
    customerName,
    customerNames,
    deliveryDate
  } = req.body;

  // Zorunlu alanları kontrol et
  if (!orderNo || !productCode || !quantity) {
    res.status(400).json({ error: 'OrderNo, productCode ve quantity zorunludur' });
    return;
  }

  const normalizedCustomerName =
    Array.isArray(customerNames) && customerNames.length > 0
      ? customerNames
          .filter((name: unknown): name is string => typeof name === 'string' && name.trim().length > 0)
          .join(', ')
      : (typeof customerName === 'string' ? customerName : '');

  const parsedQuantity = Number.parseInt(String(quantity), 10);
  if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
    return res.status(400).json({ error: 'Geçerli bir miktar girilmelidir' });
  }

  const isFasonCutting = req.body.fasonCutting === true || req.body.fasonCutting === 'true';
  const requestedWorkshopId = Number(req.body.workshopId);
  let workshopId: number | null = null;

  if (isFasonCutting) {
    if (!Number.isInteger(requestedWorkshopId) || requestedWorkshopId <= 0) {
      return res.status(400).json({ error: 'Fason kesim için kesim atölyesi seçilmelidir' });
    }

    const workshop = await prisma.fasonWorkshop.findUnique({
      where: { id: requestedWorkshopId },
      select: { id: true, isActive: true, specialization: true },
    });
    if (!workshop) {
      return res.status(404).json({ error: 'Kesim atölyesi bulunamadı' });
    }
    if (!workshop.isActive || !['KESIM', 'TUM'].includes(workshop.specialization)) {
      return res.status(400).json({ error: 'Aktif bir kesim atölyesi seçilmelidir' });
    }
    workshopId = workshop.id;
  }

  const workOrder = await prisma.$transaction(async (tx) => {
    const createdOrder = await tx.workOrder.create({
      data: {
        orderNo,
        productCode,
        productName: productName || '',
        quantity: parsedQuantity,
        customerName: normalizedCustomerName,
        status: 'BEKLIYOR',
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        notes: req.body.notes || '',
        sewingNotes: req.body.sewingNotes || null,
        assignedToMobile: false,
        mobileAssignmentDate: null,
      },
    });

    await tx.fasonTracking.create({
      data: {
        workOrderId: createdOrder.id,
        workshopId,
        userId: user.id,
        processType: 'KESIM',
        status: 'BEKLIYOR',
        assignedQuantity: createdOrder.quantity,
        unitPrice: 0,
        totalPrice: 0,
      },
    });

    return tx.workOrder.findUnique({
      where: { id: createdOrder.id },
      include: {
        fasonTrackings: {
          include: {
            workshop: true,
            cuttingTable: { select: { id: true, name: true } },
            user: true,
          },
        },
      },
    });
  });

  return res.status(201).json(successResponse(workOrder));
}

// Mobil uygulama için sadece mobil atanmış işleri dönen PUBLIC endpoint
export async function mobileWorkOrdersPublicHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Only GET method allowed' });
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const token = req.headers.authorization ? verifyToken(req.headers.authorization) : null;
    if (req.headers.authorization && !token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (token) {
      const mobileUser = await prisma.user.findUnique({
        where: { id: token.id },
        select: { isActive: true, mobileAccess: true },
      });
      if (!mobileUser?.isActive || !mobileUser.mobileAccess) {
        return res.status(403).json({ error: 'Mobil erişim yetkiniz bulunmuyor.' });
      }
    }
    const workOrders = await prisma.workOrder.findMany({
      where: {
        assignedToMobile: true,
        ...(token ? { assignedUserId: token.id } : {}),
      },
      include: {
        fasonTrackings: {
          include: {
            workshop: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 10
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    // History transform et - Her adımda kim teslim etti ve kim aldı bilgisini ekle
    const formattedWorkOrders = workOrders.map(order => {
      const history = order.fasonTrackings.map(tracking => ({
        workshopName: tracking.workshop?.name || 'Bilinmeyen',
        processType: tracking.processType,
        status: tracking.status,
        date: tracking.createdAt.toISOString(),
        notes: tracking.notes || '',
        userName: tracking.user?.name || tracking.user?.email || 'Bilinmeyen',
        userId: tracking.user?.id || null
      }));

      return {
        id: order.id,
        orderNo: order.orderNo,
        productCode: order.productCode,
        productName: order.productName || '',
        quantity: order.quantity,
        customerName: order.customerName || '',
        status: order.status,
        deliveryDate: order.deliveryDate?.toISOString() || null,
        priority: order.priority || 'MEDIUM',
        notes: order.notes || '',
        assignedToMobile: order.assignedToMobile,
        assignedUserId: order.assignedUserId,
        mobileAssignmentDate: order.mobileAssignmentDate?.toISOString() || null,
        createdAt: order.createdAt.toISOString(),
        workshopHistory: history,
        lastWorkshop: history[0] || null
      };
    });

    res.status(200).json(successResponse({ workOrders: formattedWorkOrders }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
