import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

const LAYER_SOURCES = new Set(['PLC', 'MANUAL']);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const machines = await prisma.spreadingMachine.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { cuttingTable: { select: { id: true, name: true } } },
    });
    return res.status(200).json({
      success: true,
      data: machines.map(machine => ({
        ...machine,
        dataSource: machine.dataSource || 'scale',
      })),
    });
  }

  if (req.method === 'POST') {
    const user = verifyToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role !== 'ADMIN') return res.status(403).json({ error: 'Bu işlem için yönetici yetkisi gerekir.' });

    const { code, name, cuttingTableId, layerSource } = req.body || {};
    const tableId = Number(cuttingTableId);
    if (typeof code !== 'string' || !code.trim() || typeof name !== 'string' || !name.trim() ||
        !Number.isInteger(tableId) || tableId <= 0 ||
        (layerSource !== undefined && !LAYER_SOURCES.has(layerSource))) {
      return res.status(400).json({ error: 'Kod, makine adı ve geçerli kesim masası zorunludur.' });
    }

    try {
      const machine = await prisma.spreadingMachine.create({
        data: {
          code: code.trim(),
          name: name.trim(),
          layerSource: layerSource ?? 'MANUAL',
          cuttingTable: { connect: { id: tableId } },
        },
        include: { cuttingTable: { select: { id: true, name: true } } },
      });
      return res.status(201).json({ success: true, data: machine });
    } catch (error) {
      console.error('Serim makinesi oluşturulamadı:', error);
      return res.status(400).json({ error: 'Serim makinesi oluşturulamadı.' });
    }
  }

  if (req.method === 'PATCH') {
    const user = verifyToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role !== 'ADMIN') return res.status(403).json({ error: 'Bu işlem için yönetici yetkisi gerekir.' });

    const machineId = Number(req.body?.id);
    const { layerSource } = req.body || {};
    if (!Number.isInteger(machineId) || machineId <= 0 || !LAYER_SOURCES.has(layerSource)) {
      return res.status(400).json({ error: 'Geçerli makine ve kat kaynağı seçilmelidir.' });
    }

    try {
      const machine = await prisma.spreadingMachine.update({
        where: { id: machineId },
        data: { layerSource },
        include: { cuttingTable: { select: { id: true, name: true } } },
      });
      return res.status(200).json({ success: true, data: machine });
    } catch (error) {
      console.error('Serim makinesi kat kaynağı güncellenemedi:', error);
      return res.status(500).json({ error: 'Serim makinesi kat kaynağı güncellenemedi.' });
    }
  }

  res.setHeader('Allow', 'GET, POST, PATCH');
  return res.status(405).json({ error: 'Yöntem desteklenmiyor.' });
}
