import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { fabricType, color, weightKg, lengthMeter, supplier } = req.body;
    
    // lengthMeter artık zorunlu değil, boşsa null olabilir
    console.log('Kumaş girişi kaydedildi:', {
      fabricType,
      color,
      weightKg,
      lengthMeter: lengthMeter || null, // Boşsa null yap
      supplier
    });
    
    res.status(201).json({ message: 'Kumaş girişi başarıyla kaydedildi!' });
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}