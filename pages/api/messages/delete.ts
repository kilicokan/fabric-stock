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

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = verifyToken(req);
    const { messageId, conversationWith } = req.query;

    if (typeof messageId === 'string') {
      const parsedMessageId = Number(messageId);
      if (Number.isNaN(parsedMessageId)) {
        return res.status(400).json({ error: 'messageId sayi olmali' });
      }

      const message = await prisma.message.findUnique({
        where: { id: parsedMessageId },
      });

      if (!message) {
        return res.status(404).json({ error: 'Mesaj bulunamadi' });
      }

      if (message.senderId !== user.id) {
        return res.status(403).json({ error: 'Bu mesaji silme yetkiniz yok' });
      }

      await prisma.message.delete({
        where: { id: parsedMessageId },
      });

      return res.status(200).json({
        success: true,
        message: 'Mesaj silindi',
      });
    }

    if (typeof conversationWith === 'string') {
      const partnerId = Number(conversationWith);
      if (Number.isNaN(partnerId)) {
        return res.status(400).json({ error: 'conversationWith sayi olmali' });
      }

      const deletedCount = await prisma.message.deleteMany({
        where: {
          OR: [
            { senderId: user.id, recipientId: partnerId },
            { senderId: partnerId, recipientId: user.id },
          ],
        },
      });

      return res.status(200).json({
        success: true,
        message: `${deletedCount.count} mesaj silindi`,
        deletedCount: deletedCount.count,
      });
    }

    return res.status(400).json({ error: 'messageId veya conversationWith parametresi gerekli' });
  } catch (error: unknown) {
    console.error('Error deleting message:', error);
    const message = getErrorMessage(error);
    if (error instanceof jwt.JsonWebTokenError || message === 'Token bulunamadi') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(500).json({ error: 'Mesaj silinirken hata olustu' });
  }
};

export default withCors(handler);
