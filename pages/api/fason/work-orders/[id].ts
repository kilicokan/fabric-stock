import prisma from '@/lib/prisma';
import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken'; // Import the jsonwebtoken library

// JWT token doğrulama middleware
const verifyToken = (req: NextApiRequest) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new Error('Token bulunamadı');

  return jwt.verify(token, process.env.JWT_SECRET || 'secret-key');
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const user = verifyToken(req);

    const { id } = req.query;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const numericId = parseInt(id as string, 10);
    if (Number.isNaN(numericId)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    switch (req.method) {
      case 'GET':
        return await handleGet(req, res, user, numericId);
      case 'PUT':
        return await handlePut(req, res, user, numericId);
      case 'DELETE':
        return await handleDelete(req, res, user, numericId);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// İş emri getir
async function handleGet(req: NextApiRequest, res: NextApiResponse, user: any, id: number) {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id },
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
    }
  });

  if (!workOrder) {
    return res.status(404).json({ error: 'Work order not found' });
  }

  return res.json(workOrder);
}

// İş emri güncelle
const handlePut = async (req: NextApiRequest, res: NextApiResponse, user: any, id: number) => {
  try {
    const { assignedUserId, status, assignedToMobile } = req.body;

    const data: any = {
      updatedAt: new Date()
    };

    if (typeof assignedUserId !== 'undefined') {
      data.assignedUserId = assignedUserId || null;
    }

    if (typeof status !== 'undefined') {
      data.status = status;
    }

    // only set assignedToMobile if provided
    if (typeof assignedToMobile !== 'undefined') {
      data.assignedToMobile = !!assignedToMobile;
    }

    const workOrder = await prisma.workOrder.update({
      where: { id },
      data,
      include: {
        assignedUser: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return res.status(200).json(workOrder);
  } catch (error) {
    console.error('Error updating work order:', error);
    return res.status(500).json({ error: 'Failed to update work order' });
  }
};

// İş emri sil
async function handleDelete(req: NextApiRequest, res: NextApiResponse, user: any, id: number) {
  // Transaction kullanarak ilişkili kayıtları ve iş emrini sil
  await prisma.$transaction(async (tx) => {
    // Önce ilişkili fason track kayıtlarını sil
    await tx.fasonTracking.deleteMany({
      where: { workOrderId: id }
    });

    // Sonra iş emrini sil
    await tx.workOrder.delete({
      where: { id }
    });
  });

  return res.status(204).end();
}
