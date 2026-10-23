import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = verifyToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const exits = await prisma.fabricExit.findMany({
      include: {
        cuttingTable: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const rows = exits.map(exit => {
      const unitType = exit.unitType || 'm';
      const quantity = unitType === 'kg' ? exit.productWeightKg : exit.productLengthMeter;
      const grammage = exit.grammage || 0;
      const converted = grammage > 0
        ? unitType === 'm'
          ? Number(((exit.productLengthMeter * grammage) / 1000).toFixed(2))
          : Number(((exit.productWeightKg * 1000) / grammage).toFixed(2))
        : null;
      const convertedUnit = unitType === 'm' ? 'kg' : 'm';

      return {
        id: exit.id,
        createdAt: exit.createdAt.toISOString(),
        reportNumber: exit.reportNumber || null,
        orderNo: exit.orderNo || '',
        modelNo: exit.modelNo || '',
        color: exit.color || '',
        fabricType: exit.fabricType || '',
        cuttingTable: exit.cuttingTable?.name || '',
        layerCount: exit.layerCount || 0,
        unitType,
        quantity: Number(quantity.toFixed(2)),
        grammage,
        convertedQuantity: converted,
        convertedUnit
      };
    });

    return res.status(200).json({ rows });
  } catch (error) {
    console.error('Cutting fabric conversion report error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
