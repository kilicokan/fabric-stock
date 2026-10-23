import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import type { NextApiRequest, NextApiResponse } from 'next';
import { withCors } from '@/lib/cors';
import { getJwtSecret } from '@/lib/runtime-config';

const verifyToken = (req: NextApiRequest) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new Error('Token bulunamadı');
  return jwt.verify(token, getJwtSecret());
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = verifyToken(req) as any;
    const { expoPushToken } = req.body;

    if (!expoPushToken) {
      return res.status(400).json({ error: 'expoPushToken is required' });
    }

    // Update user with push token
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        expoPushToken
      },
      select: {
        id: true,
        email: true,
        name: true,
        expoPushToken: true
      }
    });

    console.log(`[Push Token] User ${user.id} registered push token`);

    return res.status(200).json({
      success: true,
      data: updatedUser
    });
  } catch (error: any) {
    console.error('[Push Token] Error:', error);
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(500).json({ error: 'Failed to save push token' });
  }
};

export default withCors(handler);
