import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const materialTypes = await prisma.materialType.findMany();
      return res.status(200).json(materialTypes);
    }
    if (req.method === 'POST') {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ message: 'Malzeme türü adı zorunludur.' });
      }
      const newMaterialType = await prisma.materialType.create({
        data: { name },
      });
      return res.status(201).json(newMaterialType);
    }
    return res.status(405).json({ message: 'Yalnızca GET ve POST metodları destekleniyor.' });
  } catch (err: any) {
    console.error('API Error:', err);
    return res.status(500).json({ message: 'Sunucu hatası', error: err.message });
  } finally {
    await prisma.$disconnect();
  }
}