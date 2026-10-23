import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { withCors } from '@/lib/cors';
import { Prisma, WorkshopType } from '@prisma/client';

const isWorkshopType = (value: unknown): value is WorkshopType =>
    typeof value === 'string' && Object.values(WorkshopType).includes(value as WorkshopType);

async function handler(req: NextApiRequest, res: NextApiResponse) {

    try {
        switch (req.method) {
            case 'GET':
                // GET is public for mobile apps
                return handleGet(req, res);
            case 'POST':
            case 'PUT':
            case 'DELETE':
                // These methods require authentication
                const user = verifyToken(req.headers.authorization);
                if (!user) {
                    return res.status(401).json(errorResponse('Unauthorized', 'UNAUTHORIZED'));
                }
                if (req.method === 'POST') return handlePost(req, res);
                if (req.method === 'PUT') return handlePut(req, res);
                if (req.method === 'DELETE') return handleDelete(req, res);
            default:
                return res.status(405).json(errorResponse('Method not allowed'));
        }
    } catch (error) {
        console.error('💥 API Error:', error);
        return res.status(500).json(errorResponse('Internal server error'));
    }
}

// Atölyeleri listele
async function handleGet(req: NextApiRequest, res: NextApiResponse) {
    const { specialization, isActive, includeCapacity } = req.query;

    const where: Prisma.FasonWorkshopWhereInput = {};
    if (isWorkshopType(specialization)) where.specialization = specialization;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const workshops = await prisma.fasonWorkshop.findMany({
        where,
        orderBy: { name: 'asc' }
    });

    // Kapasite bilgisini ekle (isterseniz)
    let workshopsWithCapacity = workshops;
    if (includeCapacity === 'true') {
        workshopsWithCapacity = await Promise.all(
            workshops.map(async (workshop) => {
                const capacityData = await getWorkshopCapacityData(workshop.id);
                return {
                    ...workshop,
                    ...capacityData
                };
            })
        );
    }

    return res.json(successResponse(workshopsWithCapacity));
}

// Helper: Atölyenin kapasite verilerini getir
// NOT: workshop.capacity = kalan/açık kapasite (malı teslim aldıkça azalır)
async function getWorkshopCapacityData(workshopId: number) {
    try {
        const workshop = await prisma.fasonWorkshop.findUnique({
            where: { id: workshopId }
        });

        if (!workshop || !workshop.maxCapacity) {
            return {
                definedCapacityUsage: 0,
                definedCapacityPercentage: 0
            };
        }

        // Kalan kapasite (0 veya positive value)
        const remainingCapacity = Math.max(0, workshop.capacity || 0);

        // Kullanılan kapasite = maxCapacity - kalan kapasite
        const usedCapacity = Math.max(0, workshop.maxCapacity - remainingCapacity);

        // Kapasite yüzdesini hesapla (0-100%)
        const capacityPercentage = (usedCapacity / workshop.maxCapacity) * 100;

        if (workshop.capacityType === 'TL') {
            return {
                definedCapacityUsage: Math.round(usedCapacity),
                definedCapacityPercentage: Math.min(100, Math.max(0, capacityPercentage))
            };
        } else {
            // ADET bazlı
            return {
                definedCapacityUsage: Math.round(usedCapacity),
                definedCapacityPercentage: Math.min(100, Math.max(0, capacityPercentage))
            };
        }
    } catch (error) {
        console.error('Kapasite verisi alınırken hata:', error);
        return {
            definedCapacityUsage: 0,
            definedCapacityPercentage: 0
        };
    }
}

// Yeni atölye oluştur
async function handlePost(req: NextApiRequest, res: NextApiResponse) {
    const {
        name,
        contactPerson,
        phone,
        address,
        specialization,
        capacity,
        capacityType
    } = req.body;

    if (!name || !specialization) {
        return res.status(400).json(errorResponse('Name and specialization are required', 'VALIDATION_ERROR'));
    }

    // Parse maxCapacity (set from form or default to 500000)
    const maxCapacity = capacity ? parseFloat(capacity) : 500000;

    const workshop = await prisma.fasonWorkshop.create({
        data: {
            name,
            contactPerson,
            phone,
            address,
            specialization,
            maxCapacity, // Maximum capacity
            capacity: maxCapacity, // Başlangıçta capacity = maxCapacity (hiç mal atanmadığı için)
            capacityType: capacityType || 'TL'
        }
    });

    return res.status(201).json(successResponse(workshop));
}

// Atölye güncelle
async function handlePut(req: NextApiRequest, res: NextApiResponse) {
    const { id } = req.query;
    const updateData = req.body;

    if (!id) {
        return res.status(400).json(errorResponse('ID is required', 'VALIDATION_ERROR'));
    }

    // Convert capacity to number if it exists and is a string
    const processedData: Record<string, unknown> = { ...updateData };
    const rawCapacity = processedData.capacity;
    if (rawCapacity !== undefined && rawCapacity !== null && rawCapacity !== '') {
        const newCapacity = parseFloat(String(rawCapacity));
        processedData.maxCapacity = newCapacity;
        processedData.capacity = newCapacity;
    } else {
        processedData.capacity = null;
        processedData.maxCapacity = null;
    }

    const workshop = await prisma.fasonWorkshop.update({
        where: { id: parseInt(id as string) },
        data: {
            ...processedData,
            updatedAt: new Date()
        }
    });

    return res.json(successResponse(workshop));
}

// Atölye sil
async function handleDelete(req: NextApiRequest, res: NextApiResponse) {
    const { id } = req.query;

    if (!id) {
        return res.status(400).json(errorResponse('ID is required', 'VALIDATION_ERROR'));
    }

    await prisma.fasonWorkshop.delete({
        where: { id: parseInt(id as string) }
    });

    return res.json(successResponse({ message: 'Workshop deleted successfully' }));
}

// Mobil uygulama için PUBLIC atölyeler endpoint
export async function mobileWorkshopsPublicHandler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Only GET method allowed' });

    // Set CORS headers for mobile access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    try {
        const workshops = await prisma.fasonWorkshop.findMany({
            where: { isActive: true }, // Only active workshops
            select: {
                id: true,
                name: true,
                specialization: true,
                contactPerson: true,
                phone: true,
                capacity: true,
                capacityType: true,
            },
            orderBy: { name: 'asc' },
        });
        res.status(200).json({ workshops });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
}

export default withCors(handler);


