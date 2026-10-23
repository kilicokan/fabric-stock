import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { TokenPayload, verifyToken } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { withCors } from '@/lib/cors';
import { OrderStatus, Prisma, ProcessStatus, ProcessType } from '@prisma/client';

const isProcessType = (value: unknown): value is ProcessType =>
    typeof value === 'string' && Object.values(ProcessType).includes(value as ProcessType);

const isProcessStatus = (value: unknown): value is ProcessStatus =>
    typeof value === 'string' && Object.values(ProcessStatus).includes(value as ProcessStatus);

async function handler(req: NextApiRequest, res: NextApiResponse) {

    const user = verifyToken(req.headers.authorization);
    if (!user) {
        return res.status(401).json(errorResponse('Unauthorized', 'UNAUTHORIZED'));
    }

    try {
        switch (req.method) {
            case 'GET':
                return handleGet(req, res, user);
            case 'POST':
                return handlePost(req, res, user);
            case 'PUT':
            case 'PATCH':
                return handlePut(req, res, user);
            default:
                return res.status(405).json(errorResponse('Method not allowed'));
        }
    } catch (error) {
        console.error('💥 API Error:', error);
        return res.status(500).json(errorResponse('Internal server error'));
    }
}

// Takip kayıtlarını listele (mobil app için)
async function handleGet(req: NextApiRequest, res: NextApiResponse, user: TokenPayload) {
    const { workOrderId, userId, processType, status, forDashboard } = req.query;

    const where: Prisma.FasonTrackingWhereInput = {};
    if (workOrderId) where.workOrderId = parseInt(workOrderId as string);
    if (userId) where.userId = parseInt(userId as string);
    if (isProcessType(processType)) where.processType = processType;
    if (isProcessStatus(status)) where.status = status;

    // Eğer kullanıcı FASON_TRACKER ise sadece kendi kayıtlarını görebilir
    if (user.role === 'FASON_TRACKER') {
        where.userId = user.id;
    }

    const trackings = await prisma.fasonTracking.findMany({
        where,
        include: {
            workOrder: true,
            workshop: true,
            user: { select: { name: true, email: true, phone: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    // Dashboard için: Benzersiz iş emirlerini döndür
    if (forDashboard === 'true') {
        // Her workOrder için en son tracking kaydını al
        const trackingMap = new Map<number, (typeof trackings)[number]>();
        trackings.forEach(tracking => {
            if (!trackingMap.has(tracking.workOrderId)) {
                trackingMap.set(tracking.workOrderId, tracking);
            }
        });

        const uniqueTrackings = Array.from(trackingMap.values());
        return res.json(successResponse(uniqueTrackings));
    }

    return res.json(successResponse(trackings));
}

// Yeni takip kaydı oluştur (mobil app'den)
async function handlePost(req: NextApiRequest, res: NextApiResponse, user: TokenPayload) {
    const {
        workOrderId,
        workshopId,
        processType,
        status,
        startDate,
        endDate,
        pickupDate,
        deliveryDate,
        notes,
        problemNotes,
        latitude,
        longitude
    } = req.body;

    // Validasyon: Gerekli alanları kontrol et
    if (!workOrderId || !processType || !status) {
        return res.status(400).json(errorResponse('workOrderId, processType ve status alanları zorunludur', 'VALIDATION_ERROR'));
    }

    // WorkOrder'ın varlığını kontrol et
    const workOrder = await prisma.workOrder.findUnique({
        where: { id: parseInt(workOrderId) }
    });

    if (!workOrder) {
        return res.status(404).json(errorResponse('İş emri bulunamadı', 'NOT_FOUND'));
    }

    // Workshop varsa varlığını kontrol et
    if (workshopId) {
        const workshop = await prisma.fasonWorkshop.findUnique({
            where: { id: parseInt(workshopId) }
        });
        if (!workshop) {
            return res.status(404).json(errorResponse('Atölye bulunamadı', 'NOT_FOUND'));
        }
    }

const tracking = await prisma.fasonTracking.create({
        data: {
            workOrderId: parseInt(workOrderId),
            workshopId: workshopId ? parseInt(workshopId) : null,
            userId: user.id, // JWT'den gelen kullanıcı ID
            processType,
            status,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
            pickupDate: pickupDate ? new Date(pickupDate) : null,
            deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
            notes,
            problemNotes,
            latitude: latitude ? parseFloat(latitude) : null,
            longitude: longitude ? parseFloat(longitude) : null
        }
    });

    // İş emrinin durumunu doğrudan kullanıcının seçtiği status ile güncelle
    // ProcessStatus'tan OrderStatus'a dönüştür
    const statusMapping: Record<ProcessStatus, OrderStatus> = {
        'BEKLIYOR': OrderStatus.BEKLIYOR,
        'ALINDI': OrderStatus.ALINDI,
        'ATÖLYEDE': OrderStatus.ATÖLYEDE,
        'HAZIR': OrderStatus.HAZIR,
        'TESLIM_EDILDI': OrderStatus.TESLIM_EDILDI,
        'SORUN_VAR': OrderStatus.SORUN_VAR,
        'IPTAL_EDILDI': OrderStatus.SORUN_VAR
    };

    // Geçerli bir status ise workOrder'ı güncelle
    if (isProcessStatus(status) && statusMapping[status]) {
        await prisma.workOrder.update({
            where: { id: parseInt(workOrderId) },
            data: { status: statusMapping[status] }
        });
    }

    // Durum 'ALINDI' ise müşteri bakiyesinden düş
    if (status === 'ALINDI') {
        // İş emri için toplam atanmış tutarı hesapla
        const assignments = await prisma.fasonTracking.findMany({
            where: {
                workOrderId: parseInt(workOrderId),
                totalPrice: { not: null }
            },
            select: { totalPrice: true }
        });

        const totalAssigned = assignments.reduce((sum, a) => sum + (a.totalPrice || 0), 0);

        if (totalAssigned > 0) {
            // Müşteriyi ada göre bul
            const customerNames = (workOrder.customerName || '')
                .split(',')
                .map(name => name.trim())
                .filter(Boolean);

            const customers = customerNames.length > 0
                ? await prisma.customer.findMany({
                    where: {
                        name: {
                            in: customerNames
                        }
                    }
                })
                : [];

            if (customers.length > 0) {
                const decrementAmount = totalAssigned / customers.length;

                await prisma.$transaction(
                    customers.map((customer) =>
                        prisma.customer.update({
                            where: { id: customer.id },
                            data: {
                                balance: {
                                    decrement: decrementAmount
                                }
                            }
                        })
                    )
                );
            }
        }

        // İş emri durumunu 'ALINDI' olarak güncelle
        await prisma.workOrder.update({
            where: { id: parseInt(workOrderId) },
            data: { status: 'ALINDI' }
        });
    }

    return res.status(201).json(successResponse(tracking));
}

// Takip kaydı güncelle
async function handlePut(req: NextApiRequest, res: NextApiResponse, user: TokenPayload) {
    const { id, ...updateData } = req.body as Record<string, unknown>;

    if (!id) {
        return res.status(400).json(errorResponse('ID is required', 'VALIDATION_ERROR'));
    }

    const parsedId = Number(id);
    if (Number.isNaN(parsedId)) {
        return res.status(400).json(errorResponse('Invalid ID', 'VALIDATION_ERROR'));
    }

    const existing = await prisma.fasonTracking.findUnique({
        where: { id: parsedId },
        select: { id: true, userId: true }
    });

    if (!existing) {
        return res.status(404).json(errorResponse('Kayit bulunamadi', 'NOT_FOUND'));
    }

    if (user.role === 'FASON_TRACKER' && existing.userId !== user.id) {
        return res.status(403).json(errorResponse('Bu kaydi guncelleme yetkiniz yok', 'FORBIDDEN'));
    }

    const tracking = await prisma.fasonTracking.update({
        where: { id: parsedId },
        data: {
            processType: isProcessType(updateData.processType) ? updateData.processType : undefined,
            status: isProcessStatus(updateData.status) ? updateData.status : undefined,
            notes: typeof updateData.notes === 'string' ? updateData.notes : undefined,
            problemNotes: typeof updateData.problemNotes === 'string' ? updateData.problemNotes : undefined,
            startDate: updateData.startDate ? new Date(String(updateData.startDate)) : undefined,
            endDate: updateData.endDate ? new Date(String(updateData.endDate)) : undefined,
            pickupDate: updateData.pickupDate ? new Date(String(updateData.pickupDate)) : undefined,
            deliveryDate: updateData.deliveryDate ? new Date(String(updateData.deliveryDate)) : undefined,
            latitude: updateData.latitude ? parseFloat(String(updateData.latitude)) : undefined,
            longitude: updateData.longitude ? parseFloat(String(updateData.longitude)) : undefined,
            updatedAt: new Date()
        }
    });

    return res.json(successResponse(tracking));
}

// Süreç durumuna göre iş emrinin bir sonraki durumunu belirle
function getNextOrderStatus(processType: string): OrderStatus | null {
    const statusMap: Record<ProcessType, OrderStatus> = {
        KESIM: OrderStatus.ALINDI,
        DIKIM: OrderStatus['ATÖLYEDE'],
        BASKI_NAKIS: OrderStatus.HAZIR,
        UTU: OrderStatus.TESLIM_EDILDI,
        BASKI: OrderStatus.HAZIR,
        NAKIS: OrderStatus.HAZIR,
        ILIK_DUGME: OrderStatus.HAZIR,
        OZEL: OrderStatus['ATÖLYEDE']
    };

    return isProcessType(processType) ? statusMap[processType] : null;
}

export default withCors(handler);



