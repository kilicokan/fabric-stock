import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import type { NextApiRequest, NextApiResponse } from 'next';

const verifyToken = (req: NextApiRequest) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new Error('Token bulunamadı');
  return jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = verifyToken(req) as any;

    // Get all users except current user
    const allUsers = await prisma.user.findMany({
      where: {
        id: {
          not: user.id
        }
      },
      select: {
        id: true,
        name: true,
        email: true
      }
    });

    // Get all conversations for the current user
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: user.id },
          { recipientId: user.id }
        ]
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        recipient: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Group by conversation partner
    const conversationsMap = new Map<number, any>();

    // First, add all users as potential conversations
    allUsers.forEach(user => {
      conversationsMap.set(user.id, {
        partnerId: user.id,
        partnerName: user.name || user.email,
        partnerEmail: user.email,
        lastMessage: '',
        lastMessageTime: null,
        unreadCount: 0
      });
    });

    // Then update with actual message data
    messages.forEach((msg: any) => {
      const partnerId = msg.senderId === user.id ? msg.recipientId : msg.senderId;
      const partner = msg.senderId === user.id ? msg.recipient : msg.sender;

      const conv = conversationsMap.get(partnerId);
      if (conv) {
        conv.lastMessage = msg.content;
        conv.lastMessageTime = msg.createdAt;
        // Update unread count
        if (msg.recipientId === user.id && !msg.isRead) {
          conv.unreadCount += 1;
        }
      }
    });

    const conversations = Array.from(conversationsMap.values())
      .sort((a, b) => {
        if (a.lastMessageTime && b.lastMessageTime) {
          return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
        }
        if (a.lastMessageTime) return -1;
        if (b.lastMessageTime) return 1;
        return a.partnerName.localeCompare(b.partnerName);
      });

    return res.status(200).json({
      conversations
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(500).json({ error: 'Failed to fetch conversations' });
  }
}
