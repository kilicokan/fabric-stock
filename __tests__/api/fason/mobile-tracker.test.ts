import { createMocks } from 'node-mocks-http';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    workOrder: { findMany: jest.fn(), count: jest.fn() },
    product: { findMany: jest.fn() },
  },
}));

jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(() => ({ id: 4 })),
}));

import handler from '@/pages/api/fason/work-orders/mobile';
import prisma from '@/lib/prisma';

const mockPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock };
  workOrder: { findMany: jest.Mock; count: jest.Mock };
  product: { findMany: jest.Mock };
};

describe('mobile work-order warehouse receipt data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ isActive: true, mobileAccess: true });
    mockPrisma.workOrder.findMany.mockResolvedValue([{
      id: 12,
      orderNo: 'WO-12',
      assignedToMobile: true,
      assignedUserId: 4,
      status: 'HAZIR',
      centralWarehouseReceived: false,
      centralWarehouseStainedQuantity: 0,
      centralWarehouseDefectiveQuantity: 0,
      centralWarehouseRepairQuantity: 0,
      centralWarehouseLostQuantity: 0,
      productCode: 'N-2458',
      productName: 'Tayt',
      quantity: 1000,
      customerName: 'Müşteri',
      priority: 'MEDIUM',
      deliveryDate: null,
      createdAt: new Date('2026-10-20T00:00:00Z'),
      sewingNotes: null,
      fasonTrackings: [{
        id: 1,
        workOrderId: 12,
        workshopId: 7,
        assignedQuantity: 1000,
        receivedQuantity: 1000,
        unitPrice: 2,
        processType: 'UTU',
        status: 'TESLIM_EDILDI',
        workshop: { name: 'Ütü Atölyesi' },
        cuttingTable: null,
      }],
    }]);
    mockPrisma.workOrder.count.mockResolvedValue(1);
    mockPrisma.product.findMany.mockResolvedValue([]);
  });

  it('returns status and quality fields needed by the mobile warehouse receipt form', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      headers: { authorization: 'Bearer valid-token' },
      query: { page: '1', limit: '50' },
    });

    await handler(req as never, res as never);

    expect(res._getStatusCode()).toBe(200);
    const order = res._getJSONData().workOrders[0];
    expect(order).toEqual(expect.objectContaining({
      workOrderStatus: 'HAZIR',
      centralWarehouseReceived: false,
      centralWarehouseStainedQuantity: 0,
      centralWarehouseDefectiveQuantity: 0,
      centralWarehouseRepairQuantity: 0,
      centralWarehouseLostQuantity: 0,
    }));
    expect(order.fasonTrackings[0]).toEqual(expect.objectContaining({
      processType: 'UTU',
      workshopId: 7,
      unitPrice: 2,
      receivedQuantity: 1000,
    }));
  });
});
