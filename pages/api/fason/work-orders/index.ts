import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { NextApiRequest, NextApiResponse } from 'next';

const prisma = new PrismaClient();

// JWT token doğrulama middleware
const verifyToken = (req: NextApiRequest) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new Error('Token bulunamadı');

  return jwt.verify(token, process.env.JWT_SECRET || 'secret-key');
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle CORS preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const user = verifyToken(req);

    switch (req.method) {
      case 'GET':
        return handleGet(req, res, user);
      case 'POST':
        return handlePost(req, res, user);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API Error:', error);
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// İş emirlerini listele
async function handleGet(req: NextApiRequest, res: NextApiResponse, user: any) {
  const { search, status } = req.query;

  const where: any = {};

  if (search) {
    where.OR = [
      { orderNo: { contains: search as string, mode: 'insensitive' } },
      { productCode: { contains: search as string, mode: 'insensitive' } },
      { productName: { contains: search as string, mode: 'insensitive' } },
      { customerName: { contains: search as string, mode: 'insensitive' } }
    ];
  }

  if (status) {
    where.status = status;
  }

  const workOrders = await prisma.workOrder.findMany({
    where,
    include: {
      fasonTrackings: {
        include: {
          workshop: true,
          user: true
        },
        orderBy: {
          createdAt: 'asc'
        }
      },
      assignedUser: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  return res.json({ workOrders });
}

// Yeni iş emri oluştur
async function handlePost(req: NextApiRequest, res: NextApiResponse, user: any) {
  const {
    orderNo,
    productCode,
    productName,
    quantity,
    customerName,
    status,
    deliveryDate,
    priority
  } = req.body;

  // Zorunlu alanları kontrol et
  if (!orderNo || !productCode || !quantity) {
    return res.status(400).json({ error: 'OrderNo, productCode ve quantity zorunludur' });
  }

  const workOrder = await prisma.workOrder.create({
    data: {
      orderNo,
      productCode,
      productName: productName || '',
      quantity: parseInt(quantity),
      customerName: customerName || '',
      status: status || 'BEKLIYOR',
      deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
      notes: req.body.notes || '',
      assignedToMobile: req.body.assignedToMobile || false
    },
    include: {
      fasonTrackings: {
        include: {
          workshop: true,
          user: true
        }
      }
    }
  });

  return res.status(201).json(workOrder);
}

// Mobil uygulama için sadece mobil atanmış işleri dönen PUBLIC endpoint
export async function mobileWorkOrdersPublicHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Only GET method allowed' });
  try {
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
        notes: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ workOrders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
