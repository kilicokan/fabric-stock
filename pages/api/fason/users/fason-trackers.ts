import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// JWT token doğrulama middleware
const verifyToken = (req: NextApiRequest) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new Error('Token bulunamadı');

  return jwt.verify(token, process.env.JWT_SECRET || 'secret-key');
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const user = verifyToken(req);

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // FASON_TRACKER rolüne sahip kullanıcıları getir
    const fasonTrackers = await prisma.user.findMany({
      where: {
        role: 'FASON_TRACKER'
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    return res.json({ fasonTrackers });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
