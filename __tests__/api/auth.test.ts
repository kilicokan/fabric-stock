import { createMocks } from 'node-mocks-http';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-testing-only';
process.env.JWT_SECRET = JWT_SECRET;

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));

jest.mock('@/lib/cors', () => ({
  withCors: (handler: any) => handler,
  withAuthRateLimit: (handler: any) => handler,
}));

import loginHandler from '@/pages/api/auth/login';
import refreshHandler from '@/pages/api/auth/refresh';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const mockPrismaUser = prisma.user as jest.Mocked<typeof prisma.user>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('geçerli kimlik bilgileriyle başarıyla giriş yapar', async () => {
    const fakeUser = {
      id: 1,
      email: 'admin@test.com',
      password: '$2b$10$abcdefghijklmnopqrstuv',
      role: 'ADMIN',
      name: 'Admin User',
      stockAccess: true,
      fasonAccess: true,
    };
    (mockPrismaUser.findUnique as jest.Mock).mockResolvedValue(fakeUser);
    (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);

    const { req, res } = createMocks({
      method: 'POST',
      body: { email: 'admin@test.com', password: 'password123' },
    });

    await loginHandler(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.token).toBeDefined();
    expect(data.user.email).toBe('admin@test.com');
    expect(data.user.role).toBe('ADMIN');
    expect(data.user.password).toBeUndefined();
  });

  it('kullanıcı bulunamadığında 401 döner', async () => {
    (mockPrismaUser.findUnique as jest.Mock).mockResolvedValue(null);

    const { req, res } = createMocks({
      method: 'POST',
      body: { email: 'unknown@test.com', password: 'password123' },
    });

    await loginHandler(req as any, res as any);

    expect(res._getStatusCode()).toBe(401);
    const data = JSON.parse(res._getData());
    expect(data.message).toBeDefined();
  });

  it('yanlış şifre ile 401 döner', async () => {
    const fakeUser = {
      id: 1,
      email: 'admin@test.com',
      password: 'hashed_password',
      role: 'ADMIN',
      name: 'Admin',
      stockAccess: false,
      fasonAccess: false,
    };
    (mockPrismaUser.findUnique as jest.Mock).mockResolvedValue(fakeUser);
    (mockBcrypt.compare as jest.Mock).mockResolvedValue(false);

    const { req, res } = createMocks({
      method: 'POST',
      body: { email: 'admin@test.com', password: 'yanlis_sifre' },
    });

    await loginHandler(req as any, res as any);

    expect(res._getStatusCode()).toBe(401);
    const data = JSON.parse(res._getData());
    expect(data.message).toBeDefined();
  });

  it('POST dışındaki metotlarda 405 döner', async () => {
    const { req, res } = createMocks({ method: 'GET' });

    await loginHandler(req as any, res as any);

    expect(res._getStatusCode()).toBe(405);
  });

  it('dönen token geçerli JWT içeriğine sahiptir', async () => {
    const fakeUser = {
      id: 42,
      email: 'user@test.com',
      password: '$2b$10$abcdefghijklmnopqrstuv',
      role: 'OPERATOR',
      name: 'Test User',
      stockAccess: false,
      fasonAccess: true,
    };
    (mockPrismaUser.findUnique as jest.Mock).mockResolvedValue(fakeUser);
    (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);

    const { req, res } = createMocks({
      method: 'POST',
      body: { email: 'user@test.com', password: 'pass' },
    });

    await loginHandler(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    const decoded = jwt.verify(data.token, JWT_SECRET) as any;
    expect(decoded.id).toBe(42);
    expect(decoded.email).toBe('user@test.com');
    expect(decoded.role).toBe('OPERATOR');
  });

  it('veritabanı hatasında 500 döner', async () => {
    (mockPrismaUser.findUnique as jest.Mock).mockRejectedValue(new Error('DB bağlantı hatası'));

    const { req, res } = createMocks({
      method: 'POST',
      body: { email: 'admin@test.com', password: 'password' },
    });

    await loginHandler(req as any, res as any);

    expect(res._getStatusCode()).toBe(500);
  });
});

describe('POST /api/auth/refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('geçerli token ile yeni token üretir', async () => {
    const validToken = jwt.sign(
      { id: 1, email: 'admin@test.com', role: 'ADMIN' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const { req, res } = createMocks({
      method: 'POST',
      headers: { authorization: `Bearer ${validToken}` },
    });

    await refreshHandler(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.token).toBeDefined();
    expect(data.expiresIn).toBe(86400);
  });

  it('süresi dolmuş token ile yeni token üretir', async () => {
    const expiredToken = jwt.sign(
      { id: 1, email: 'admin@test.com', role: 'ADMIN' },
      JWT_SECRET,
      { expiresIn: '-1s' }
    );

    const { req, res } = createMocks({
      method: 'POST',
      headers: { authorization: `Bearer ${expiredToken}` },
    });

    await refreshHandler(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.token).toBeDefined();
  });

  it('token olmadan 401 döner', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {},
    });

    await refreshHandler(req as any, res as any);

    expect(res._getStatusCode()).toBe(401);
  });

  it('tamamen geçersiz token ile 401 döner', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: { authorization: 'Bearer bu.gecersiz.token' },
    });

    await refreshHandler(req as any, res as any);

    expect(res._getStatusCode()).toBe(401);
  });

  it('POST dışındaki metotlarda 405 döner', async () => {
    const { req, res } = createMocks({ method: 'DELETE' });

    await refreshHandler(req as any, res as any);

    expect(res._getStatusCode()).toBe(405);
  });
});
