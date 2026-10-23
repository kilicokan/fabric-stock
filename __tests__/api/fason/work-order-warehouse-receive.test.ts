import { createMocks } from 'node-mocks-http';

jest.mock('@/lib/prisma', () => ({
    __esModule: true,
    default: {
        fasonTracking: { findMany: jest.fn() },
        workOrder: { findUnique: jest.fn() },
        $transaction: jest.fn(),
    },
}));

jest.mock('jsonwebtoken', () => ({
    __esModule: true,
    default: { verify: jest.fn(() => ({ userId: 1 })) },
}));

jest.mock('@/lib/notification-service', () => ({
    sendMobileTrackerNotification: jest.fn(),
    sendPushNotification: jest.fn(),
}));

import handler from '@/pages/api/fason/work-orders/[id]';
import prisma from '@/lib/prisma';

const mockPrisma = prisma as unknown as {
    fasonTracking: { findMany: jest.Mock };
    workOrder: { findUnique: jest.Mock };
    $transaction: jest.Mock;
};
let transaction: {
    workOrder: { updateMany: jest.Mock; findUnique: jest.Mock };
    fasonWorkshop: { update: jest.Mock };
};

describe('central warehouse receipt quality counts', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        transaction = {
            workOrder: {
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                findUnique: jest.fn().mockResolvedValue({ id: 1, status: 'TESLIM_EDILDI' }),
            },
            fasonWorkshop: { update: jest.fn().mockResolvedValue({}) },
        };
        mockPrisma.workOrder.findUnique.mockResolvedValue({
            id: 1,
            status: 'HAZIR',
            assignedToMobile: false,
            quantity: 10,
            centralWarehouseReceived: false,
        });
        mockPrisma.fasonTracking.findMany
            .mockResolvedValueOnce([{
                workshopId: 7,
                unitPrice: 12.5,
                receivedQuantity: 8,
                assignedQuantity: 10,
            }])
            .mockResolvedValueOnce(['KESIM', 'DIKIM', 'UTU'].map(processType => ({
                processType,
                status: 'TESLIM_EDILDI',
                receivedQuantity: processType === 'UTU' ? 8 : 10,
                assignedQuantity: 10,
            })));
        mockPrisma.$transaction.mockImplementation(async callback => callback(transaction));
    });

    it('stores all entered counts and deducts only lost quantity from the ironing workshop balance', async () => {
        const { req, res } = createMocks({
            method: 'PUT',
            query: { id: '1' },
            headers: { authorization: 'Bearer valid-token' },
            body: {
                status: 'TESLIM_EDILDI',
                centralWarehouseReceived: true,
                centralWarehouseStainedQuantity: 1,
                centralWarehouseDefectiveQuantity: 2,
                centralWarehouseRepairQuantity: 1,
                centralWarehouseLostQuantity: 2,
            },
        });

        await handler(req as never, res as never);

        expect(res._getStatusCode()).toBe(200);
        expect(transaction.workOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                centralWarehouseStainedQuantity: 1,
                centralWarehouseDefectiveQuantity: 2,
                centralWarehouseRepairQuantity: 1,
                centralWarehouseLostQuantity: 2,
            }),
        }));
        expect(transaction.fasonWorkshop.update).toHaveBeenCalledWith({
            where: { id: 7 },
            data: { balance: { decrement: 25 } },
        });
    });
});
