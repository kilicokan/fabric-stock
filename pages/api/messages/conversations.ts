import prisma from '@/lib/prisma';
import jwt, { JwtPayload } from 'jsonwebtoken';
import type { NextApiRequest, NextApiResponse } from 'next';
import { withCors } from '@/lib/cors';
import { getJwtSecret } from '@/lib/runtime-config';

type AuthTokenPayload = JwtPayload & {
  id: number;
  name?: string;
  email?: string;
  role?: string;
};

type ConversationAggregate = {
  partnerId: number;
  partnerName: string;
  partnerEmail: string;
  lastMessage: string;
  lastMessageTime: Date | null;
  unreadCount: number;
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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = verifyToken(req);

    const allUsers = await prisma.user.findMany({
      where: {
        id: {
          not: user.id,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    const messages = await prisma.message.findMany({
      where: {
        OR: [{ senderId: user.id }, { recipientId: user.id }],
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
      orderBy: { createdAt: 'desc' },
    });

    const conversationsMap = new Map<number, ConversationAggregate>();

    allUsers.forEach((participant) => {
      conversationsMap.set(participant.id, {
        partnerId: participant.id,
        partnerName: participant.name || participant.email,
        partnerEmail: participant.email,
        lastMessage: '',
        lastMessageTime: null,
        unreadCount: 0,
      });
    });

    messages.forEach((msg) => {
      const partnerId = msg.senderId === user.id ? msg.recipientId : msg.senderId;
      const existing = conversationsMap.get(partnerId);
      if (!existing) return;

      if (!existing.lastMessageTime || msg.createdAt > existing.lastMessageTime) {
        existing.lastMessage = msg.content;
        existing.lastMessageTime = msg.createdAt;
      }

      if (msg.recipientId === user.id && !msg.isRead) {
        existing.unreadCount += 1;
      }
    });

    const conversations = Array.from(conversationsMap.values())
      .map((conv) => ({
        id: conv.partnerId,
        userName: conv.partnerName,
        userEmail: conv.partnerEmail,
        userRole: 'Kullanici',
        userImage: (conv.partnerName?.charAt(0) || '?').toUpperCase(),
        lastMessage: conv.lastMessage || 'Henuz mesaj yok',
        lastMessageTime: conv.lastMessageTime
          ? conv.lastMessageTime.toISOString()
          : new Date(0).toISOString(),
        unreadCount: conv.unreadCount,
        isOnline: false,
      }))
      .sort(
        (a, b) =>
          new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
      );

    const transformedConversations = conversations.map((conv) => ({
      userId: conv.id,
      userName: conv.userName,
      userEmail: conv.userEmail,
      lastMessage: conv.lastMessage,
      lastMessageAt: conv.lastMessageTime,
      unreadCount: conv.unreadCount,
    }));

    return res.status(200).json({
      success: true,
      data: transformedConversations,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);

    if (error instanceof jwt.JsonWebTokenError || message === 'Token bulunamadi') {
      return res.status(401).json({ error: 'Invalid token', details: message });
    }

    return res.status(500).json({ error: 'Failed to fetch conversations', details: message });
  }
};

export default withCors(handler);
