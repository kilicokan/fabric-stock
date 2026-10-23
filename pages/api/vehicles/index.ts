import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { withCors } from '@/lib/cors';

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    const authHeader = req.headers.authorization;
    console.log('🚗 Vehicle API - Authorization header:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader) {
      console.log('❌ No auth header');
      return res.status(401).json({ error: 'Token gerekli' });
    }

    const user = verifyToken(authHeader);
    console.log('🔐 Token verification result:', user ? 'Valid' : 'Invalid');
    
    if (!user) {
      console.log('❌ Invalid token');
      return res.status(401).json({ error: 'Geçersiz token' });
    }

    if (req.method === 'GET') {
      // Tüm araçları listele
      const vehicles = await prisma.vehicle.findMany({
        include: {
          assignedUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          locations: {
            orderBy: { timestamp: 'desc' },
            take: 1, // Son konumu al
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return res.status(200).json({
        success: true,
        data: vehicles,
      });
    }

    if (req.method === 'POST') {
      // Yeni araç ekle
      const { licensePlate, model, color, capacity, assignedUserId } = req.body;

      if (!licensePlate) {
        return res.status(400).json({ error: 'Plaka gerekli' });
      }

      // Plaka benzersizliğini kontrol et
      const existing = await prisma.vehicle.findUnique({
        where: { licensePlate },
      });

      if (existing) {
        return res.status(400).json({ error: 'Bu plaka zaten kayıtlı' });
      }

      const vehicle = await prisma.vehicle.create({
        data: {
          licensePlate,
          model,
          color,
          capacity: capacity ? parseFloat(capacity) : undefined,
          assignedUserId: assignedUserId ? parseInt(assignedUserId) : undefined,
        },
        include: {
          assignedUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          locations: true,
        },
      });

      return res.status(201).json({
        success: true,
        data: vehicle,
      });
    }

    if (req.method === 'PUT') {
      // Araç güncelle
      const { id, licensePlate, model, color, capacity, assignedUserId, isActive } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'ID gerekli' });
      }

      // Eğer plaka değiştiriliyorsa, benzersizliğini kontrol et
      if (licensePlate) {
        const existing = await prisma.vehicle.findFirst({
          where: {
            licensePlate,
            id: { not: parseInt(id) },
          },
        });

        if (existing) {
          return res.status(400).json({ error: 'Bu plaka zaten kayıtlı' });
        }
      }

      const vehicle = await prisma.vehicle.update({
        where: { id: parseInt(id) },
        data: {
          ...(licensePlate && { licensePlate }),
          ...(model && { model }),
          ...(color && { color }),
          ...(capacity && { capacity: parseFloat(capacity) }),
          ...(assignedUserId !== undefined && {
            assignedUserId: assignedUserId ? parseInt(assignedUserId) : null,
          }),
          ...(isActive !== undefined && { isActive }),
        },
        include: {
          assignedUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          locations: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
      });

      return res.status(200).json({
        success: true,
        data: vehicle,
      });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'ID gerekli' });
      }

      await prisma.vehicle.delete({
        where: { id: parseInt(id) },
      });

      return res.status(200).json({
        success: true,
        message: 'Araç silindi',
      });
    }

    return res.status(405).json({ error: 'Method izin verilmiyor' });
  } catch (error) {
    console.error('Vehicle API hatası:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Sunucu hatası',
    });
  }
};

export default withCors(handler);
