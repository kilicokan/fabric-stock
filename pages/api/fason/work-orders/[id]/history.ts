import { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { withCors } from '@/lib/cors';
import { getWorkOrderHistory } from '@/lib/work-order-queries';

/**
 * İş emrinin tam işlem geçmişini döndürür
 * GET /api/fason/work-orders/[id]/history
 * 
 * Response örneği:
 * {
 *   workOrder: { ... },
 *   processingHistory: [ ... ],
 *   summary: {
 *     totalStages: number,
 *     completedStages: number,
 *     currentStage: string,
 *     completionPercentage: number
 *   }
 * }
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!verifyToken(req.headers.authorization)) {
        return res.status(401).json(errorResponse('Unauthorized', 'UNAUTHORIZED'));
    }

    try {
        switch (req.method) {
            case 'GET':
                return handleGet(req, res);
            default:
                return res.status(405).json(errorResponse('Method not allowed'));
        }
    } catch (error) {
        console.error('💥 Work Order History API Error:', error);
        return res.status(500).json(errorResponse('Internal server error'));
    }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
    const { id } = req.query;

    if (!id || isNaN(parseInt(id as string))) {
        return res.status(400).json(errorResponse('Valid work order ID is required', 'VALIDATION_ERROR'));
    }

    const workOrderId = parseInt(id as string);

    // Query helper'ı kullanarak history'yi getir
    const history = await getWorkOrderHistory(workOrderId);

    if (!history) {
        return res.status(404).json(errorResponse('Work order not found', 'NOT_FOUND'));
    }

    return res.json(successResponse(history));
}

export default withCors(handler);
