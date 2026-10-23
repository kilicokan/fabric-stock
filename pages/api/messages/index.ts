import prisma from '@/lib/prisma';
import jwt, { JwtPayload } from 'jsonwebtoken';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Prisma } from '@prisma/client';
import { withCors } from '@/lib/cors';
import { sendNotification, sendPushNotification } from '@/lib/notification-service';
import { getJwtSecret } from '@/lib/runtime-config';

type AuthTokenPayload = JwtPayload & {
  id: number;
  name?: string;
  email?: string;
  role?: string;
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown error';

const verifyToken = (req: NextApiRequest): AuthTokenPayload => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new Error('Token bulunamadi');

  const decoded = jwt.verify(token, getJwtSecret());
  if (typeof decoded === 'string') throw new Error('Invalid token payload');

  const id = Number((decoded as { id?: unknown }).id);
  if (Number.isNaN(id)) throw new Error('Invalid token payload');

  return {
    ...decoded,
    id,
    name: typeof decoded.name === 'string' ? decoded.name : undefined,
    email: typeof decoded.email === 'string' ? decoded.email : undefined,
    role: typeof decoded.role === 'string' ? decoded.role : undefined,
  };
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const user = verifyToken(req);

    switch (req.method) {
      case 'GET':
        return handleGet(req, res, user);
      case 'POST':
        return handlePost(req, res, user);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: unknown) {
    const message = getErrorMessage(error);

    if (error instanceof jwt.JsonWebTokenError || message === 'Token bulunamadi') {
      return res.status(401).json({ error: 'Unauthorized', details: message });
    }

    return res.status(401).json({ error: 'Unauthorized', details: message });
  }
};

async function handleGet(req: NextApiRequest, res: NextApiResponse, user: AuthTokenPayload) {
  const { conversationWith, unreadOnly } = req.query;
  if (typeof conversationWith !== 'string') {
    return res.status(400).json({ error: 'conversationWith is required' });
  }

  const otherUserId = Number(conversationWith);
  if (Number.isNaN(otherUserId)) {
    return res.status(400).json({ error: 'conversationWith must be numeric' });
  }

  try {
    const where: Prisma.MessageWhereInput = {
      OR: [
        { senderId: user.id, recipientId: otherUserId },
        { senderId: otherUserId, recipientId: user.id },
      ],
    };

    if (unreadOnly === 'true') {
      where.AND = [{ isRead: false }, { recipientId: user.id }];
    }

    const messages = await prisma.message.findMany({
      where,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        recipient: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return res.status(200).json({
      success: true,
      data: messages.reverse(),
    });
  } catch (error: unknown) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse, user: AuthTokenPayload) {
  const { recipientId, content } = req.body as { recipientId?: unknown; content?: unknown };
  const parsedRecipientId = Number(recipientId);
  const parsedContent = typeof content === 'string' ? content.trim() : '';

  if (Number.isNaN(parsedRecipientId) || !parsedContent) {
    return res.status(400).json({ error: 'recipientId and content are required' });
  }

  try {
    const recipient = await prisma.user.findUnique({
      where: { id: parsedRecipientId },
    });

    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    const message = await prisma.message.create({
      data: {
        senderId: user.id,
        recipientId: parsedRecipientId,
        content: parsedContent,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        recipient: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const senderName = user.name || user.email || `Kullanici ${user.id}`;
    const bodyPreview = `${senderName}: ${parsedContent.substring(0, 50)}...`;

    await sendNotification({
      type: 'message',
      title: 'Yeni Mesaj',
      body: bodyPreview,
      recipientId: parsedRecipientId,
      senderId: user.id,
      data: {
        messageId: message.id,
        conversationWith: user.id,
      },
    });

    await sendPushNotification(parsedRecipientId, 'Yeni Mesaj', bodyPreview, {
      messageId: message.id,
      conversationWith: user.id,
    });

    return res.status(201).json({
      success: true,
      data: message,
    });
  } catch (error: unknown) {
    console.error('Error creating message:', error);
    return res.status(500).json({ error: 'Failed to create message' });
  }
}

export default withCors(handler);
