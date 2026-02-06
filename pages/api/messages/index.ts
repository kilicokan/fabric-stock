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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const user = verifyToken(req) as any;

    switch (req.method) {
      case 'GET':
        return handleGet(req, res, user);
      case 'POST':
        return handlePost(req, res, user);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API Error:', error);
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// Get messages for current user
async function handleGet(req: NextApiRequest, res: NextApiResponse, user: any) {
  const { conversationWith, unreadOnly } = req.query;

  try {
    const where: any = {
      OR: [
        { senderId: user.id, recipientId: parseInt(conversationWith as string) },
        { senderId: parseInt(conversationWith as string), recipientId: user.id }
      ]
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
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return res.status(200).json({
      messages: messages.reverse()
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
}

// Send a message
async function handlePost(req: NextApiRequest, res: NextApiResponse, user: any) {
  const { recipientId, content } = req.body;

  if (!recipientId || !content) {
    return res.status(400).json({ error: 'recipientId and content are required' });
  }

  try {
    // Verify recipient exists
    const recipient = await prisma.user.findUnique({
      where: { id: parseInt(recipientId) }
    });

    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    const message = await prisma.message.create({
      data: {
        senderId: user.id,
        recipientId: parseInt(recipientId),
        content
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
      }
    });

    return res.status(201).json(message);
  } catch (error) {
    console.error('Error creating message:', error);
    return res.status(500).json({ error: 'Failed to create message' });
  }
}
