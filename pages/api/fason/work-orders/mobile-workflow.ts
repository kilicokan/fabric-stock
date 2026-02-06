import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

interface TokenPayload {
  userId: number;
  email: string;
}

const verifyToken = (req: NextApiRequest): TokenPayload => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new Error('Token bulunamadı');
  
  return jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key') as TokenPayload;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const user = verifyToken(req);

    switch (req.method) {
      case 'POST':
        return handlePost(req, res, user);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// Workflow akışı:
// 1. startWorkshop - Atölyede işleme başla (BAŞLADI)
// 2. receiveFromWorkshop - Atölyeden mal teslim al (adet, defo, fire, tamir)
// 3. assignNextWorkshop - Sonraki atölyeye malı ata
// 4. finalReceive - Üretim tamamlandı, mal teslim alındı

async function handlePost(req: NextApiRequest, res: NextApiResponse, user: TokenPayload) {
  const { action, workOrderId, workshopId, quantity, defective, damaged, repaired } = req.body;

  if (!action || !workOrderId) {
    return res.status(400).json({ error: 'action ve workOrderId zorunludur' });
  }

  try {
    switch (action) {
      case 'startWorkshop':
        return await startWorkshop(res, workOrderId, workshopId, user.userId);
      
      case 'receiveFromWorkshop':
        return await receiveFromWorkshop(res, workOrderId, workshopId, quantity, defective, damaged, repaired, user.userId);
      
      case 'assignNextWorkshop':
        return await assignNextWorkshop(res, workOrderId, workshopId, user.userId);
      
      case 'finalReceive':
        return await finalReceive(res, workOrderId, user.userId);
      
      default:
        return res.status(400).json({ error: 'Bilinmeyen aksiyon' });
    }
  } catch (error) {
    console.error('Workflow Error:', error);
    return res.status(500).json({ error: 'Workflow işlemi başarısız' });
  }
}

/**
 * Atölyede işleme başla - Malı atölyeye teslim et
 */
async function startWorkshop(
  res: NextApiResponse,
  workOrderId: number,
  workshopId: number,
  userId: number
) {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: { fasonTrackings: { orderBy: { createdAt: 'desc' } } }
  });

  if (!workOrder) {
    return res.status(404).json({ error: 'İş emri bulunamadı' });
  }

  // Atölye bilgisini getir
  const workshop = await prisma.fasonWorkshop.findUnique({
    where: { id: workshopId }
  });

  if (!workshop) {
    return res.status(404).json({ error: 'Atölye bulunamadı' });
  }

  // Atölye tipine göre ProcessType belirle
  let processType = 'DIKIM';
  if (workshop.specialization === 'UTU') processType = 'UTU';
  else if (workshop.specialization === 'BASKI_NAKIS') processType = 'BASKI_NAKIS';
  else if (workshop.specialization === 'DIKIM') processType = 'DIKIM';

  // FasonTracking kaydı oluştur
  const tracking = await prisma.fasonTracking.create({
    data: {
      workOrderId,
      workshopId,
      userId,
      processType: processType as any,
      status: 'ATÖLYEDE',
      startDate: new Date(),
      assignedQuantity: workOrder.quantity
    }
  });

  return res.json({
    success: true,
    message: 'Mal atölyeye teslim edildi',
    tracking
  });
}

/**
 * Atölyeden mal teslim al - Adet, defo, fire, tamir girilir
 */
async function receiveFromWorkshop(
  res: NextApiResponse,
  workOrderId: number,
  workshopId: number,
  quantity: number,
  defective: number,
  damaged: number,
  repaired: number,
  userId: number
) {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId }
  });

  if (!workOrder) {
    return res.status(404).json({ error: 'İş emri bulunamadı' });
  }

  // Mevcut tracking kaydını HAZIR durumuna güncelle
  const updatedTracking = await prisma.fasonTracking.updateMany({
    where: {
      workOrderId,
      workshopId,
      status: 'ATÖLYEDE'
    },
    data: {
      status: 'HAZIR',
      endDate: new Date(),
      assignedQuantity: quantity,
      problemNotes: `Defo: ${defective}, Fire: ${damaged}, Tamir: ${repaired}`
    }
  });

  // Sonraki adımı hazırla: Atölye ata veya teslim al
  const nextTracking = await prisma.fasonTracking.findFirst({
    where: { workOrderId },
    orderBy: { createdAt: 'desc' }
  });

  return res.json({
    success: true,
    message: 'Mal teslim alındı',
    data: {
      receivedQuantity: quantity,
      defective,
      damaged,
      repaired,
      nextAction: 'assignOrFinalReceive' // UI'ye sonraki adımı söyle
    }
  });
}

/**
 * Malı sonraki atölyeye ata (örn. Dikim -> Ütü)
 */
async function assignNextWorkshop(
  res: NextApiResponse,
  workOrderId: number,
  nextWorkshopId: number,
  userId: number
) {
  // Sonraki atölye bilgisini getir
  const nextWorkshop = await prisma.fasonWorkshop.findUnique({
    where: { id: nextWorkshopId }
  });

  if (!nextWorkshop) {
    return res.status(404).json({ error: 'Atölye bulunamadı' });
  }

  // Atölye tipine göre ProcessType belirle
  let processType = 'DIKIM';
  if (nextWorkshop.specialization === 'UTU') processType = 'UTU';
  else if (nextWorkshop.specialization === 'BASKI_NAKIS') processType = 'BASKI_NAKIS';
  else if (nextWorkshop.specialization === 'DIKIM') processType = 'DIKIM';

  // Yeni tracking kaydı oluştur
  const newTracking = await prisma.fasonTracking.create({
    data: {
      workOrderId,
      workshopId: nextWorkshopId,
      userId,
      processType: processType as any,
      status: 'BEKLIYOR',
      assignedQuantity: 0 // Henüz bilinmiyor, receiveFromWorkshop'tan sonra set edilecek
    }
  });

  return res.json({
    success: true,
    message: 'Mal sonraki atölyeye atandı',
    tracking: newTracking
  });
}

/**
 * Üretim tamamlandı - Malı teslim al (final)
 */
async function finalReceive(
  res: NextApiResponse,
  workOrderId: number,
  userId: number
) {
  // WorkOrder durumunu TESLIM_EDILDI yap
  const updatedWorkOrder = await prisma.workOrder.update({
    where: { id: workOrderId },
    data: {
      status: 'TESLIM_EDILDI',
      updatedAt: new Date()
    }
  });

  // Son tracking kaydını kapat
  await prisma.fasonTracking.updateMany({
    where: {
      workOrderId,
      status: { in: ['HAZIR', 'ATÖLYEDE'] }
    },
    data: {
      status: 'TESLIM_EDILDI',
      endDate: new Date()
    }
  });

  return res.json({
    success: true,
    message: 'Üretim tamamlandı, mal teslim alındı',
    workOrder: updatedWorkOrder
  });
}
