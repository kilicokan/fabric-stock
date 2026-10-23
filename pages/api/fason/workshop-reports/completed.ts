import { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { withCors } from '@/lib/cors';
import { getCompletedWorkOrdersReport } from '@/lib/work-order-queries';

/**
 * Tamamlanan iş emirlerinin detaylı raporunu döndürür
 * Atölye Raporu sayfası için tam işlem akışını içerir
 * 
 * GET /api/fason/workshop-reports/completed
 * 
 * Query params:
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - workshopId: number (opsiyonel - belirli atölyeye filtrele)
 * - status: string (opsiyonel - TESLIM_EDILDI, HAZIR, vb.)
 * - limit: number (default: 100)
 * - offset: number (default: 0)
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
    const user = verifyToken(req.headers.authorization);
    if (!user) {
        return res.status(401).json(errorResponse('Unauthorized', 'UNAUTHORIZED'));
    }

    try {
        switch (req.method) {
            case 'GET':
                return handleGet(req, res, user);
            default:
                return res.status(405).json(errorResponse('Method not allowed'));
        }
    } catch (error) {
        console.error('💥 Workshop Report API Error:', error);
        return res.status(500).json(errorResponse('Internal server error'));
    }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse, user: unknown) {
    const { startDate, endDate, workshopId, limit = '100', offset = '0' } = req.query;

    const pageLimit = Math.min(parseInt(limit as string) || 100, 500);
    const pageOffset = parseInt(offset as string) || 0;

    // Query helper'ı kullanarak raporları getir
    const report = await getCompletedWorkOrdersReport(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
        workshopId ? parseInt(workshopId as string) : undefined,
        pageLimit,
        pageOffset
    );

    return res.json(successResponse(report));
}

export default withCors(handler);
