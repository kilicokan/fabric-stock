import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const { modelNo, orderNo, customerId, layerCount, productWeight, cuttingTableId, fabricEntryId } = req.body;

      const newExit = await prisma.fabricExit.create({
        data: {
          modelNo,
          orderNo,
          customerId,
          layerCount: Number(layerCount),
          productWeight: Number(productWeight),
          cuttingTableId: Number(cuttingTableId),
          fabricEntryId: Number(fabricEntryId)
        }
      });

      res.status(201).json(newExit);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Kayıt eklenirken hata oluştu' });
    }
  } else if (req.method === 'GET') {
    const exits = await prisma.fabricExit.findMany({
      include: {
        cuttingTable: true,
        fabricEntry: true
      }
    });
    res.status(200).json(exits);
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
