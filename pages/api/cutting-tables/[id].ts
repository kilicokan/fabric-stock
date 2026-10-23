import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

const parsePositiveInt = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['PATCH']);
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const user = verifyToken(req.headers.authorization);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  if (user.role !== 'ADMIN') return res.status(403).json({ message: 'Bu işlem için yönetici yetkisi gerekir.' });

  const cuttingTableId = parsePositiveInt(req.query.id);
  if (!cuttingTableId) return res.status(400).json({ message: 'Geçerli kesim masası gerekli.' });

  const assignedUserId =
    req.body?.assignedUserId === null || req.body?.assignedUserId === ''
      ? null
      : parsePositiveInt(req.body?.assignedUserId);

  if (req.body?.assignedUserId !== null && req.body?.assignedUserId !== '' && !assignedUserId) {
    return res.status(400).json({ message: 'Geçerli kesim masası kullanıcısı seçin.' });
  }

  try {
    const table = await prisma.cuttingTable.findUnique({ where: { id: cuttingTableId } });
    if (!table) return res.status(404).json({ message: 'Kesim masası bulunamadı.' });

    if (assignedUserId !== null) {
      const assignedUser = await prisma.user.findUnique({
        where: { id: assignedUserId },
        select: { id: true, role: true },
      });
      if (!assignedUser || assignedUser.role !== 'FASON_TRACKER') {
        return res.status(400).json({ message: 'Kesim masasına yalnızca fason takipçi rolündeki kullanıcı atanabilir.' });
      }
    }

    const updatedTable = await prisma.cuttingTable.update({
      where: { id: cuttingTableId },
      data: { assignedUserId },
      include: {
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return res.status(200).json({ success: true, data: updatedTable });
  } catch (error) {
    console.error('Cutting table user assignment error:', error);
    return res.status(500).json({ message: 'Kesim masası kullanıcısı kaydedilemedi.' });
  }
}
