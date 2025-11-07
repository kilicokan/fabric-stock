import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      // Tüm çıkış kayıtlarını listele
      const exits = await prisma.fabricExit.findMany({
        include: {
          fabricEntry: { include: { fabric: true } },
          cuttingTable: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      return res.status(200).json(exits);
    }

    if (req.method === 'POST') {
      console.log('Gelen Body:', req.body);
      const {
        modelNo,
        orderNo,
        customerId,
        layerCount,
        grammage,
        externalProductId,
        productionKg,
        productionMeters,
        unitType,
        cuttingTable,
        color,
        fabricType,
        createdAt
      } = req.body;

      // Zorunlu alan doğrulamaları
      if (!cuttingTable) {
        return res.status(400).json({ error: 'Kesim masası zorunlu' });
      }
      if (!modelNo?.trim()) {
        return res.status(400).json({ error: 'Model No zorunlu' });
      }
      if (!orderNo?.trim()) {
        return res.status(400).json({ error: 'Sipariş No zorunlu' });
      }
      if (!customerId?.trim()) {
        return res.status(400).json({ error: 'Müşteri ID zorunlu' });
      }
      if (!fabricType?.trim()) {
        return res.status(400).json({ error: 'Kumaş türü zorunlu' });
      }
      if (!color?.trim()) {
        return res.status(400).json({ error: 'Renk zorunlu' });
      }
      if (unitType === 'kg' && (!productionKg || productionKg <= 0)) {
        return res.status(400).json({ error: 'Üretim miktarı (kg) pozitif bir sayı olmalı' });
      }
      if (unitType === 'm' && (!productionMeters || productionMeters <= 0)) {
        return res.status(400).json({ error: 'Üretim miktarı (metre) pozitif bir sayı olmalı' });
      }

      // cuttingTable ID'sinin geçerli olduğunu kontrol et
      const tableExists = await prisma.cuttingTable.findUnique({
        where: { id: Number(cuttingTable) }
      });
      if (!tableExists) {
        return res.status(400).json({ error: 'Geçersiz kesim masası ID\'si' });
      }

      const exit = await prisma.fabricExit.create({
        data: {
          modelNo,
          orderNo,
          customerId,
          layerCount: layerCount ? parseInt(layerCount) : 1,
          productWeightKg: productionKg ? parseFloat(productionKg) : 0,
          productLengthMeter: productionMeters ? parseFloat(productionMeters) : 0,
          cuttingTable: { connect: { id: Number(cuttingTable) } },
          grammage: grammage ? parseFloat(grammage) : 0,
          externalProductId: externalProductId || null,
          unitType,
          color: color || null,
          fabricType: fabricType || null,
          createdAt: createdAt ? new Date(createdAt) : new Date()
        }
      });

      return res.status(201).json(exit);
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error('FabricExit API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
