import { createMocks } from 'node-mocks-http';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-testing-only';

const makeAuthToken = (payload = { id: 1, email: 'admin@test.com', role: 'ADMIN' }) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    fasonWorkshop: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    fasonTracking: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
    },
    workOrder: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(),
}));

jest.mock('@/lib/api-response', () => ({
  successResponse: (data: any) => ({ success: true, data, timestamp: new Date().toISOString() }),
  errorResponse: (error: string, code?: string) => ({ success: false, error, code, timestamp: new Date().toISOString() }),
}));

import workshopsHandler from '@/pages/api/fason/workshops';
import trackingHandler from '@/pages/api/fason/tracking';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

const mockVerifyToken = verifyToken as jest.Mock;
const mockPrisma = prisma as any;

describe('GET /api/fason/workshops', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('kimlik doğrulaması olmadan atölyeleri listeler (public GET)', async () => {
    const mockWorkshops = [
      { id: 1, name: 'Atölye A', specialization: 'DIKIM', isActive: true, maxCapacity: 5000, capacity: 3000 },
      { id: 2, name: 'Atölye B', specialization: 'KESIM', isActive: true, maxCapacity: 2000, capacity: 2000 },
    ];
    mockPrisma.fasonWorkshop.findMany.mockResolvedValue(mockWorkshops);

    const { req, res } = createMocks({ method: 'GET' });

    await workshopsHandler(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(2);
    expect(data.data[0].name).toBe('Atölye A');
  });

  it('specialization filtresiyle atölyeleri listeler', async () => {
    mockPrisma.fasonWorkshop.findMany.mockResolvedValue([
      { id: 1, name: 'Atölye A', specialization: 'DIKIM', isActive: true },
    ]);

    const { req, res } = createMocks({
      method: 'GET',
      query: { specialization: 'DIKIM' },
    });

    await workshopsHandler(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    expect(mockPrisma.fasonWorkshop.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ specialization: 'DIKIM' }),
      })
    );
  });

  it('OPTIONS isteğinde 200 döner (CORS preflight)', async () => {
    const { req, res } = createMocks({ method: 'OPTIONS' });

    await workshopsHandler(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
  });

  it('desteklenmeyen metot için 405 döner', async () => {
    mockVerifyToken.mockReturnValue(null);
    const { req, res } = createMocks({ method: 'HEAD' });

    await workshopsHandler(req as any, res as any);

    expect(res._getStatusCode()).toBe(405);
  });
});

describe('POST /api/fason/workshops', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('yetkisiz istekte 401 döner', async () => {
    mockVerifyToken.mockReturnValue(null);

    const { req, res } = createMocks({
      method: 'POST',
      body: { name: 'Yeni Atölye', specialization: 'DIKIM' },
    });

    await workshopsHandler(req as any, res as any);

    expect(res._getStatusCode()).toBe(401);
  });

  it('gerekli alanlar eksikse 400 döner', async () => {
    mockVerifyToken.mockReturnValue({ id: 1, email: 'admin@test.com', role: 'ADMIN' });

    const { req, res } = createMocks({
      method: 'POST',
      headers: { authorization: `Bearer ${makeAuthToken()}` },
      body: { name: 'Atölye' },
    });

    await workshopsHandler(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
  });

  it('geçerli verilerle atölye oluşturur', async () => {
    mockVerifyToken.mockReturnValue({ id: 1, email: 'admin@test.com', role: 'ADMIN' });
    const newWorkshop = { id: 3, name: 'Yeni Atölye', specialization: 'DIKIM', isActive: true };
    mockPrisma.fasonWorkshop.create.mockResolvedValue(newWorkshop);

    const { req, res } = createMocks({
      method: 'POST',
      headers: { authorization: `Bearer ${makeAuthToken()}` },
      body: { name: 'Yeni Atölye', specialization: 'DIKIM', capacity: '1000', capacityType: 'TL' },
    });

    await workshopsHandler(req as any, res as any);

    expect(res._getStatusCode()).toBe(201);
    const data = JSON.parse(res._getData());
    expect(data.success).toBe(true);
    expect(data.data.name).toBe('Yeni Atölye');
  });
});

describe('GET /api/fason/tracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('yetkisiz istekte 401 döner', async () => {
    mockVerifyToken.mockReturnValue(null);

    const { req, res } = createMocks({ method: 'GET' });

    await trackingHandler(req as any, res as any);

    expect(res._getStatusCode()).toBe(401);
  });

  it('yetkili kullanıcı için takip kayıtlarını döner', async () => {
    mockVerifyToken.mockReturnValue({ id: 1, email: 'admin@test.com', role: 'ADMIN' });
    const mockTrackings = [
      { id: 1, workOrderId: 10, workshopId: 1, userId: 1, status: 'BEKLIYOR', processType: 'DIKIM' },
      { id: 2, workOrderId: 11, workshopId: 2, userId: 1, status: 'ATÖLYEDE', processType: 'KESIM' },
    ];
    mockPrisma.fasonTracking.findMany.mockResolvedValue(mockTrackings);

    const { req, res } = createMocks({
      method: 'GET',
      headers: { authorization: `Bearer ${makeAuthToken()}` },
    });

    await trackingHandler(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(2);
  });

  it('FASON_TRACKER rolü sadece kendi kayıtlarını görür', async () => {
    const trackerUser = { id: 5, email: 'tracker@test.com', role: 'FASON_TRACKER' };
    mockVerifyToken.mockReturnValue(trackerUser);
    mockPrisma.fasonTracking.findMany.mockResolvedValue([]);

    const { req, res } = createMocks({
      method: 'GET',
      headers: { authorization: `Bearer ${makeAuthToken(trackerUser)}` },
    });

    await trackingHandler(req as any, res as any);

    expect(mockPrisma.fasonTracking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 5 }),
      })
    );
  });

  it('forDashboard=true ile tekil iş emirlerini döner', async () => {
    mockVerifyToken.mockReturnValue({ id: 1, email: 'admin@test.com', role: 'ADMIN' });
    const mockTrackings = [
      { id: 1, workOrderId: 10, status: 'BEKLIYOR' },
      { id: 2, workOrderId: 10, status: 'ATÖLYEDE' },
      { id: 3, workOrderId: 11, status: 'HAZIR' },
    ];
    mockPrisma.fasonTracking.findMany.mockResolvedValue(mockTrackings);

    const { req, res } = createMocks({
      method: 'GET',
      headers: { authorization: `Bearer ${makeAuthToken()}` },
      query: { forDashboard: 'true' },
    });

    await trackingHandler(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.data).toHaveLength(2);
  });

  it('workOrderId filtresiyle sorgular', async () => {
    mockVerifyToken.mockReturnValue({ id: 1, email: 'admin@test.com', role: 'ADMIN' });
    mockPrisma.fasonTracking.findMany.mockResolvedValue([]);

    const { req, res } = createMocks({
      method: 'GET',
      headers: { authorization: `Bearer ${makeAuthToken()}` },
      query: { workOrderId: '42' },
    });

    await trackingHandler(req as any, res as any);

    expect(mockPrisma.fasonTracking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workOrderId: 42 }),
      })
    );
  });
});
