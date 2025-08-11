import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Yetkisiz erişim' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Yetkiniz yok' });
    }

    if (req.method === 'GET') {
      // Veritabanından kullanıcıları getir
      const users = await prisma.user.findMany();
      return res.status(200).json(users);
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (err) {
    return res.status(401).json({ message: 'Geçersiz token' });
  }
}