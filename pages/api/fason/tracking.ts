import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

const verifyToken = (req: NextApiRequest) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new Error('Token bulunamadı');
  
  return jwt.verify(token, process.env.JWT_SECRET || 'secret-key') as any;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const user = verifyToken(req);

    switch (req.method) {
      case 'GET':
        return handleGet(req, res, user);
      case 'POST':
        return handlePost(req, res, user);
      case 'PUT':
        return handlePut(req, res, user);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// Takip kayıtlarını listele (mobil app için)
async function handleGet(req: NextApiRequest, res: NextApiResponse, user: any) {
  const { workOrderId, userId, processType, status } = req.query;

  const where: any = {};
  if (workOrderId) where.workOrderId = parseInt(workOrderId as string);
  if (userId) where.userId = parseInt(userId as string);
  if (processType) where.processType = processType;
  if (status) where.status = status;

  // Eğer kullanıcı FASON_TRACKER ise sadece kendi kayıtlarını görebilir
  if (user.role === 'FASON_TRACKER') {
    where.userId = user.id;
  }

  const trackings = await prisma.fasonTracking.findMany({
    where,
    include: {
      workOrder: true,
      workshop: true,
      user: { select: { name: true, email: true, phone: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  return res.json(trackings);
}

// Yeni takip kaydı oluştur (mobil app'den)
async function handlePost(req: NextApiRequest, res: NextApiResponse, user: any) {
  const {
    workOrderId,
    workshopId,
    processType,
    status,
    startDate,
    endDate,
    pickupDate,
    deliveryDate,
    notes,
    problemNotes,
    latitude,
    longitude
  } = req.body;

  // Validasyon: Gerekli alanları kontrol et
  if (!workOrderId || !processType || !status) {
    return res.status(400).json({ error: 'workOrderId, processType ve status alanları zorunludur' });
  }

  // WorkOrder'ın varlığını kontrol et
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: parseInt(workOrderId) }
  });

  if (!workOrder) {
    return res.status(404).json({ error: 'İş emri bulunamadı' });
  }

  // Workshop varsa varlığını kontrol et
  if (workshopId) {
    const workshop = await prisma.fasonWorkshop.findUnique({
      where: { id: parseInt(workshopId) }
    });
    if (!workshop) {
      return res.status(404).json({ error: 'Atölye bulunamadı' });
    }
  }

  const tracking = await prisma.fasonTracking.create({
    data: {
      workOrderId: parseInt(workOrderId),
      workshopId: workshopId ? parseInt(workshopId) : null,
      userId: user.id, // JWT'den gelen kullanıcı ID
      processType,
      status,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      pickupDate: pickupDate ? new Date(pickupDate) : null,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
      notes,
      problemNotes,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null
    }
  });

  // İş emrinin durumunu güncelle
  if (status === 'TESLIM_EDILDI') {
    const nextStatus = getNextOrderStatus(processType);
    if (nextStatus) {
      await prisma.workOrder.update({
        where: { id: parseInt(workOrderId) },
        data: { status: nextStatus }
      });
    }
  }

  return res.status(201).json(tracking);
}

// Takip kaydı güncelle
async function handlePut(req: NextApiRequest, res: NextApiResponse, user: any) {
  const { id, ...updateData } = req.body;

  // Kullanıcı sadece kendi kayıtlarını güncelleyebilir (FASON_TRACKER ise)
  const where: any = { id: parseInt(id) };
  if (user.role === 'FASON_TRACKER') {
    where.userId = user.id;
  }

  const tracking = await prisma.fasonTracking.update({
    where,
    data: {
      ...updateData,
      startDate: updateData.startDate ? new Date(updateData.startDate) : undefined,
      endDate: updateData.endDate ? new Date(updateData.endDate) : undefined,
      pickupDate: updateData.pickupDate ? new Date(updateData.pickupDate) : undefined,
      deliveryDate: updateData.deliveryDate ? new Date(updateData.deliveryDate) : undefined,
      latitude: updateData.latitude ? parseFloat(updateData.latitude) : undefined,
      longitude: updateData.longitude ? parseFloat(updateData.longitude) : undefined,
      updatedAt: new Date()
    }
  });

  return res.json(tracking);
}

// Süreç durumuna göre iş emrinin bir sonraki durumunu belirle
function getNextOrderStatus(processType: string): any {
  const statusMap: { [key: string]: any } = {
    'KESIM': 'DIKIM',
    'DIKIM': 'BASKI_NAKIS',
    'BASKI_NAKIS': 'UTU',
    'UTU': 'TESLIM_EDILDI'
  };

  return statusMap[processType] || null;
}
