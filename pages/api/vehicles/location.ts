import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Token gerekli' });
    }

    const user = verifyToken(authHeader);
    if (!user) {
      return res.status(401).json({ error: 'Geçersiz token' });
    }

    if (req.method === 'POST') {
      // Yeni konum kaydı ekle (mobil cihazdan)
      const { vehicleId, latitude, longitude, address } = req.body;

      if (!vehicleId || latitude === undefined || longitude === undefined) {
        return res.status(400).json({
          error: 'vehicleId, latitude ve longitude gerekli',
        });
      }

      // Araç kullanıcıya atanmış mı kontrol et
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: parseInt(vehicleId) },
      });

      if (!vehicle) {
        return res.status(404).json({ error: 'Araç bulunamadı' });
      }

      if (vehicle.assignedUserId !== user.id) {
        return res.status(403).json({
          error: 'Bu araçta konumu güncelleyemezsiniz',
        });
      }

      const location = await prisma.vehicleLocation.create({
        data: {
          vehicleId: parseInt(vehicleId),
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          address,
        },
      });

      return res.status(201).json({
        success: true,
        data: location,
      });
    }

    if (req.method === 'GET') {
      // Araç konum geçmişini getir
      const { vehicleId, limit = 50 } = req.query;

      if (!vehicleId) {
        return res.status(400).json({ error: 'vehicleId gerekli' });
      }

      const locations = await prisma.vehicleLocation.findMany({
        where: { vehicleId: parseInt(vehicleId as string) },
        orderBy: { timestamp: 'desc' },
        take: parseInt(limit as string),
      });

      return res.status(200).json({
        success: true,
        data: locations,
      });
    }

    return res.status(405).json({ error: 'Method izin verilmiyor' });
  } catch (error) {
    console.error('Vehicle Location API hatası:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Sunucu hatası',
    });
  }
}
