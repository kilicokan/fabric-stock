import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

interface VirtualTryOnOrderRequest {
  productId: number;
  garmentType: string;
  size: string;
  color: string;
  quantity: number;
  notes?: string;
  virtualTryOnImage: string;
  personImage: string;
}

interface ErrorResponse {
  error: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any | ErrorResponse>
) {
  // Verify token
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (req.method === 'POST') {
    return handleCreateVirtualTryOnOrder(req, res);
  } else if (req.method === 'GET') {
    return handleGetVirtualTryOnOrders(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * POST /api/virtual-tryon-orders
 * Create a new virtual try-on order
 */
async function handleCreateVirtualTryOnOrder(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const {
      productId,
      garmentType,
      size,
      color,
      quantity,
      notes,
      virtualTryOnImage,
      personImage,
    }: VirtualTryOnOrderRequest = req.body;

    // Validate required fields
    if (!productId || !size || !color || !quantity) {
      return res.status(400).json({
        error: 'Missing required fields: productId, size, color, quantity',
      });
    }

    // Fetch product to get model number
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Generate order number
    const orderNo = `VTO-${Date.now()}`;

    // Create customer order with virtual try-on metadata
    const order = await prisma.customerOrder.create({
      data: {
        orderNo,
        customerId: 1, // Default or get from auth context
        items: {
          create: {
            productCode: product.modelNo,
            color,
            description: `${garmentType} - Sanal Deneme`,
            notes: JSON.stringify({
              garmentType,
              virtualTryOnImage,
              personImage,
              tryOnDate: new Date().toISOString(),
            }),
            quantity,
            unit: 'ADET',
            unitPrice: 0, // Virtual try-on orders are free
            totalPrice: 0,
          },
        },
      },
      include: {
        items: true,
      },
    });

    return res.status(201).json({
      success: true,
      orderNo: order.orderNo,
      orderId: order.id,
      message: 'Sanal elbise deneme siparişi oluşturuldu',
    });
  } catch (error: any) {
    console.error('Virtual try-on order creation error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to create virtual try-on order',
    });
  }
}

/**
 * GET /api/virtual-tryon-orders
 * Fetch virtual try-on orders (optional pagination)
 */
async function handleGetVirtualTryOnOrders(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { limit = 10, offset = 0 } = req.query;

    const orders = await prisma.customerOrder.findMany({
      where: {
        items: {
          some: {
            description: {
              contains: 'Sanal Deneme',
            },
          },
        },
      },
      include: {
        items: true,
        customer: true,
      },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.status(200).json({
      success: true,
      orders,
      total: orders.length,
    });
  } catch (error: any) {
    console.error('Fetch virtual try-on orders error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to fetch orders',
    });
  }
}
