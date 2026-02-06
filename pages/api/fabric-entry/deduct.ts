import { prisma } from '@/lib/prisma';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { entryId, deductKg } = req.body;

  try {
    const entry = await prisma.fabricEntry.findUnique({ where: { id: entryId } });
    if (!entry) return res.status(404).json({ error: 'Giriş bulunamadı' });

    const newQty = entry.quantityKg - deductKg;
    if (newQty < 0) return res.status(400).json({ error: 'Stok yetersiz' });

    await prisma.fabricEntry.update({
      where: { id: entryId },
      data: { quantityKg: newQty },
    });

    res.status(200).json({ success: true, newQuantity: newQty });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}