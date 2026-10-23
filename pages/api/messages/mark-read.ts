import prisma from '@/lib/prisma';
import jwt, { JwtPayload } from 'jsonwebtoken';
import type { NextApiRequest, NextApiResponse } from 'next';
import { withCors } from '@/lib/cors';
import { getJwtSecret } from '@/lib/runtime-config';

type AuthTokenPayload = JwtPayload & { id: number };

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown error';

const verifyToken = (req: NextApiRequest): AuthTokenPayload => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new Error('Token bulunamadi');

  const decoded = jwt.verify(token, getJwtSecret());
  if (typeof decoded === 'string') throw new Error('Invalid token payload');

  const id = Number((decoded as { id?: unknown }).id);
  if (Number.isNaN(id)) throw new Error('Invalid token payload');

  return { ...decoded, id };
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = verifyToken(req);
    const { messageIds } = req.body as { messageIds?: unknown };

    if (!Array.isArray(messageIds)) {
      return res.status(400).json({ error: 'messageIds array is required' });
    }

    const numericMessageIds = messageIds
      .map((id) => Number(id))
      .filter((id) => !Number.isNaN(id));

    if (numericMessageIds.length === 0) {
      return res.status(400).json({ error: 'messageIds must contain numeric IDs' });
    }

    const updated = await prisma.message.updateMany({
      where: {
        id: { in: numericMessageIds },
        recipientId: user.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return res.status(200).json({
      updated: updated.count,
    });
  } catch (error: unknown) {
    console.error('Error marking messages as read:', error);
    const message = getErrorMessage(error);
    if (error instanceof jwt.JsonWebTokenError || message === 'Token bulunamadi') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(500).json({ error: 'Failed to mark messages as read' });
  }
};

export default withCors(handler);
