import { NextApiRequest, NextApiResponse } from 'next';
import prisma from "@/lib/prisma";
import jwt from 'jsonwebtoken';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getJwtSecret } from '@/lib/runtime-config';


// JWT token doğrulama middleware
const verifyToken = (req: NextApiRequest) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new Error('Token bulunamadı');

  return jwt.verify(token, getJwtSecret());
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    verifyToken(req);

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // List active system users who are allowed to use the mobile app.
    const fasonTrackers = await prisma.user.findMany({
      where: {
        isActive: true,
        mobileAccess: true,
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

    return res.json(successResponse(fasonTrackers));
    } catch (error) {
    console.error('API Error:', error);
    return res.status(401).json(errorResponse('Unauthorized', 'UNAUTHORIZED'));
  }
}
