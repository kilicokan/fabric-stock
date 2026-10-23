import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const COMPLETED = 'SERİM TAMAMLANDI';
const RUNNING = 'SERİM DEVAM EDİYOR';
const MAX_DELTA = 50;
const MAX_LAYER = 9999;
const runInclude = {
  layers: true,
  cuttingTable: { select: { id: true, name: true } },
  machineConfig: { select: { id: true, name: true } },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function toPositiveInt(value: unknown): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function toRunData(run: {
  id: number;
  machine: string;
  status: string;
  layerSet: number | null;
  currentLayer: number | null;
  pastelMeter: number | null;
  pastelPositionMeter: number | null;
  widthCm: number | null;
  tension: number | null;
  forwardSpeed: number | null;
  reverseSpeed: number | null;
  sourceUpdatedAt: Date | null;
  machineId: number | null;
  cuttingTableId: number | null;
  externalRunId: string;
  workOrderNo: string | null;
  rawPayload: Prisma.JsonValue;
  layers: Array<{ color: string; layerNumber: number; weightKg: number; pieceCount: number }>;
}, fallbackOrderNo?: string | null) {
  const raw = isRecord(run.rawPayload) ? run.rawPayload : {};
  return {
    id: run.id,
    machine: run.machine,
    status: run.status,
    layerSet: run.layerSet ?? 0,
    currentLayer: run.currentLayer ?? 0,
    pastelMeter: run.pastelMeter ?? 0,
    pastelPositionMeter: run.pastelPositionMeter ?? run.pastelMeter ?? 0,
    widthCm: run.widthCm ?? 0,
    tension: run.tension ?? 0,
    forwardSpeed: run.forwardSpeed ?? 0,
    reverseSpeed: run.reverseSpeed ?? 0,
    sourceUpdatedAt: run.sourceUpdatedAt?.toISOString() ?? new Date().toISOString(),
    machineId: run.machineId ?? null,
    cuttingTableId: run.cuttingTableId ?? null,
    externalRunId: run.externalRunId,
    workOrderNo: run.workOrderNo ?? fallbackOrderNo ?? null,
    source: typeof raw.source === 'string' ? raw.source : 'SENSOR',
    corrections: Array.isArray(raw.corrections) ? raw.corrections : [],
    layers: run.layers.map(layer => ({
      color: layer.color,
      layerNumber: layer.layerNumber,
      weightKg: layer.weightKg,
      pieceCount: layer.pieceCount,
    })),
  };
}

async function findActiveRun(workOrderId: number) {
  return prisma.spreadingRun.findFirst({
    where: { workOrderId, status: { not: COMPLETED } },
    orderBy: { sourceUpdatedAt: 'desc' },
    include: runInclude,
  });
}

export async function GET(request: NextRequest) {
  if (!verifyToken(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orderIdRaw = request.nextUrl.searchParams.get('orderId');
  const orderId = toPositiveInt(orderIdRaw);

  if (!orderIdRaw || !orderId) {
    return NextResponse.json(
      { error: 'orderId zorunlu ve pozitif sayı olmalı.', code: 'INVALID_ORDER_ID' },
      { status: 400 }
    );
  }

  const workOrder = await prisma.workOrder.findUnique({
    where: { id: orderId },
    select: { id: true, orderNo: true },
  });

  if (!workOrder) return NextResponse.json({ data: null });

  const run = await findActiveRun(workOrder.id);
  if (!run) {
    return NextResponse.json({ data: null });
  }

  return NextResponse.json({ data: toRunData(run, workOrder.orderNo) });
}

export async function POST(request: NextRequest) {
  const user = verifyToken(request.headers.get('authorization'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!isRecord(parsed)) return NextResponse.json({ error: 'Geçersiz istek gövdesi.' }, { status: 400 });
    body = parsed;
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 });
  }

  const orderId = toPositiveInt(body.orderId);
  if (!orderId) {
    return NextResponse.json({ error: 'orderId gerekli' }, { status: 400 });
  }

  try {
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: orderId },
      select: { id: true, orderNo: true },
    });

    if (!workOrder) {
      return NextResponse.json({ error: 'İş emri bulunamadı.' }, { status: 404 });
    }

    const existing = await findActiveRun(workOrder.id);
    if (existing) return NextResponse.json({ data: toRunData(existing, workOrder.orderNo), reused: true });

    const machineId = toPositiveInt(body.machineId);
    if (!machineId) {
      return NextResponse.json({ error: 'Aktif serim makinesi seçilmelidir.' }, { status: 400 });
    }
    const machine = await prisma.spreadingMachine.findUnique({
      where: { id: machineId },
      include: { cuttingTable: { select: { id: true, name: true } } },
    });
    if (!machine?.isActive) return NextResponse.json({ error: 'Serim makinesi bulunamadı veya devre dışı.' }, { status: 400 });
    const requestedTableId = body.cuttingTableId == null ? null : toPositiveInt(body.cuttingTableId);
    if (body.cuttingTableId != null && requestedTableId !== machine.cuttingTableId) {
      return NextResponse.json({ error: 'Seçilen serim makinesi bu kesim masasına bağlı değil.' }, { status: 400 });
    }

    const run = await prisma.spreadingRun.create({
      data: {
        externalRunId: typeof body.externalRunId === 'string' && body.externalRunId
          ? body.externalRunId
          : `UI-${workOrder.orderNo}-${Date.now()}`,
        machine: machine.name,
        workOrderNo: workOrder.orderNo,
        workOrderId: workOrder.id,
        status: RUNNING,
        layerSet: null,
        currentLayer: 0,
        sourceUpdatedAt: new Date(),
        machineId: machine.id,
        cuttingTableId: machine.cuttingTableId,
        rawPayload: {
          ...body,
          source: 'MANUAL',
          startedBy: { id: user.id, email: user.email },
          corrections: [],
          manualIncrementRequests: [],
        } as Prisma.InputJsonObject,
      },
      include: runInclude,
    });

    return NextResponse.json({ data: toRunData(run, workOrder.orderNo) }, { status: 201 });
  } catch (error) {
    console.error('Serim kaydı oluşturulamadı:', error);
    return NextResponse.json({ error: 'Serim kaydı oluşturulamadı.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = verifyToken(request.headers.get('authorization'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!isRecord(parsed)) return NextResponse.json({ error: 'Geçersiz istek gövdesi.' }, { status: 400 });
    body = parsed;
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 });
  }

  const orderId = toPositiveInt(body.orderId);
  if (!orderId) return NextResponse.json({ error: 'orderId gerekli' }, { status: 400 });

  try {
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: orderId },
      select: { id: true, orderNo: true },
    });

    if (!workOrder) {
      return NextResponse.json({ error: 'İş emri bulunamadı.' }, { status: 404 });
    }

    const run = await findActiveRun(workOrder.id);

    if (!run) {
      return NextResponse.json({ error: 'Aktif serim kaydı bulunamadı.' }, { status: 404 });
    }

    const action = typeof body.action === 'string' ? body.action : null;
    if (action === 'increment') {
      const delta = body.delta === undefined ? 1 : Number(body.delta);
      const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : '';
      if (!Number.isInteger(delta) || delta < 1 || delta > MAX_DELTA || !requestId || requestId.length > 100) {
        return NextResponse.json({ error: `delta 1-${MAX_DELTA} arasında olmalı ve requestId gerekli.` }, { status: 400 });
      }
      const updated = await prisma.$transaction(async tx => {
        const current = await tx.spreadingRun.findUniqueOrThrow({ where: { id: run.id } });
        const raw = isRecord(current.rawPayload) ? current.rawPayload : {};
        const requests = Array.isArray(raw.manualIncrementRequests)
          ? raw.manualIncrementRequests.filter((value): value is string => typeof value === 'string')
          : [];
        if (requests.includes(requestId)) {
          return tx.spreadingRun.findUniqueOrThrow({ where: { id: run.id }, include: runInclude });
        }
        if ((current.currentLayer ?? 0) + delta > MAX_LAYER) {
          throw new Error('MAX_LAYER_REACHED');
        }
        return tx.spreadingRun.update({
          where: { id: run.id },
          data: {
            currentLayer: { increment: delta },
            status: RUNNING,
            sourceUpdatedAt: new Date(),
            rawPayload: {
              ...raw,
              source: 'MANUAL',
              manualIncrementRequests: [...requests, requestId].slice(-1000),
            } as Prisma.InputJsonObject,
          },
          include: runInclude,
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return NextResponse.json({ data: toRunData(updated, workOrder.orderNo) });
    }

    let data: Prisma.SpreadingRunUncheckedUpdateInput;
    if (action === 'decrement' || action === 'set') {
      const from = run.currentLayer ?? 0;
      const to = action === 'decrement' ? from - 1 : Number(body.value);
      if (!Number.isInteger(to) || to < 0 || to > MAX_LAYER) {
        return NextResponse.json({ error: action === 'decrement' ? 'Kat sayısı zaten 0.' : `Kat 0-${MAX_LAYER} arasında olmalı.` }, { status: 400 });
      }
      const raw = isRecord(run.rawPayload) ? run.rawPayload : {};
      const corrections = Array.isArray(raw.corrections) ? raw.corrections : [];
      const correction = {
        at: new Date().toISOString(),
        userId: user.id,
        userEmail: user.email,
        action,
        from,
        to,
        reason: typeof body.reason === 'string' ? body.reason.slice(0, 200) : '',
      };
      data = {
        currentLayer: to,
        sourceUpdatedAt: new Date(),
        rawPayload: {
          ...raw,
          corrections: [...corrections, correction],
        } as Prisma.InputJsonObject,
      };
    } else if (action === 'complete') {
      data = { status: COMPLETED, sourceUpdatedAt: new Date() };
    } else {
      data = {
        status: typeof body.status === 'string' ? body.status : run.status,
        currentLayer: body.currentLayer == null ? run.currentLayer : Number(body.currentLayer),
        layerSet: body.layerSet == null ? run.layerSet : Number(body.layerSet),
        pastelMeter: body.pastelMeter == null ? run.pastelMeter : Number(body.pastelMeter),
        pastelPositionMeter: body.pastelPositionMeter == null ? run.pastelPositionMeter : Number(body.pastelPositionMeter),
        widthCm: body.widthCm == null ? run.widthCm : Number(body.widthCm),
        tension: body.tension == null ? run.tension : Number(body.tension),
        forwardSpeed: body.forwardSpeed == null ? run.forwardSpeed : Number(body.forwardSpeed),
        reverseSpeed: body.reverseSpeed == null ? run.reverseSpeed : Number(body.reverseSpeed),
        sourceUpdatedAt: new Date(),
        machineId: body.machineId == null ? run.machineId : toPositiveInt(body.machineId),
        cuttingTableId: body.cuttingTableId == null ? run.cuttingTableId : toPositiveInt(body.cuttingTableId),
        rawPayload: {
          ...(isRecord(run.rawPayload) ? run.rawPayload : {}),
          ...body,
        } as Prisma.InputJsonObject,
      };
    }

    const updated = await prisma.spreadingRun.update({
      where: { id: run.id },
      data,
      include: runInclude,
    });
    return NextResponse.json({ data: toRunData(updated, workOrder.orderNo) });
  } catch (error) {
    if (error instanceof Error && error.message === 'MAX_LAYER_REACHED') {
      return NextResponse.json({ error: `Kat sayısı ${MAX_LAYER} değerini aşamaz.` }, { status: 400 });
    }
    console.error('Serim kaydı güncellenemedi:', error);
    return NextResponse.json({ error: 'Serim kaydı güncellenemedi.' }, { status: 500 });
  }
}
