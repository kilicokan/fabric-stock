import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

type SpreadingRunPayload = {
  externalRunId: string;
  machine: string;
  workOrderNo?: string | null;
  pastelNo?: string | null;
  fabricCode?: string | null;
  color?: string | null;
  operator?: string | null;
  status: string;
  layerSet?: number | null;
  currentLayer?: number | null;
  pastelPositionMeter?: number | null;
  pastelMeter?: number | null;
  widthCm?: number | null;
  tension?: number | null;
  forwardSpeed?: number | null;
  reverseSpeed?: number | null;
  wasteMeter?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  sourceUpdatedAt?: string | null;
  machineId?: number | null;
  cuttingTableId?: number | null;
  layers?: Array<{
    color: string;
    layerNumber: number;
    weightKg: number;
    pieceCount?: number;
  }>;
};

const requiredTextFields = ['externalRunId', 'machine', 'status'] as const;
const optionalTextFields = ['workOrderNo', 'pastelNo', 'fabricCode', 'color', 'operator'] as const;

const numberFields = [
  'layerSet',
  'currentLayer',
  'pastelPositionMeter',
  'pastelMeter',
  'widthCm',
  'tension',
  'forwardSpeed',
  'reverseSpeed',
  'wasteMeter',
] as const;

function isPayload(value: unknown): value is SpreadingRunPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;

  if (requiredTextFields.some((field) => typeof payload[field] !== 'string' || !payload[field])) {
    return false;
  }

  if (optionalTextFields.some((field) => payload[field] !== undefined &&
    payload[field] !== null && typeof payload[field] !== 'string')) {
    return false;
  }

  if (payload.machineId !== undefined && payload.machineId !== null &&
      (!Number.isInteger(payload.machineId) || Number(payload.machineId) <= 0)) return false;
  if (payload.cuttingTableId !== undefined && payload.cuttingTableId !== null &&
      (!Number.isInteger(payload.cuttingTableId) || Number(payload.cuttingTableId) <= 0)) return false;
  if (payload.layers !== undefined && (!Array.isArray(payload.layers) || payload.layers.some(layer =>
    !layer || typeof layer.color !== 'string' || !layer.color.trim() ||
    !Number.isInteger(layer.layerNumber) || layer.layerNumber <= 0 ||
    typeof layer.weightKg !== 'number' || !Number.isFinite(layer.weightKg) || layer.weightKg < 0 ||
    (layer.pieceCount !== undefined && (!Number.isInteger(layer.pieceCount) || layer.pieceCount < 0))
  ))) return false;

  return numberFields.every((field) => {
    const fieldValue = payload[field];
    return fieldValue === undefined || fieldValue === null ||
      (typeof fieldValue === 'number' && Number.isFinite(fieldValue));
  });
}

function parseDate(value: string | null | undefined, field: string): Date | undefined {
  if (value == null || value === '') return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${field} geçerli bir tarih olmalıdır`);
  return parsed;
}

function hasGatewayKey(req: NextApiRequest): boolean {
  const expected = process.env.MTK_GATEWAY_API_KEY;
  const received = req.headers['x-mtk-api-key'];
  if (!expected || typeof received !== 'string') return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(204).end();
  }

  if (req.method === 'POST') {
    if (!hasGatewayKey(req)) {
      return res.status(401).json({ error: 'Gateway anahtarı geçersiz' });
    }

    if (!isPayload(req.body)) {
      return res.status(400).json({ error: 'Geçersiz serim verisi' });
    }

    try {
      const payload = req.body;
      const workOrder = payload.workOrderNo
        ? await prisma.workOrder.findUnique({ where: { orderNo: payload.workOrderNo }, select: { id: true } })
        : null;
      const data = {
        externalRunId: payload.externalRunId,
        machine: payload.machine,
        workOrderNo: payload.workOrderNo ?? null,
        pastelNo: payload.pastelNo ?? null,
        fabricCode: payload.fabricCode ?? null,
        color: payload.color ?? null,
        operator: payload.operator ?? null,
        status: payload.status,
        layerSet: payload.layerSet ?? null,
        currentLayer: payload.currentLayer ?? null,
        pastelPositionMeter: payload.pastelPositionMeter ?? null,
        pastelMeter: payload.pastelMeter ?? null,
        widthCm: payload.widthCm ?? null,
        tension: payload.tension ?? null,
        forwardSpeed: payload.forwardSpeed ?? null,
        reverseSpeed: payload.reverseSpeed ?? null,
        wasteMeter: payload.wasteMeter ?? null,
        startedAt: parseDate(payload.startedAt, 'startedAt'),
        completedAt: parseDate(payload.completedAt, 'completedAt'),
        sourceUpdatedAt: parseDate(payload.sourceUpdatedAt, 'sourceUpdatedAt'),
        rawPayload: payload,
        workOrderId: workOrder?.id ?? null,
        machineId: payload.machineId ?? null,
        cuttingTableId: payload.cuttingTableId ?? null,
      };

      const spreadingRun = await prisma.$transaction(async (tx) => {
        const run = await tx.spreadingRun.upsert({
          where: { externalRunId: payload.externalRunId },
          create: data,
          update: data,
        });
        if (payload.layers) {
          await tx.spreadingLayer.deleteMany({ where: { spreadingRunId: run.id } });
          if (payload.layers.length > 0) {
            await tx.spreadingLayer.createMany({
              data: payload.layers.map(layer => ({
                spreadingRunId: run.id,
                color: layer.color.trim(),
                layerNumber: layer.layerNumber,
                weightKg: layer.weightKg,
                pieceCount: layer.pieceCount ?? 0,
              })),
            });
          }
        }
        return tx.spreadingRun.findUniqueOrThrow({
          where: { id: run.id },
          include: { layers: true, workOrder: true, machineConfig: { include: { cuttingTable: true } } },
        });
      });

      return res.status(200).json(spreadingRun);
    } catch (error) {
      console.error('MTK serim verisi kaydedilemedi:', error);
      return res.status(400).json({
        error: error instanceof Error ? error.message : 'Serim verisi kaydedilemedi',
      });
    }
  }

  if (req.method === 'GET') {
    if (!verifyToken(req.headers.authorization)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const machine = typeof req.query.machine === 'string' ? req.query.machine : undefined;
    const workOrderNo = typeof req.query.workOrderNo === 'string' ? req.query.workOrderNo : undefined;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const runs = await prisma.spreadingRun.findMany({
      where: {
        ...(machine ? { machine } : {}),
        ...(workOrderNo ? { workOrderNo } : {}),
      },
      orderBy: { sourceUpdatedAt: 'desc' },
      take: limit,
      include: {
        layers: true,
        machineConfig: { include: { cuttingTable: { select: { id: true, name: true } } } },
        workOrder: { select: { id: true, orderNo: true, productCode: true, productName: true } },
      },
    });
    return res.status(200).json(runs);
  }

  res.setHeader('Allow', 'GET, POST, OPTIONS');
  return res.status(405).json({ error: 'Method not allowed' });
}
