import { createMocks } from 'node-mocks-http';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    fasonWorkshop: { findUnique: jest.fn() },
    fasonTracking: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    cuttingTable: { findUnique: jest.fn() },
    workOrder: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(),
}));

import workOrdersHandler from '@/pages/api/fason/work-orders';
import cuttingAssignmentHandler from '@/pages/api/fason/work-orders/[id]/cutting-assignment';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

const mockPrisma = prisma as unknown as {
  fasonWorkshop: { findUnique: jest.Mock };
  fasonTracking: { create: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
  cuttingTable: { findUnique: jest.Mock };
  workOrder: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  $transaction: jest.Mock;
};
const mockVerifyToken = verifyToken as jest.Mock;

describe('work-order cutting stage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyToken.mockReturnValue({ id: 1, email: 'admin@test.com', role: 'ADMIN' });
    mockPrisma.$transaction.mockImplementation((callback) => callback(mockPrisma));
  });

  it('creates internal-cut work orders in KESIM without mobile assignment', async () => {
    mockPrisma.workOrder.create.mockResolvedValue({ id: 21, quantity: 80 });
    mockPrisma.workOrder.findUnique.mockResolvedValue({
      id: 21,
      assignedToMobile: false,
      fasonTrackings: [{ processType: 'KESIM', workshopId: null }],
    });
    mockPrisma.fasonTracking.create.mockResolvedValue({});

    const { req, res } = createMocks({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: { orderNo: 'WO-21', productCode: 'M-21', quantity: 80 },
    });

    await workOrdersHandler(req as never, res as never);

    expect(res._getStatusCode()).toBe(201);
    expect(mockPrisma.workOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'BEKLIYOR',
          assignedToMobile: false,
          mobileAssignmentDate: null,
        }),
      })
    );
    expect(mockPrisma.fasonTracking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workOrderId: 21,
          processType: 'KESIM',
          status: 'BEKLIYOR',
          workshopId: null,
          userId: 1,
        }),
      })
    );
  });

  it('requires a workshop for fason cutting', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        orderNo: 'WO-22',
        productCode: 'M-22',
        quantity: 80,
        fasonCutting: true,
      },
    });

    await workOrdersHandler(req as never, res as never);

    expect(res._getStatusCode()).toBe(400);
    expect(mockPrisma.workOrder.create).not.toHaveBeenCalled();
  });

  it('creates fason-cut work orders against the selected cutting workshop', async () => {
    mockPrisma.fasonWorkshop.findUnique.mockResolvedValue({
      id: 9,
      isActive: true,
      specialization: 'KESIM',
    });
    mockPrisma.workOrder.create.mockResolvedValue({ id: 22, quantity: 80 });
    mockPrisma.workOrder.findUnique.mockResolvedValue({ id: 22, assignedToMobile: false });
    mockPrisma.fasonTracking.create.mockResolvedValue({});

    const { req, res } = createMocks({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        orderNo: 'WO-22',
        productCode: 'M-22',
        quantity: 80,
        fasonCutting: true,
        workshopId: 9,
      },
    });

    await workOrdersHandler(req as never, res as never);

    expect(res._getStatusCode()).toBe(201);
    expect(mockPrisma.fasonTracking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ processType: 'KESIM', workshopId: 9 }),
      })
    );
  });

  it('assigns the selected table user without mobile assignment', async () => {
    mockPrisma.workOrder.findUnique.mockResolvedValue({ id: 21, status: 'BEKLIYOR', quantity: 80 });
    mockPrisma.cuttingTable.findUnique.mockResolvedValue({
      id: 4,
      name: 'Masa 4',
      assignedUserId: 7,
      assignedUser: { id: 7, role: 'FASON_TRACKER', name: 'Kesim Kullanıcısı', email: 'cut@test.com' },
    });
    mockPrisma.fasonTracking.findFirst.mockResolvedValue({
      id: 30,
      workshopId: null,
    });
    mockPrisma.fasonTracking.update.mockResolvedValue({ id: 30, cuttingTableId: 4, userId: 7 });

    const { req, res } = createMocks({
      method: 'PATCH',
      headers: { authorization: 'Bearer valid-token' },
      query: { id: '21' },
      body: { cuttingTableId: 4 },
    });

    await cuttingAssignmentHandler(req as never, res as never);

    expect(res._getStatusCode()).toBe(200);
    expect(mockPrisma.fasonTracking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ cuttingTableId: 4, userId: 7 }),
      })
    );
    expect(mockPrisma.workOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assignedUserId: 7, assignedToMobile: false }),
      })
    );
  });
});
