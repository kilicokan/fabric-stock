import { createMocks } from 'node-mocks-http';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    customerOrder: { findMany: jest.fn() },
    workOrder: { findMany: jest.fn() },
    product: { findMany: jest.fn() },
  },
}));

import handler from '@/pages/api/reports/order-cutting';
import prisma from '@/lib/prisma';

const mockPrisma = prisma as unknown as {
  customerOrder: { findMany: jest.Mock };
  workOrder: { findMany: jest.Mock };
  product: { findMany: jest.Mock };
};

describe('GET /api/reports/order-cutting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.customerOrder.findMany.mockResolvedValue([
      {
        id: 5,
        orderNo: 'CO-5',
        customer: { id: 1, name: 'Müşteri' },
        items: [{ id: 8, productCode: 'P-8', description: 'Ürün', color: 'Mavi', quantity: 100 }],
      },
    ]);
    mockPrisma.product.findMany.mockResolvedValue([]);
  });

  it('keeps the remaining quantity until the central warehouse accepts the goods', async () => {
    mockPrisma.workOrder.findMany.mockResolvedValue([
      {
        id: 21,
        orderNo: 'WO-21',
        quantity: 100,
        centralWarehouseReceived: false,
        externalErpId: 'customer-order:5:item:8',
        fasonTrackings: [{ assignedQuantity: 100, receivedQuantity: 100 }],
      },
    ]);

    const { req, res } = createMocks({ method: 'GET' });
    await handler(req as never, res as never);

    const report = JSON.parse(res._getData());
    expect(res._getStatusCode()).toBe(200);
    expect(report.rows[0]).toEqual(expect.objectContaining({
      cutQuantity: 100,
      remainingQuantity: 100,
    }));
  });

  it('clears the remaining quantity only after central warehouse acceptance', async () => {
    mockPrisma.workOrder.findMany.mockResolvedValue([
      {
        id: 21,
        orderNo: 'WO-21',
        quantity: 100,
        centralWarehouseReceived: true,
        externalErpId: 'customer-order:5:item:8',
        fasonTrackings: [{ assignedQuantity: 100, receivedQuantity: 100 }],
      },
    ]);

    const { req, res } = createMocks({ method: 'GET' });
    await handler(req as never, res as never);

    const report = JSON.parse(res._getData());
    expect(res._getStatusCode()).toBe(200);
    expect(report.rows[0]).toEqual(expect.objectContaining({
      cutQuantity: 100,
      remainingQuantity: 0,
    }));
  });
});
