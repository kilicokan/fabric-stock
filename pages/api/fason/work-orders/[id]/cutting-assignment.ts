import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';

const parsePositiveInt = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['PATCH']);
    return res.status(405).json(errorResponse('Method not allowed'));
  }

  const user = verifyToken(req.headers.authorization);
  if (!user) {
    return res.status(401).json(errorResponse('Unauthorized', 'UNAUTHORIZED'));
  }

  const workOrderId = parsePositiveInt(req.query.id);
  const cuttingTableId = parsePositiveInt(req.body?.cuttingTableId);
  if (!workOrderId || !cuttingTableId) {
    return res.status(400).json(errorResponse('Geçerli iş emri ve kesim masası seçilmelidir.', 'VALIDATION_ERROR'));
  }

  try {
    const assignment = await prisma.$transaction(async (tx) => {
      const workOrder = await tx.workOrder.findUnique({
        where: { id: workOrderId },
        select: { id: true, status: true, quantity: true },
      });
      if (!workOrder) throw new Error('WORK_ORDER_NOT_FOUND');
      if (workOrder.status === 'TESLIM_EDILDI') throw new Error('WORK_ORDER_CLOSED');

      const cuttingTable = await tx.cuttingTable.findUnique({
        where: { id: cuttingTableId },
        select: {
          id: true,
          name: true,
          assignedUserId: true,
          assignedUser: { select: { id: true, name: true, email: true, role: true } },
        },
      });
      if (!cuttingTable) throw new Error('CUTTING_TABLE_NOT_FOUND');
      if (!cuttingTable.assignedUser || cuttingTable.assignedUser.role !== 'FASON_TRACKER') {
        throw new Error('CUTTING_TABLE_USER_NOT_ASSIGNED');
      }

      const existingTracking = await tx.fasonTracking.findFirst({
        where: {
          workOrderId,
          processType: 'KESIM',
          status: { not: 'IPTAL_EDILDI' },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (existingTracking?.workshopId) throw new Error('FASON_CUTTING_ORDER');

      const cuttingTracking = existingTracking
        ? await tx.fasonTracking.update({
            where: { id: existingTracking.id },
            data: {
              cuttingTableId: cuttingTable.id,
              userId: cuttingTable.assignedUser.id,
            },
            include: {
              cuttingTable: { select: { id: true, name: true } },
              user: { select: { id: true, name: true, email: true } },
            },
          })
        : await tx.fasonTracking.create({
            data: {
              workOrderId,
              cuttingTableId: cuttingTable.id,
              userId: cuttingTable.assignedUser.id,
              processType: 'KESIM',
              status: 'BEKLIYOR',
              assignedQuantity: workOrder.quantity,
              unitPrice: 0,
              totalPrice: 0,
            },
            include: {
              cuttingTable: { select: { id: true, name: true } },
              user: { select: { id: true, name: true, email: true } },
            },
          });

      await tx.workOrder.update({
        where: { id: workOrderId },
        data: {
          assignedUserId: cuttingTable.assignedUser.id,
          assignedToMobile: false,
          mobileAssignmentDate: null,
        },
      });

      return cuttingTracking;
    });

    return res.status(200).json(successResponse(assignment));
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'WORK_ORDER_NOT_FOUND') {
      return res.status(404).json(errorResponse('İş emri bulunamadı.', 'NOT_FOUND'));
    }
    if (code === 'WORK_ORDER_CLOSED') {
      return res.status(400).json(errorResponse('Kapatılmış iş emri kesime atanamaz.', 'INVALID_STATE'));
    }
    if (code === 'CUTTING_TABLE_NOT_FOUND') {
      return res.status(404).json(errorResponse('Kesim masası bulunamadı.', 'NOT_FOUND'));
    }
    if (code === 'CUTTING_TABLE_USER_NOT_ASSIGNED') {
      return res.status(400).json(errorResponse('Seçilen masaya fason takipçi kullanıcı atanmamış.', 'VALIDATION_ERROR'));
    }
    if (code === 'FASON_CUTTING_ORDER') {
      return res.status(409).json(errorResponse('Fason kesim iş emrine masa atanamaz.', 'CONFLICT'));
    }

    console.error('Work order cutting-table assignment failed:', error);
    return res.status(500).json(errorResponse('Kesim masası ataması yapılamadı.'));
  }
}
