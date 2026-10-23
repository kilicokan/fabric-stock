jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    workOrder: { findUnique: jest.fn() },
    spreadingRun: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    spreadingMachine: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(),
}));

import type { NextRequest } from 'next/server';
import { GET, PATCH, POST } from '@/app/api/spreading-runs/route';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockPrisma = prisma as unknown as {
  workOrder: { findUnique: jest.Mock };
  spreadingRun: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  spreadingMachine: { findUnique: jest.Mock };
  $transaction: jest.Mock;
};

function createRequest(url: string, authorization?: string): NextRequest {
  return {
    headers: new Headers(authorization ? { authorization } : {}),
    nextUrl: new URL(url),
    json: jest.fn(),
  } as unknown as NextRequest;
}

describe('/api/spreading-runs authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['GET', GET, 'http://localhost/api/spreading-runs?orderId=1'],
    ['POST', POST, 'http://localhost/api/spreading-runs'],
    ['PATCH', PATCH, 'http://localhost/api/spreading-runs'],
  ])('rejects unauthenticated %s requests', async (_method, handler, url) => {
    mockVerifyToken.mockReturnValue(null);

    const response = await handler(createRequest(url));

    expect(response.status).toBe(401);
    expect(mockPrisma.workOrder.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.spreadingRun.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.spreadingRun.create).not.toHaveBeenCalled();
    expect(mockPrisma.spreadingRun.update).not.toHaveBeenCalled();
  });

  it('serves the active run to an authenticated operator', async () => {
    mockVerifyToken.mockReturnValue({ id: 2, email: 'operator@example.com', role: 'OPERATOR' });
    mockPrisma.workOrder.findUnique.mockResolvedValue({ id: 1, orderNo: 'WO-1' });
    mockPrisma.spreadingRun.findFirst.mockResolvedValue(null);

    const response = await GET(
      createRequest('http://localhost/api/spreading-runs?orderId=1', 'Bearer valid-token')
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: null });
    expect(mockPrisma.workOrder.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { id: true, orderNo: true },
    });
  });

  it('does not search for a run when the requested work order does not exist', async () => {
      mockVerifyToken.mockReturnValue({ id: 2, email: 'operator@example.com', role: 'OPERATOR' });
      mockPrisma.workOrder.findUnique.mockResolvedValue(null);

      const response = await GET(
        createRequest('http://localhost/api/spreading-runs?orderId=999', 'Bearer valid-token')
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ data: null });
      expect(mockPrisma.spreadingRun.findFirst).not.toHaveBeenCalled();
    });

  it('returns an existing active run rather than creating a duplicate', async () => {
      mockVerifyToken.mockReturnValue({ id: 2, email: 'operator@example.com', role: 'OPERATOR' });
      mockPrisma.workOrder.findUnique.mockResolvedValue({ id: 1, orderNo: 'WO-1' });
      mockPrisma.spreadingRun.findFirst.mockResolvedValue({
        id: 7,
        machine: 'Masa 1',
        status: 'SERİM DEVAM EDİYOR',
        layerSet: null,
        currentLayer: 3,
        pastelMeter: null,
        pastelPositionMeter: null,
        widthCm: null,
        tension: null,
        forwardSpeed: null,
        reverseSpeed: null,
        sourceUpdatedAt: new Date('2026-10-22T10:00:00Z'),
        machineId: 2,
        cuttingTableId: 1,
        externalRunId: 'run-7',
        workOrderNo: 'WO-1',
        rawPayload: { source: 'MANUAL' },
        layers: [],
      });

      const request = createRequest('http://localhost/api/spreading-runs', 'Bearer valid-token');
      (request.json as jest.Mock).mockResolvedValue({ orderId: 1 });
      const response = await POST(request);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(expect.objectContaining({
        reused: true,
        data: expect.objectContaining({ id: 7, currentLayer: 3, source: 'MANUAL' }),
      }));
      expect(mockPrisma.spreadingRun.create).not.toHaveBeenCalled();
  });

  it('creates a manual run using the configured active machine', async () => {
    mockVerifyToken.mockReturnValue({ id: 2, email: 'operator@example.com', role: 'OPERATOR' });
    mockPrisma.workOrder.findUnique.mockResolvedValue({ id: 1, orderNo: 'WO-1' });
    mockPrisma.spreadingRun.findFirst.mockResolvedValue(null);
    mockPrisma.spreadingMachine.findUnique.mockResolvedValue({
      id: 4,
      name: 'Katlama Makinesi 1',
      layerSource: 'MANUAL',
      isActive: true,
      cuttingTableId: 3,
      cuttingTable: { id: 3, name: 'Kesim Masası 3' },
    });
    mockPrisma.spreadingRun.create.mockImplementation(({ data }) => Promise.resolve({
      id: 7,
      ...data,
      pastelMeter: null,
      pastelPositionMeter: null,
      widthCm: null,
      tension: null,
      forwardSpeed: null,
      reverseSpeed: null,
      sourceUpdatedAt: new Date('2026-10-22T10:00:00Z'),
      layers: [],
    }));

    const request = createRequest('http://localhost/api/spreading-runs', 'Bearer valid-token');
    (request.json as jest.Mock).mockResolvedValue({
      orderId: 1,
      machineId: 4,
      cuttingTableId: 3,
      machine: 'İstemciden Gelen Sahte Makine',
      source: 'SENSOR',
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mockPrisma.spreadingRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        machine: 'Katlama Makinesi 1',
        machineId: 4,
        cuttingTableId: 3,
        rawPayload: expect.objectContaining({ source: 'MANUAL' }),
      }),
    }));
  });

  it('does not claim a live PLC source when the UI only creates a placeholder run', async () => {
    mockVerifyToken.mockReturnValue({ id: 2, email: 'operator@example.com', role: 'OPERATOR' });
    mockPrisma.workOrder.findUnique.mockResolvedValue({ id: 1, orderNo: 'WO-1' });
    mockPrisma.spreadingRun.findFirst.mockResolvedValue(null);
    mockPrisma.spreadingMachine.findUnique.mockResolvedValue({
      id: 4,
      name: 'PLC Makinesi',
      layerSource: 'PLC',
      isActive: true,
      cuttingTableId: 3,
      cuttingTable: { id: 3, name: 'Kesim Masası 3' },
    });
    mockPrisma.spreadingRun.create.mockImplementation(({ data }) => Promise.resolve({
      id: 7,
      ...data,
      pastelMeter: null,
      pastelPositionMeter: null,
      widthCm: null,
      tension: null,
      forwardSpeed: null,
      reverseSpeed: null,
      sourceUpdatedAt: new Date('2026-10-22T10:00:00Z'),
      layers: [],
    }));

    const request = createRequest('http://localhost/api/spreading-runs', '******');
    (request.json as jest.Mock).mockResolvedValue({ orderId: 1, machineId: 4, cuttingTableId: 3 });
    await POST(request);

    expect(mockPrisma.spreadingRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        rawPayload: expect.objectContaining({ source: 'MANUAL' }),
      }),
    }));
  });

  it('does not count a retried manual increment twice', async () => {
    mockVerifyToken.mockReturnValue({ id: 2, email: 'operator@example.com', role: 'OPERATOR' });
    mockPrisma.workOrder.findUnique.mockResolvedValue({ id: 1, orderNo: 'WO-1' });
    const run = {
      id: 7,
      machine: 'Masa 1',
      status: 'SERİM DEVAM EDİYOR',
      layerSet: null,
      currentLayer: 4,
      pastelMeter: null,
      pastelPositionMeter: null,
      widthCm: null,
      tension: null,
      forwardSpeed: null,
      reverseSpeed: null,
      sourceUpdatedAt: new Date('2026-10-22T10:00:00Z'),
      machineId: 2,
      cuttingTableId: 1,
      externalRunId: 'run-7',
      workOrderNo: 'WO-1',
      rawPayload: { source: 'MANUAL', manualIncrementRequests: ['request-1'] },
      layers: [],
    };
    mockPrisma.spreadingRun.findFirst.mockResolvedValue(run);
    const tx = {
      spreadingRun: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(run),
        update: jest.fn(),
      },
    };
    mockPrisma.$transaction.mockImplementation((callback: (transaction: typeof tx) => unknown) => callback(tx));

    const request = createRequest('http://localhost/api/spreading-runs', 'Bearer valid-token');
    (request.json as jest.Mock).mockResolvedValue({
      orderId: 1,
      action: 'increment',
      delta: 1,
      requestId: 'request-1',
    });
    const response = await PATCH(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      data: expect.objectContaining({ currentLayer: 4 }),
    }));
    expect(tx.spreadingRun.update).not.toHaveBeenCalled();
  });

  it('increments the counter atomically and records the request id', async () => {
    mockVerifyToken.mockReturnValue({ id: 2, email: 'operator@example.com', role: 'OPERATOR' });
    mockPrisma.workOrder.findUnique.mockResolvedValue({ id: 1, orderNo: 'WO-1' });
    const run = {
      id: 7,
      machine: 'Masa 1',
      status: 'SERİM DEVAM EDİYOR',
      layerSet: null,
      currentLayer: 4,
      pastelMeter: null,
      pastelPositionMeter: null,
      widthCm: null,
      tension: null,
      forwardSpeed: null,
      reverseSpeed: null,
      sourceUpdatedAt: new Date('2026-10-22T10:00:00Z'),
      machineId: 2,
      cuttingTableId: 1,
      externalRunId: 'run-7',
      workOrderNo: 'WO-1',
      rawPayload: { source: 'MANUAL', manualIncrementRequests: [] },
      layers: [],
    };
    mockPrisma.spreadingRun.findFirst.mockResolvedValue(run);
    const updatedRun = { ...run, currentLayer: 6, rawPayload: { ...run.rawPayload, manualIncrementRequests: ['request-2'] } };
    const tx = {
      spreadingRun: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(run),
        update: jest.fn().mockResolvedValue(updatedRun),
      },
    };
    mockPrisma.$transaction.mockImplementation((callback: (transaction: typeof tx) => unknown) => callback(tx));

    const request = createRequest('http://localhost/api/spreading-runs', 'Bearer valid-token');
    (request.json as jest.Mock).mockResolvedValue({
      orderId: 1,
      action: 'increment',
      delta: 2,
      requestId: 'request-2',
    });
    const response = await PATCH(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      data: expect.objectContaining({ currentLayer: 6 }),
    }));
    expect(tx.spreadingRun.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 7 },
      data: expect.objectContaining({ currentLayer: { increment: 2 } }),
    }));
  });
});
