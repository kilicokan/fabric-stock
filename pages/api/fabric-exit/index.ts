import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

const parsePositiveInt = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const appendCutNote = (existingNote: string | null | undefined, nextLine: string): string =>
  existingNote && existingNote.trim().length > 0 ? `${existingNote} | ${nextLine}` : nextLine;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const reportNumber = typeof req.query.reportNumber === 'string' ? req.query.reportNumber.trim() : '';
      const exits = await prisma.fabricExit.findMany({
        where: reportNumber ? { reportNumber } : undefined,
        include: {
          fabricEntry: { include: { fabric: true } },
          cuttingTable: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      return res.status(200).json(exits);
    }

    if (req.method === 'POST') {
      const {
        modelNo,
        modelName,
        orderNo,
        customerIds,
        layerCount,
        grammage,
        externalProductId,
        productionKg,
        productionMeters,
        unitType,
        cuttingTable,
        colors,
        fabricType,
        reportNumber,
        createdAt,
        workOrderId,
        cutPieceCount,
        pastelEni,
        pastelBoyu,
        metreKareAgirlik,
        pastelAgirlik,
      } = req.body as {
        modelNo?: string;
        modelName?: string;
        orderNo?: string;
        customerIds?: string[];
        layerCount?: number | string;
        grammage?: number | string;
        externalProductId?: string;
        productionKg?: number | string;
        productionMeters?: number | string;
        unitType?: string;
        cuttingTable?: number | string;
        colors?: string[];
        fabricType?: string;
        reportNumber?: string;
        createdAt?: string;
        workOrderId?: number | string | null;
        cutPieceCount?: number | string | null;
        pastelEni?: number | string;
        pastelBoyu?: number | string;
        metreKareAgirlik?: number | string;
        pastelAgirlik?: number | string;
      };

      if (!cuttingTable) {
        return res.status(400).json({ error: 'Kesim masasi zorunlu' });
      }
      if (!modelNo?.trim()) {
        return res.status(400).json({ error: 'Model No zorunlu' });
      }
      if (!orderNo?.trim()) {
        return res.status(400).json({ error: 'Siparis No zorunlu' });
      }
      if (!customerIds || customerIds.length === 0) {
        return res.status(400).json({ error: 'En az bir musteri secilmelidir' });
      }
      if (!fabricType?.trim()) {
        return res.status(400).json({ error: 'Kumas turu zorunlu' });
      }
      if (!colors || colors.length === 0) {
        return res.status(400).json({ error: 'En az bir renk secilmelidir' });
      }
      if (unitType === 'kg' && (!productionKg || Number(productionKg) <= 0)) {
        return res.status(400).json({ error: 'Uretim miktari (kg) pozitif bir sayi olmali' });
      }
      if (unitType === 'm' && (!productionMeters || Number(productionMeters) <= 0)) {
        return res.status(400).json({ error: 'Uretim miktari (metre) pozitif bir sayi olmali' });
      }

      const tableExists = await prisma.cuttingTable.findUnique({
        where: { id: Number(cuttingTable) },
        select: { id: true },
      });

      if (!tableExists) {
        return res.status(400).json({ error: "Gecersiz kesim masasi ID'si" });
      }

      const parsedWorkOrderId =
        typeof workOrderId === 'undefined' || workOrderId === null || workOrderId === ''
          ? null
          : parsePositiveInt(workOrderId);
      if (typeof workOrderId !== 'undefined' && workOrderId !== null && workOrderId !== '' && !parsedWorkOrderId) {
        return res.status(400).json({ error: 'Gecersiz is emri ID degeri' });
      }

      const parsedCutPieceCount = Number(cutPieceCount);
      const normalizedCutPieceCount =
        Number.isFinite(parsedCutPieceCount) && parsedCutPieceCount > 0
          ? Math.max(1, Math.round(parsedCutPieceCount))
          : null;

      const result = await prisma.$transaction(async (tx) => {
        const exit = await tx.fabricExit.create({
          data: {
            modelNo: modelNo.trim(),
            modelName: modelName?.trim() || null,
            orderNo: orderNo.trim(),
            customerId: customerIds.join(', '),
            layerCount: layerCount ? parseInt(String(layerCount), 10) : 1,
            productWeightKg: productionKg ? parseFloat(String(productionKg)) : 0,
            productLengthMeter: productionMeters ? parseFloat(String(productionMeters)) : 0,
            cuttingTable: { connect: { id: Number(cuttingTable) } },
            grammage: grammage ? parseFloat(String(grammage)) : 0,
            externalProductId: externalProductId || null,
            unitType: unitType || 'kg',
            color: colors.join(', '),
            fabricType: fabricType?.trim() || null,
        reportNumber: reportNumber?.trim() || null,
        pastelEni: pastelEni ? parseFloat(String(pastelEni)) : 0,
        pastelBoyu: pastelBoyu ? parseFloat(String(pastelBoyu)) : 0,
        metreKareAgirlik: metreKareAgirlik ? parseFloat(String(metreKareAgirlik)) : 0,
        pastelAgirlik: pastelAgirlik ? parseFloat(String(pastelAgirlik)) : 0,
        createdAt: createdAt ? new Date(createdAt) : new Date(),
          },
        });

        let resolvedWorkOrderId = parsedWorkOrderId;
        if (!resolvedWorkOrderId) {
          const workOrderByOrderNo = await tx.workOrder.findFirst({
            where: { orderNo: orderNo.trim() },
            select: { id: true },
          });
          resolvedWorkOrderId = workOrderByOrderNo?.id ?? null;
        }

        if (!resolvedWorkOrderId) {
          return { exit };
        }

        const workOrder = await tx.workOrder.findUnique({
          where: { id: resolvedWorkOrderId },
          select: {
            id: true,
            orderNo: true,
            quantity: true,
            status: true,
            notes: true,
            assignedUserId: true,
          },
        });

        if (!workOrder) {
          return { exit };
        }

        const cutAmount = normalizedCutPieceCount || 0;
        if (cutAmount <= 0) {
          return {
            exit,
            workOrder: {
              id: workOrder.id,
              orderNo: workOrder.orderNo,
              quantity: workOrder.quantity,
              cutAmount: 0,
              totalCutQuantity: 0,
              status: workOrder.status,
            },
            customerOrderItem: null,
          };
        }

        const activeCuttingTrackings = await tx.fasonTracking.findMany({
          where: {
            workOrderId: workOrder.id,
            processType: 'KESIM',
            status: { not: 'IPTAL_EDILDI' },
          },
          select: {
            id: true,
            assignedQuantity: true,
            receivedQuantity: true,
          },
          orderBy: { createdAt: 'asc' },
        });

        if (activeCuttingTrackings.length > 0) {
          const firstTracking = activeCuttingTrackings[0];
          await tx.fasonTracking.update({
            where: { id: firstTracking.id },
            data: {
              receivedQuantity: Math.max(0, Number(firstTracking.receivedQuantity || 0)) + cutAmount,
            },
          });
        } else {
          let trackingUserId = workOrder.assignedUserId;
          if (!trackingUserId) {
            const fallbackUser = await tx.user.findFirst({
              select: { id: true },
              orderBy: { id: 'asc' },
            });
            trackingUserId = fallbackUser?.id ?? null;
          }

          if (trackingUserId) {
            await tx.fasonTracking.create({
              data: {
                workOrderId: workOrder.id,
                userId: trackingUserId,
                processType: 'KESIM',
                status: 'BEKLIYOR',
                assignedQuantity: Math.max(Number(workOrder.quantity || 0), cutAmount),
                receivedQuantity: cutAmount,
                notes: `[${new Date().toISOString()}] Kumas cikisindan otomatik kesim kaydi olusturuldu`,
              },
            });
          }
        }

        const totalCutAggregate = await tx.fasonTracking.aggregate({
          where: {
            workOrderId: workOrder.id,
            processType: 'KESIM',
            status: { not: 'IPTAL_EDILDI' },
          },
          _sum: {
            receivedQuantity: true,
          },
        });

        const totalCutQuantity = Number(totalCutAggregate._sum.receivedQuantity || 0);
        const cutLogLine = `[${new Date().toISOString()}] Is emri ${workOrder.quantity} adet, kesilen ${cutAmount} adet (Toplam kesilen: ${totalCutQuantity})`;

        const updatedWorkOrder = await tx.workOrder.update({
          where: { id: workOrder.id },
          data: {
            notes: appendCutNote(workOrder.notes, cutLogLine),
            updatedAt: new Date(),
          },
          select: {
            id: true,
            orderNo: true,
            quantity: true,
            status: true,
          },
        });

        return {
          exit,
          workOrder: {
            id: updatedWorkOrder.id,
            orderNo: updatedWorkOrder.orderNo,
            quantity: updatedWorkOrder.quantity,
            cutAmount,
            totalCutQuantity,
            status: updatedWorkOrder.status,
          },
          customerOrderItem: null,
        };
      });

      return res.status(201).json({
        ...result.exit,
        workOrder: 'workOrder' in result ? result.workOrder : null,
        customerOrderItem: 'customerOrderItem' in result ? result.customerOrderItem : null,
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error('FabricExit API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
