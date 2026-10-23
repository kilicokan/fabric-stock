import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import prisma from '@/lib/prisma';

type JwtUserPayload = JwtPayload & {
  role?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Yetkisiz erisim' });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({ message: 'JWT ayari eksik' });
    }

    const decoded = jwt.verify(token, jwtSecret) as JwtUserPayload;

    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Yetkiniz yok' });
    }

    if (req.method === 'GET') {
      const users = await prisma.user.findMany();
      return res.status(200).json(users);
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (err) {
    return res.status(401).json({ message: 'Gecersiz token' });
  }
}
