import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const verifyToken = (req: NextApiRequest) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) throw new Error('Token bulunamadı');

    return jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key') as any;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const user = verifyToken(req);

        switch (req.method) {
            case 'GET':
                return handleGet(req, res, user);
            case 'PUT':
                return handlePut(req, res, user);
            default:
                return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('API Error:', error);
        return res.status(401).json({ error: 'Unauthorized' });
    }
}

// Tüm atölyelerin kapasite bilgilerini getir
async function handleGet(req: NextApiRequest, res: NextApiResponse, user: any) {
    const { workshopId } = req.query;

    try {
        if (workshopId) {
            // Belirli bir atölyenin kapasite bilgisi
            const workshop = await prisma.fasonWorkshop.findUnique({
                where: { id: parseInt(workshopId as string) }
            });

            if (!workshop) {
                return res.status(404).json({ error: 'Atölye bulunamadı' });
            }

            const capacityData = await calculateWorkshopCapacity(parseInt(workshopId as string));
            return res.json({
                workshop,
                ...capacityData
            });
        } else {
            // Tüm atölyelerin kapasite bilgisi
            const workshops = await prisma.fasonWorkshop.findMany({
                where: { isActive: true }
            });

            const workshopsWithCapacity = await Promise.all(
                workshops.map(async (workshop) => {
                    const capacityData = await calculateWorkshopCapacity(workshop.id);
                    return {
                        id: workshop.id,
                        name: workshop.name,
                        contactPerson: workshop.contactPerson,
                        phone: workshop.phone,
                        address: workshop.address,
                        specialization: workshop.specialization,
                        maxCapacity: workshop.maxCapacity,
                        ...capacityData
                    };
                })
            );

            return res.json({ workshops: workshopsWithCapacity });
        }
    } catch (error) {
        console.error('Kapasite bilgisi alınırken hata:', error);
        return res.status(500).json({ error: 'Kapasite bilgisi alınamadı' });
    }
}

// Atölyenin maxCapacity'sini güncelle (ayarlardan)
async function handlePut(req: NextApiRequest, res: NextApiResponse, user: any) {
    const { workshopId, maxCapacity } = req.body;

    if (!workshopId || maxCapacity === undefined) {
        return res.status(400).json({ error: 'workshopId ve maxCapacity alanları zorunludur' });
    }

    try {
        const workshop = await prisma.fasonWorkshop.update({
            where: { id: parseInt(workshopId) },
            data: { maxCapacity: parseFloat(maxCapacity) }
        });

        return res.json({
            success: true,
            message: `${workshop.name} atölyesinin kapasitesi ${maxCapacity} olarak güncellendi`,
            workshop
        });
    } catch (error) {
        console.error('Kapasite güncellenirken hata:', error);
        return res.status(500).json({ error: 'Kapasite güncellenemedi' });
    }
}

// Bir atölyenin kapasite bilgisini hesapla
async function calculateWorkshopCapacity(workshopId: number) {
    try {
        // Atölyeye atanan tüm işleri bul
        const trackings = await prisma.fasonTracking.findMany({
            where: {
                workshopId,
                status: { not: 'IPTAL_EDILDI' } // İptal edilen işleri hariç tut
            }
        });

        // Duruma göre işleri grupla
        const statuses = {
            pending: trackings.filter(t => t.status === 'BEKLIYOR').length,
            inProgress: trackings.filter(t => t.status === 'ATÖLYEDE').length,
            completed: trackings.filter(t => t.status === 'HAZIR' || t.status === 'TESLIM_EDILDI').length,
            problems: trackings.filter(t => t.status === 'SORUN_VAR').length
        };

        // Toplam atanan tutarı hesapla (BEKLIYOR ve ATÖLYEDE durumlarında)
        const assignedTrackings = trackings.filter(
            t => t.status === 'BEKLIYOR' || t.status === 'ATÖLYEDE'
        );
        const totalAssignedAmount = assignedTrackings.reduce(
            (sum, t) => sum + (t.totalPrice || 0),
            0
        );

        // Tamamlanan işlerin tutarını hesapla
        const completedTrackings = trackings.filter(
            t => t.status === 'HAZIR' || t.status === 'TESLIM_EDILDI'
        );
        const totalCompletedAmount = completedTrackings.reduce(
            (sum, t) => sum + (t.totalPrice || 0),
            0
        );

        // Atölyeyi bul ve maxCapacity al
        const workshop = await prisma.fasonWorkshop.findUnique({
            where: { id: workshopId }
        });

        const maxCapacity = workshop?.maxCapacity || 500000;
        const totalUsedCapacity = totalAssignedAmount + totalCompletedAmount;
        const capacityPercentage = (totalUsedCapacity / maxCapacity) * 100;
        const remainingCapacity = Math.max(0, maxCapacity - totalUsedCapacity);

        return {
            assignedOrderCount: assignedTrackings.length,
            totalAssignedAmount,
            totalCompletedAmount,
            totalUsedCapacity,
            maxCapacity,
            capacityPercentage: Math.min(capacityPercentage, 100),
            remainingCapacity,
            orderStatuses: statuses,
            totalOrders: trackings.length
        };
    } catch (error) {
        console.error('Kapasite hesaplanırken hata:', error);
        return {
            assignedOrderCount: 0,
            totalAssignedAmount: 0,
            totalCompletedAmount: 0,
            totalUsedCapacity: 0,
            maxCapacity: 500000,
            capacityPercentage: 0,
            remainingCapacity: 500000,
            orderStatuses: { pending: 0, inProgress: 0, completed: 0, problems: 0 },
            totalOrders: 0
        };
    }
}
