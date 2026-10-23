import prisma from '@/lib/prisma';
import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken'; // Import the jsonwebtoken library
import { successResponse, errorResponse } from '@/lib/api-response';
import { sendMobileTrackerNotification, sendPushNotification } from '@/lib/notification-service';
import { Prisma } from '@prisma/client';
import { getJwtSecret } from '@/lib/runtime-config';
import { withCors } from '@/lib/cors';

const extractOrderItemId = (externalRef?: string | null): number | null => {
    if (!externalRef) return null;
    const match = externalRef.match(/(?:customer-order:\d+:item:|item:)(\d+)/i);
    if (!match || !match[1]) return null;
    const parsed = Number(match[1]);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const extractCustomerOrderId = (externalRef?: string | null): number | null => {
    if (!externalRef) return null;
    const match = externalRef.match(/customer-order:(\d+):item:/i);
    if (!match || !match[1]) return null;
    const parsed = Number(match[1]);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const extractColorFromNotes = (notes?: string | null): string => {
    if (!notes) return '';
    const colorMatch = notes.match(/(Renk|Color)\s*[:\-]?\s*([A-Za-z0-9çşığıöüÇŞİĞÖÜ\s]+)/i);
    if (colorMatch && colorMatch[2]) {
        return colorMatch[2].trim();
    }
    return notes.trim();
};

// JWT token doğrulama middleware
const verifyToken = (req: NextApiRequest) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) throw new Error('Token bulunamadı');

    return jwt.verify(token, getJwtSecret());
};

export default withCors(async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        verifyToken(req);

        const { id } = req.query;

        if (!id || Array.isArray(id)) {
            return res.status(400).json({ error: 'Invalid id' });
        }

        const numericId = parseInt(id as string, 10);
        if (Number.isNaN(numericId)) {
            return res.status(400).json({ error: 'Invalid id' });
        }

        switch (req.method) {
            case 'GET':
                return await handleGet(req, res, numericId);
            case 'PUT':
                return await handlePut(req, res, numericId);
            case 'DELETE':
                return await handleDelete(req, res, numericId);
            default:
                return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('API Error:', error);
        return res.status(401).json({ error: 'Unauthorized' });
    }
});

// İş emri getir
async function handleGet(req: NextApiRequest, res: NextApiResponse, id: number) {
    const workOrder = await prisma.workOrder.findUnique({
        where: { id },
        include: {
            fasonTrackings: {
                include: {
                    workshop: true,
                    user: true
                },
                orderBy: {
                    createdAt: 'asc'
                }
            },
            assignedUser: {
                select: {
                    id: true,
                    name: true,
                    email: true
                }
            }
        }
    });

    if (!workOrder) {
        return res.status(404).json(errorResponse('Work order not found', 'NOT_FOUND'));
    }

    const orderItemId = extractOrderItemId(workOrder.externalErpId);
    const customerOrderId = extractCustomerOrderId(workOrder.externalErpId);

    let productColor = '';
    let colorVariants: string[] = [];

    if (customerOrderId) {
        const allOrderItems = await prisma.customerOrderItem.findMany({
            where: { orderId: customerOrderId },
            select: { id: true, color: true },
        });
        colorVariants = [...new Set(allOrderItems.map(item => item.color).filter(Boolean))];
    }

    if (orderItemId) {
        const orderItem = await prisma.customerOrderItem.findUnique({
            where: { id: orderItemId },
            select: { color: true },
        });
        productColor = orderItem?.color || extractColorFromNotes(workOrder.notes);
    } else {
        productColor = extractColorFromNotes(workOrder.notes);
    }

    if (productColor && colorVariants.includes(productColor)) {
        colorVariants = [productColor, ...colorVariants.filter(c => c !== productColor)];
    } else if (productColor && !colorVariants.length) {
        colorVariants = [productColor];
    }

    return res.json(successResponse({
        ...workOrder,
        productColor,
        colorVariants,
    }));
}

// İş emri güncelle
const handlePut = async (req: NextApiRequest, res: NextApiResponse, id: number) => {
    try {
        const {
            assignedUserId,
            status,
            assignedToMobile,
            quantity,
            sewingNotes,
            centralWarehouseReceived,
            centralWarehouseStainedQuantity,
            centralWarehouseDefectiveQuantity,
            centralWarehouseRepairQuantity,
            centralWarehouseLostQuantity,
        } = req.body;

        // Check if work order exists and get its current status
        const existingWorkOrder = await prisma.workOrder.findUnique({
            where: { id }
        });

        if (!existingWorkOrder) {
            return res.status(404).json({ error: 'İş emri bulunamadı' });
        }

        const isWarehouseReceipt = centralWarehouseReceived === true;
        const warehouseCounts = {
            centralWarehouseStainedQuantity,
            centralWarehouseDefectiveQuantity,
            centralWarehouseRepairQuantity,
            centralWarehouseLostQuantity,
        };
        let ironingTracking: {
            workshopId: number;
            unitPrice: number | null;
            receivedQuantity: number | null;
            assignedQuantity: number | null;
        } | null = null;

        if (isWarehouseReceipt) {
            if (status !== 'TESLIM_EDILDI') {
                return res.status(400).json({ error: 'Merkez Depo teslimi iş emri kapatılarak kaydedilmelidir.' });
            }
            if (Object.values(warehouseCounts).some(value => !Number.isInteger(value) || Number(value) < 0)) {
                return res.status(400).json({ error: 'Lekeli, defolu, tamir ve kayıp adetleri 0 veya daha büyük tam sayı olmalıdır.' });
            }
            const completedIroningTrackings = await prisma.fasonTracking.findMany({
                where: {
                    workOrderId: id,
                    processType: 'UTU',
                    status: 'TESLIM_EDILDI',
                    workshopId: { not: null },
                },
                select: {
                    workshopId: true,
                    unitPrice: true,
                    receivedQuantity: true,
                    assignedQuantity: true,
                },
                orderBy: { createdAt: 'desc' },
            });
            ironingTracking = completedIroningTrackings.find(
                (tracking): tracking is typeof tracking & { workshopId: number } => tracking.workshopId !== null
            ) || null;
            const classifiedQuantity = Object.values(warehouseCounts).reduce(
                (total, value) => total + Number(value),
                0
            );
            if (classifiedQuantity > existingWorkOrder.quantity) {
                return res.status(400).json({
                    error: `Kontrol edilen toplam adet iş emri miktarını (${existingWorkOrder.quantity}) aşamaz.`,
                });
            }
            if (Number(centralWarehouseLostQuantity) > 0 && !ironingTracking) {
                return res.status(400).json({ error: 'Kayıp adedi için tamamlanmış ütü atölyesi kaydı bulunamadı.' });
            }
        }

        const wasAssignedToMobile = existingWorkOrder.assignedToMobile;

        const isOnlyMobileAssignmentUpdate =
            typeof assignedToMobile !== 'undefined' &&
            typeof status === 'undefined' &&
            typeof assignedUserId === 'undefined' &&
            typeof quantity === 'undefined' &&
            typeof sewingNotes === 'undefined';

         // Prevent modifications to closed work orders (except mobile assignment toggle)
        if (existingWorkOrder.status === 'TESLIM_EDILDI' && !isOnlyMobileAssignmentUpdate) {
            return res.status(403).json({ 
                error: 'Bu iş emri kapatılmıştır. Veri girişi yapılamaz.' 
            });
        }

        // Kapatma kuralları: TESLIM_EDILDI sadece tüm süreçler bitmiş ve
        // Merkez Depo'ya teslim alındığında (centralWarehouseReceived: true) yapılabilir.
        if (status === 'TESLIM_EDILDI') {
            const fasonTrackings = await prisma.fasonTracking.findMany({
                where: {
                    workOrderId: id,
                    processType: { in: ['KESIM', 'DIKIM', 'UTU'] }
                }
            });

            const requiredProcesses = ['KESIM' as const, 'DIKIM' as const, 'UTU' as const];
            const missingProcesses = requiredProcesses.filter(processType => {
                const completedQty = fasonTrackings
                    .filter(t => t.processType === processType && t.status === 'TESLIM_EDILDI')
                    .reduce((sum, t) => sum + (t.receivedQuantity ?? t.assignedQuantity ?? 0), 0);
                const lostQty = isWarehouseReceipt && processType === 'UTU'
                    ? Number(centralWarehouseLostQuantity)
                    : 0;
                return completedQty + lostQty < existingWorkOrder.quantity;
            });

            if (missingProcesses.length > 0) {
                return res.status(400).json({
                    error: `İş emri kapatılamaz. Eksik süreçler: ${missingProcesses.join(', ')}`,
                    code: 'PROCESS_INCOMPLETE'
                });
            }

            if (!centralWarehouseReceived) {
                return res.status(400).json({
                    error: 'İş emri, Merkez Depo\'ya teslim alınmadan kapatılamaz.',
                    code: 'WAREHOUSE_NOT_RECEIVED'
                });
            }
        }

        const data: Prisma.WorkOrderUpdateInput = {
            updatedAt: new Date()
        };

        if (typeof assignedUserId !== 'undefined') {
            const parsedAssignedUserId = assignedUserId === null || assignedUserId === ''
                ? null
                : Number(assignedUserId);
            if (parsedAssignedUserId !== null && (!Number.isInteger(parsedAssignedUserId) || parsedAssignedUserId <= 0)) {
                return res.status(400).json({ error: 'Geçerli bir mobil takipçi seçilmelidir.' });
            }

            if (parsedAssignedUserId !== null) {
                const assignee = await prisma.user.findFirst({
                    where: {
                        id: parsedAssignedUserId,
                        isActive: true,
                        mobileAccess: true,
                    },
                    select: { id: true },
                });
                if (!assignee) {
                    return res.status(400).json({ error: 'Seçilen kullanıcı aktif değil veya mobil erişimi bulunmuyor.' });
                }
                data.assignedUser = { connect: { id: parsedAssignedUserId } };
                data.assignedToMobile = true;
                data.mobileAssignmentDate = new Date();
            } else {
                data.assignedUser = { disconnect: true };
                data.assignedToMobile = false;
                data.mobileAssignmentDate = null;
            }
        }

        if (typeof status !== 'undefined') {
            data.status = status;
        }

        // only set assignedToMobile if provided
        if (typeof assignedToMobile !== 'undefined' && typeof assignedUserId === 'undefined') {
            const normalizedAssignedToMobile =
                assignedToMobile === true || assignedToMobile === 'true';
            data.assignedToMobile = normalizedAssignedToMobile;
            data.mobileAssignmentDate = normalizedAssignedToMobile ? new Date() : null;
        }

        // If quantity is provided (for work order completion)
        if (typeof quantity !== 'undefined') {
            data.quantity = quantity;
        }

        if (typeof sewingNotes !== 'undefined') {
            data.sewingNotes = sewingNotes;
        }

        if (typeof centralWarehouseReceived !== 'undefined') {
            data.centralWarehouseReceived = centralWarehouseReceived === true;
        }

        if (isWarehouseReceipt) {
            data.centralWarehouseStainedQuantity = Number(centralWarehouseStainedQuantity);
            data.centralWarehouseDefectiveQuantity = Number(centralWarehouseDefectiveQuantity);
            data.centralWarehouseRepairQuantity = Number(centralWarehouseRepairQuantity);
            data.centralWarehouseLostQuantity = Number(centralWarehouseLostQuantity);
        }

        const workOrder = isWarehouseReceipt
            ? await prisma.$transaction(async tx => {
                const updated = await tx.workOrder.updateMany({
                    where: {
                        id,
                        centralWarehouseReceived: false,
                        status: { not: 'TESLIM_EDILDI' },
                    },
                    data,
                });
                if (updated.count !== 1) return null;

                const lostDeduction = Number(centralWarehouseLostQuantity) * Number(ironingTracking?.unitPrice ?? 0);
                if (lostDeduction > 0 && ironingTracking?.workshopId) {
                    await tx.fasonWorkshop.update({
                        where: { id: ironingTracking.workshopId },
                        data: { balance: { decrement: lostDeduction } },
                    });
                }

                return tx.workOrder.findUnique({
                    where: { id },
                    include: {
                        assignedUser: {
                            select: { id: true, name: true, email: true }
                        }
                    }
                });
            })
            : await prisma.workOrder.update({
                where: { id },
                data,
                include: {
                    assignedUser: {
                        select: { id: true, name: true, email: true }
                    }
                }
            });

        if (!workOrder) {
            return res.status(409).json({ error: 'Bu iş emri için Merkez Depo teslimi daha önce kaydedilmiş.' });
        }

        const requestedAssigneeId = assignedUserId === null || assignedUserId === ''
            ? null
            : Number(assignedUserId);
        const wasAssignedToDifferentUser =
            typeof assignedUserId !== 'undefined' &&
            requestedAssigneeId !== null &&
            existingWorkOrder.assignedUserId !== requestedAssigneeId;
        const shouldNotifyMobileTracker =
            workOrder.assignedToMobile &&
            (!wasAssignedToMobile || wasAssignedToDifferentUser);

        if (shouldNotifyMobileTracker) {
            sendMobileTrackerNotification({
                id: workOrder.id,
                orderNo: workOrder.orderNo,
                productCode: workOrder.productCode,
                productName: workOrder.productName,
                customerName: workOrder.customerName,
                quantity: workOrder.quantity,
                status: workOrder.status,
                assignedUserId: workOrder.assignedUserId,
            });
        }

        const shouldNotifyAssignee =
            typeof assignedUserId !== 'undefined' &&
            requestedAssigneeId !== null &&
            Number.isInteger(requestedAssigneeId) &&
            requestedAssigneeId > 0 &&
            (existingWorkOrder.assignedUserId !== requestedAssigneeId || !wasAssignedToMobile);

        if (shouldNotifyAssignee) {
            void sendPushNotification(
                requestedAssigneeId,
                'Yeni mobil iş emri',
                `${workOrder.orderNo} numaralı iş emri mobil uygulamanıza atandı.`,
                {
                    type: 'work-order-assigned',
                    workOrderId: workOrder.id,
                    orderNo: workOrder.orderNo,
                }
            );
        }

        return res.status(200).json(workOrder);
    } catch (error) {
        console.error('Error updating work order:', error);
        return res.status(500).json({ error: 'Failed to update work order' });
    }
};

// İş emri sil
async function handleDelete(req: NextApiRequest, res: NextApiResponse, id: number) {
    // Transaction kullanarak ilişkili kayıtları ve iş emrini sil
    await prisma.$transaction(async (tx) => {
        // Önce ilişkili dış kaynak üretim track kayıtlarını sil
        await tx.fasonTracking.deleteMany({
            where: { workOrderId: id }
        });

        // Sonra iş emrini sil
        await tx.workOrder.delete({
            where: { id }
        });
    });

    return res.status(204).end();
}
