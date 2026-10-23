import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const user = verifyToken(req.headers.authorization);
    if (!user) {
        return res.status(401).json(errorResponse('Unauthorized', 'UNAUTHORIZED'));
    }

    try {
        switch (req.method) {
            case 'GET':
                return handleGet(req, res, user);
            case 'PUT':
                return handlePut(req, res, user);
            default:
                return res.status(405).json(errorResponse('Method not allowed'));
        }
    } catch (error) {
        console.error('💥 API Error:', error);
        return res.status(500).json(errorResponse('Internal server error'));
    }
}

// Tüm atölyelerin kapasite bilgilerini getir
async function handleGet(req: NextApiRequest, res: NextApiResponse, user: unknown) {
    const { workshopId } = req.query;

    try {
        if (workshopId) {
            // Belirli bir atölyenin kapasite bilgisi
            const workshop = await prisma.fasonWorkshop.findUnique({
                where: { id: parseInt(workshopId as string) }
            });

            if (!workshop) {
                return res.status(404).json(errorResponse('Atölye bulunamadı', 'NOT_FOUND'));
            }

            const capacityData = await calculateWorkshopCapacity(parseInt(workshopId as string));
            return res.json(successResponse({
                workshop,
                ...capacityData
            }));
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
                        capacity: workshop.capacity,
                        capacityType: workshop.capacityType,
                        ...capacityData
                    };
                })
            );

            return res.json(successResponse({ workshops: workshopsWithCapacity }));
        }
    } catch (error) {
        console.error('💥 Kapasite bilgisi alınırken hata:', error);
        return res.status(500).json(errorResponse('Kapasite bilgisi alınamadı'));
    }
}

// Atölyenin maxCapacity'sini güncelle (ayarlardan)
async function handlePut(req: NextApiRequest, res: NextApiResponse, user: unknown) {
    const { workshopId, maxCapacity } = req.body;

    if (!workshopId || maxCapacity === undefined) {
        return res.status(400).json(errorResponse('workshopId ve maxCapacity alanları zorunludur', 'VALIDATION_ERROR'));
    }

    try {
        const workshop = await prisma.fasonWorkshop.update({
            where: { id: parseInt(workshopId) },
            data: { maxCapacity: parseFloat(maxCapacity) }
        });

        return res.json(successResponse({
            message: `${workshop.name} atölyesinin kapasitesi ${maxCapacity} olarak güncellendi`,
            workshop
        }));
    } catch (error) {
        console.error('💥 Kapasite güncellenirken hata:', error);
        return res.status(500).json(errorResponse('Kapasite güncellenemedi'));
    }
}

// Bir atölyenin kapasite bilgisini hesapla
async function calculateWorkshopCapacity(workshopId: number) {
    try {
        // Atölyeyi bul
        const workshop = await prisma.fasonWorkshop.findUnique({
            where: { id: workshopId }
        });

        if (!workshop) {
            return {
                assignedOrderCount: 0,
                totalAssignedAmount: 0,
                totalCompletedAmount: 0,
                totalUsedCapacity: 0,
                maxCapacity: 500000,
                capacityPercentage: 0,
                remainingCapacity: 500000,
                orderStatuses: { pending: 0, inProgress: 0, completed: 0, problems: 0 },
                totalOrders: 0,
                definedCapacityUsage: 0,
                definedCapacityPercentage: 0,
                products: []
            };
        }

        // Atölyeye atanan tüm işleri bul (ürün kodu bilgisi ile)
        const trackings = await prisma.fasonTracking.findMany({
            where: {
                workshopId,
                status: { not: 'IPTAL_EDILDI' } // İptal edilen işleri hariç tut
            },
            include: {
                workOrder: {
                    select: {
                        id: true,
                        productCode: true,
                        productName: true,
                        quantity: true,
                        notes: true,
                    }
                }
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

        // Sistem kapasitesi hesaplaması (maxCapacity - mevcut sistem için)
        const maxCapacity = workshop.maxCapacity || 500000;
        const totalUsedCapacity = totalAssignedAmount + totalCompletedAmount;
        const capacityPercentage = (totalUsedCapacity / maxCapacity) * 100;
        const remainingCapacity = Math.max(0, maxCapacity - totalUsedCapacity);

        // Tanımlı kapasite hesaplaması (atölye yönetiminde belirlenen kapasite)
        // NOT: workshop.capacity = kalan/açık kapasite (malı teslim aldıkça azalır)
        let definedCapacityUsage = 0;
        let definedCapacityPercentage = 0;
        let definedCapacityMax = 0;

        if (workshop.maxCapacity && workshop.maxCapacity > 0) {
            if (workshop.capacityType === 'TL') {
                // Tutar bazlı kapasite
                // workshop.capacity = kalan kapasite
                // Kullanılan = maxCapacity - capacity
                definedCapacityMax = workshop.maxCapacity;
                const usedCapacity = workshop.maxCapacity - (workshop.capacity || 0);
                definedCapacityUsage = usedCapacity;
                definedCapacityPercentage = (usedCapacity / workshop.maxCapacity) * 100;
            } else if (workshop.capacityType === 'ADET') {
                // Adet bazlı kapasite
                // workshop.capacity = kalan adet kapasitesi
                definedCapacityMax = workshop.maxCapacity;
                const usedCapacity = workshop.maxCapacity - (workshop.capacity || 0);
                definedCapacityUsage = usedCapacity;
                definedCapacityPercentage = (usedCapacity / workshop.maxCapacity) * 100;
            }
        }

        // Ürün detayları - hangi modelden kaç adet var (renk/varyant bilgisi ile)
        const productDetails: Record<string, {
            productCode: string;
            productName?: string;
            quantity: number;
            variants: Set<string>;
        }> = {};

        assignedTrackings.forEach(t => {
            const code = t.workOrder?.productCode;
            if (code) {
                if (!productDetails[code]) {
                    productDetails[code] = {
                        productCode: code,
                        productName: t.workOrder?.productName || undefined,
                        quantity: 0,
                        variants: new Set<string>()
                    };
                }
                productDetails[code].quantity += t.assignedQuantity || 0;

                // Renk/varyant bilgisini ekle (notes'den çıkart)
                if (t.workOrder?.notes) {
                    const variants = t.workOrder.notes
                        .split(',')
                        .map(v => v.trim())
                        .filter(v => v.length > 0);
                    variants.forEach(v => productDetails[code].variants.add(v));
                }
            }
        });

        const productsArray = Object.values(productDetails).map(p => ({
            ...p,
            variants: Array.from(p.variants)
        }));

        return {
            assignedOrderCount: assignedTrackings.length,
            totalAssignedAmount,
            totalCompletedAmount,
            totalUsedCapacity,
            maxCapacity,
            capacityPercentage: Math.min(capacityPercentage, 100),
            remainingCapacity,
            orderStatuses: statuses,
            totalOrders: trackings.length,
            definedCapacityUsage,
            definedCapacityPercentage: Math.min(definedCapacityPercentage, 100),
            products: productsArray,
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
            totalOrders: 0,
            definedCapacityUsage: 0,
            definedCapacityPercentage: 0,
            products: [],
        };
    }
}
