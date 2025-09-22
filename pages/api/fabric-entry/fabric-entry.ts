import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { fabricType, color, weightKg, lengthMeter, supplier } = req.body;
    
    // Veritabanı kaydetme simülasyonu (gerçekte veritabanına kaydedin, örneğin Prisma/MongoDB ile)
    console.log('Kumaş girişi kaydedildi:', req.body);
    
    res.status(201).json({ message: 'Kumaş girişi başarıyla kaydedildi!' });
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}