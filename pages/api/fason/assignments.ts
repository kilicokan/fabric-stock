import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

const verifyToken = (req: NextApiRequest) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new Error('Token bulunamadı');

  return jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const user = verifyToken(req);

    switch (req.method) {
      case 'POST':
        return handleCreateAssignment(req, res, user);
      case 'PUT':
        return handleUpdateAssignment(req, res, user);
      case 'DELETE':
        return handleDeleteAssignment(req, res, user);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// Yeni atama oluştur
async function handleCreateAssignment(req: NextApiRequest, res: NextApiResponse, user: any) {
  try {
    const {
      workOrderId,
      workshopId,
      assignedQuantity,
      unitPrice,
      processType = 'DIKIM',
      notes
    } = req.body;

    // Input validation
    if (!workOrderId || !workshopId || !assignedQuantity || unitPrice === undefined) {
      return res.status(400).json({ error: 'Eksik veya geçersiz parametreler' });
    }

    const parsedWorkOrderId = parseInt(workOrderId);
    const parsedWorkshopId = parseInt(workshopId);
    const parsedAssignedQuantity = parseInt(assignedQuantity);
    const parsedUnitPrice = parseFloat(unitPrice);

    if (isNaN(parsedWorkOrderId) || isNaN(parsedWorkshopId) || isNaN(parsedAssignedQuantity) || isNaN(parsedUnitPrice)) {
      return res.status(400).json({ error: 'Geçersiz sayı formatı' });
    }

    if (parsedAssignedQuantity <= 0 || parsedUnitPrice < 0) {
      return res.status(400).json({ error: 'Miktar pozitif, fiyat sıfır veya pozitif olmalıdır' });
    }

    // Transaction kullanarak tutarlılık sağla
    const result = await prisma.$transaction(async (tx) => {
      // Önce mevcut atamaları kontrol et
      const existingAssignments = await tx.fasonTracking.findMany({
        where: { workOrderId: parsedWorkOrderId }
      });

      const totalAssigned = existingAssignments.reduce((sum, assignment) => sum + ((assignment as any).assignedQuantity || 0), 0);

      // İş emrini getir
      const workOrder = await tx.workOrder.findUnique({
        where: { id: parsedWorkOrderId }
      });

      if (!workOrder) {
        throw new Error('İş emri bulunamadı');
      }

      // Atanacak miktarı kontrol et
      if (totalAssigned + parsedAssignedQuantity > workOrder.quantity) {
        throw new Error(`Toplam atanan miktar (${totalAssigned + parsedAssignedQuantity}) iş emri miktarını (${workOrder.quantity}) aşamaz`);
      }

      // Atölyeyi getir
      const workshop = await tx.fasonWorkshop.findUnique({
        where: { id: parsedWorkshopId }
      });

      if (!workshop) {
        throw new Error('Atölye bulunamadı');
      }

      // Fason tracking kaydı oluştur
      const assignment = await tx.fasonTracking.create({
        data: {
          workOrderId: parsedWorkOrderId,
          workshopId: parsedWorkshopId,
          userId: user.id,
          processType,
          status: 'BEKLIYOR',
          assignedQuantity: parsedAssignedQuantity,
          unitPrice: parsedUnitPrice,
          totalPrice: parsedAssignedQuantity * parsedUnitPrice,
          notes
        } as any,
        include: {
          workOrder: true,
          workshop: true,
          user: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      // Atölye bakiyesini güncelle
      const totalEarnings = parsedAssignedQuantity * parsedUnitPrice;
      await tx.fasonWorkshop.update({
        where: { id: parsedWorkshopId },
        data: {
          balance: {
            increment: totalEarnings
          },
          totalEarnings: {
            increment: totalEarnings
          }
        }
      });

      return assignment;
    });

    return res.status(201).json(result as any);
  } catch (error: any) {
    console.error('Create assignment error:', error);
    if (error.message.includes('bulunamadı') || error.message.includes('aşamaz')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
}

// Atama güncelle
async function handleUpdateAssignment(req: NextApiRequest, res: NextApiResponse, user: any) {
  try {
    const { id } = req.query;
    const {
      assignedQuantity,
      unitPrice,
      processType,
      status,
      notes
    } = req.body;

    if (!id || !assignedQuantity || unitPrice === undefined) {
      return res.status(400).json({ error: 'Eksik veya geçersiz parametreler' });
    }

    const parsedId = parseInt(id as string);
    const parsedAssignedQuantity = parseInt(assignedQuantity);
    const parsedUnitPrice = parseFloat(unitPrice);

    if (isNaN(parsedId) || isNaN(parsedAssignedQuantity) || isNaN(parsedUnitPrice)) {
      return res.status(400).json({ error: 'Geçersiz sayı formatı' });
    }

    if (parsedAssignedQuantity <= 0 || parsedUnitPrice < 0) {
      return res.status(400).json({ error: 'Miktar pozitif, fiyat sıfır veya pozitif olmalıdır' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Mevcut atamayı getir
      const existingAssignment = await tx.fasonTracking.findUnique({
        where: { id: parsedId },
        include: { workshop: true, workOrder: true }
      });

      if (!existingAssignment) {
        throw new Error('Atama bulunamadı');
      }

      const oldTotalPrice = ((existingAssignment as any).assignedQuantity || 0) * ((existingAssignment as any).unitPrice || 0);
      const newTotalPrice = parsedAssignedQuantity * parsedUnitPrice;
      const priceDifference = newTotalPrice - oldTotalPrice;

      // Atamayı güncelle
      const assignment = await tx.fasonTracking.update({
        where: { id: parsedId },
        data: {
          assignedQuantity: parsedAssignedQuantity,
          unitPrice: parsedUnitPrice,
          totalPrice: newTotalPrice,
          processType,
          status,
          notes,
          updatedAt: new Date()
        } as any,
        include: {
          workOrder: true,
          workshop: true,
          user: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      // Atölye bakiyesini güncelle
      if (priceDifference !== 0 && existingAssignment.workshopId) {
        await tx.fasonWorkshop.update({
          where: { id: existingAssignment.workshopId },
          data: {
            balance: {
              increment: priceDifference
            },
            totalEarnings: {
              increment: priceDifference
            }
          }
        });
      }

      return assignment;
    });

    return res.json(result as any);
  } catch (error: any) {
    console.error('Update assignment error:', error);
    if (error.message.includes('bulunamadı')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
}

// Atama sil
async function handleDeleteAssignment(req: NextApiRequest, res: NextApiResponse, user: any) {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'ID gerekli' });
    }

    const parsedId = parseInt(id as string);
    if (isNaN(parsedId)) {
      return res.status(400).json({ error: 'Geçersiz ID' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Atamayı getir
      const assignment = await tx.fasonTracking.findUnique({
        where: { id: parsedId },
        include: { workshop: true }
      });

      if (!assignment) {
        throw new Error('Atama bulunamadı');
      }

      // Atölye bakiyesini geri al
      const totalPrice = ((assignment as any).assignedQuantity || 0) * ((assignment as any).unitPrice || 0);
      if (assignment.workshopId) {
        await tx.fasonWorkshop.update({
          where: { id: assignment.workshopId },
          data: {
            balance: {
              decrement: totalPrice
            },
            totalEarnings: {
              decrement: totalPrice
            }
          }
        });
      }

      // Atamayı sil
      await tx.fasonTracking.delete({
        where: { id: parsedId }
      });

      return { message: 'Assignment deleted successfully' };
    });

    return res.json(result);
  } catch (error: any) {
    console.error('Delete assignment error:', error);
    if (error.message.includes('bulunamadı')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
}
