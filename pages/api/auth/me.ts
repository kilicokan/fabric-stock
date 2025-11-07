import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token bulunamadı' });
    }

    // JWT token'ı doğrula ve decode et
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret-key') as any;
    
    // Kullanıcı bilgilerini veritabanından al
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        stockAccess: true,
        fasonAccess: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    return res.json({ user });

  } catch (error) {
    console.error('Auth me error:', error);
    return res.status(401).json({ error: 'Geçersiz token' });
  }
}
