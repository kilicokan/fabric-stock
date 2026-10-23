import { createMocks } from 'node-mocks-http';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    spreadingMachine: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(),
}));

import handler from '@/pages/api/spreading-machines';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

const mockPrisma = prisma as unknown as {
  spreadingMachine: {
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
};
const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;

describe('/api/spreading-machines layer source', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns scale as the default data source for existing machines', async () => {
    mockPrisma.spreadingMachine.findMany.mockResolvedValue([{
      id: 1,
      code: 'CUT-01',
      name: 'Kesim 1',
      dataSource: undefined,
      cuttingTable: { id: 2, name: 'Masa 2' },
    }]);
    const { req, res } = createMocks({ method: 'GET' });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual({
      success: true,
      data: [expect.objectContaining({ id: 1, dataSource: 'scale' })],
    });
  });

  it('defaults new machines to manual counting', async () => {
    mockVerifyToken.mockReturnValue({ id: 1, email: 'admin@example.com', role: 'ADMIN' });
    mockPrisma.spreadingMachine.create.mockResolvedValue({ id: 1, layerSource: 'MANUAL' });
    const { req, res } = createMocks({
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: { code: 'CUT-01', name: 'Kesim 1', cuttingTableId: 2 },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(201);
    expect(mockPrisma.spreadingMachine.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ layerSource: 'MANUAL' }),
    }));
  });

  it('does not allow unauthenticated machine configuration changes', async () => {
    mockVerifyToken.mockReturnValue(null);
    const { req, res } = createMocks({
      method: 'POST',
      body: { code: 'CUT-01', name: 'Kesim 1', cuttingTableId: 2, layerSource: 'PLC' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(401);
    expect(mockPrisma.spreadingMachine.create).not.toHaveBeenCalled();
  });

  it('requires an administrator to change a machine source', async () => {
    mockVerifyToken.mockReturnValue({ id: 3, email: 'operator@example.com', role: 'OPERATOR' });
    const { req, res } = createMocks({
      method: 'PATCH',
      headers: { authorization: 'Bearer token' },
      body: { id: 1, layerSource: 'PLC' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(403);
    expect(mockPrisma.spreadingMachine.update).not.toHaveBeenCalled();
  });

  it('saves a PLC source for an administrator-configured machine', async () => {
    mockVerifyToken.mockReturnValue({ id: 1, email: 'admin@example.com', role: 'ADMIN' });
    mockPrisma.spreadingMachine.update.mockResolvedValue({ id: 1, layerSource: 'PLC' });
    const { req, res } = createMocks({
      method: 'PATCH',
      headers: { authorization: 'Bearer token' },
      body: { id: 1, layerSource: 'PLC' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(mockPrisma.spreadingMachine.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 1 },
      data: { layerSource: 'PLC' },
    }));
  });
});
