import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from "@/lib/prisma";


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const taxRates = await prisma.taxRate.findMany();
      return res.status(200).json(taxRates);
    }
    if (req.method === 'POST') {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ message: 'Vergi oranı adı zorunludur.' });
      }
      const newTaxRate = await prisma.taxRate.create({
        data: { name },
      });
      return res.status(201).json(newTaxRate);
    }
    return res.status(405).json({ message: 'Yalnızca GET ve POST metodları destekleniyor.' });
  } catch (err: unknown) {
    console.error('API Error:', err);
    return res.status(500).json({ message: 'Sunucu hatası', error: err instanceof Error ? err.message : 'Bilinmeyen hata' });
  }
}


