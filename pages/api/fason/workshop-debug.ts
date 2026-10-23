import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from "@/lib/prisma";
import * as jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import { ensureDebugEndpointEnabled, getJwtSecret } from '@/lib/runtime-config';

type AuthPayload = JwtPayload & {
    userId?: number;
    email?: string;
    role?: string;
};

const getErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : 'Unknown error';


const verifyToken = (req: NextApiRequest) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) throw new Error('Token bulunamadı');

    return jwt.verify(token, getJwtSecret()) as AuthPayload;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!ensureDebugEndpointEnabled(res)) return;

    try {
        const user = verifyToken(req);

        if (req.method !== 'GET') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        return handleGet(req, res, user);
    } catch (error) {
        console.error('API Error:', error);
        return res.status(401).json({ error: 'Unauthorized' });
    }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse, user: AuthPayload) {
    try {
        // Debug: Tüm atölyeleri say
        const workshopCount = await prisma.fasonWorkshop.count();

        // Debug: Tüm work order'ları say
        const workOrderCount = await prisma.workOrder.count();

        // Debug: Tüm tracking'leri say
        const trackingCount = await prisma.fasonTracking.count();

        // Debug: Workshop'a atanmış tracking'leri say
        const assignedTrackingCount = await prisma.fasonTracking.count({
            where: { workshopId: { not: null } },
        });

        // Debug: Atölyeler listesi
        const workshops = await prisma.fasonWorkshop.findMany({
            select: {
                id: true,
                name: true,
                specialization: true,
                isActive: true,
                _count: {
                    select: { fasonTrackings: true },
                },
            },
        });

        // Debug: Workshop'a atanmış iş emirleri
        const assignedOrders = await prisma.fasonTracking.findMany({
            where: { workshopId: { not: null } },
            select: {
                id: true,
                status: true,
                workshopId: true,
                workOrderId: true,
                totalPrice: true,
                createdAt: true,
                workOrder: {
                    select: {
                        orderNo: true,
                        productCode: true,
                        customerName: true,
                    },
                },
                workshop: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            take: 20,
            orderBy: { createdAt: 'desc' },
        });

        // Debug: Hiç atölyesi olmayan iş emirleri
        const unassignedTrackings = await prisma.fasonTracking.findMany({
            where: { workshopId: null },
            select: {
                id: true,
                status: true,
                workOrderId: true,
                createdAt: true,
                workOrder: {
                    select: {
                        orderNo: true,
                        productCode: true,
                    },
                },
            },
            take: 20,
        });

        return res.status(200).json({
            debug: {
                counts: {
                    totalWorkshops: workshopCount,
                    totalWorkOrders: workOrderCount,
                    totalTrackings: trackingCount,
                    trackingsWithWorkshop: assignedTrackingCount,
                    trackingsWithoutWorkshop: trackingCount - assignedTrackingCount,
                },
                workshops: workshops.map(w => ({
                    ...w,
                    trackingCount: w._count.fasonTrackings,
                })),
                sampleAssignedTrackings: assignedOrders,
                sampleUnassignedTrackings: unassignedTrackings,
                recommendation: assignedTrackingCount === 0 
                    ? 'Henüz atölyelere iş emri atanmamış. Lütfen workshop-assignment sayfasında atama yapınız.' 
                    : `${assignedTrackingCount} adet tracking kaydı atölyelere atanmış.`,
            },
        });
    } catch (error) {
        console.error('Error in debug:', error);
        return res.status(500).json({ error: 'Server error', details: getErrorMessage(error) });
    }
}


