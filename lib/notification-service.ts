import { Server as SocketIOServer, Socket } from 'socket.io';
import prisma from './prisma';
import type { NextApiRequest, NextApiResponse } from 'next';

export interface NotificationPayload {
  type: 'message' | 'order' | 'alert';
  title: string;
  body: string;
  recipientId: number;
  senderId?: number;
  data?: Record<string, any>;
}

// Global map to track connected users and their socket IDs
const userSockets = new Map<number, Set<string>>();
const mobileTrackerSockets = new Set<string>();

// Global Socket.IO server instance
let ioInstance: SocketIOServer | null = null;

export function initializeSocket(io: SocketIOServer) {
  ioInstance = io;

  io.on('connection', (socket: Socket) => {
    console.log('[Socket] User connected:', socket.id);

    socket.on('register', (userId: number) => {
      if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
      }
      userSockets.get(userId)!.add(socket.id);
      console.log(`[Socket] User ${userId} registered with socket ${socket.id}`);
    });

    socket.on('register-mobile-tracker', () => {
      mobileTrackerSockets.add(socket.id);
      console.log(
        `[Socket] Mobile tracker registered with socket ${socket.id} (total: ${mobileTrackerSockets.size})`
      );
      socket.emit('mobile-tracker-registered', { ok: true });
    });

    socket.on('disconnect', () => {
      console.log('[Socket] User disconnected:', socket.id);
      mobileTrackerSockets.delete(socket.id);

      // Remove socket from all users
      userSockets.forEach((sockets, userId) => {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
        }
      });
    });
  });
}

export async function sendNotification(payload: NotificationPayload) {
  try {
    const socketIds = userSockets.get(payload.recipientId);
    
    if (socketIds && socketIds.size > 0 && ioInstance) {
      // User is online - send real-time notification
      socketIds.forEach((socketId) => {
        ioInstance!.to(socketId).emit('notification', {
          id: Math.random().toString(36),
          type: payload.type,
          title: payload.title,
          body: payload.body,
          timestamp: new Date(),
          data: payload.data
        });
      });
      console.log(`[Notification] Real-time sent to user ${payload.recipientId}`);
    }

    // Store notification in database for offline users
    // Uncomment if you add a Notification model to Prisma
    // await prisma.notification.create({
    //   data: {
    //     type: payload.type,
    //     title: payload.title,
    //     body: payload.body,
    //     recipientId: payload.recipientId,
    //     senderId: payload.senderId,
    //     data: payload.data ? JSON.stringify(payload.data) : null,
    //     isRead: false
    //   }
    // });

    console.log(`[Notification] Stored for user ${payload.recipientId}`);
  } catch (error) {
    console.error('[Notification] Error:', error);
  }
}

interface MobileTrackerWorkOrderPayload {
  id: number;
  orderNo: string;
  productCode?: string | null;
  productName?: string | null;
  customerName?: string | null;
  quantity?: number;
  status?: string;
  assignedUserId?: number | null;
}

export function sendMobileTrackerNotification(order: MobileTrackerWorkOrderPayload) {
  try {
    if (!ioInstance || mobileTrackerSockets.size === 0) {
      console.log(
        `[Notification] Mobile tracker sockets unavailable for order ${order.orderNo || order.id}`
      );
      return;
    }

    const payload = {
      type: 'mobile-work-order-assigned',
      title: 'Yeni İş Emri',
      body: `${order.orderNo} mobil uygulamaya atandı.`,
      order: {
        ...order,
        assignedAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    mobileTrackerSockets.forEach((socketId) => {
      ioInstance!.to(socketId).emit('mobile-work-order-assigned', payload);
    });

    console.log(
      `[Notification] mobile-work-order-assigned sent to ${mobileTrackerSockets.size} socket(s) for order ${order.orderNo}`
    );
  } catch (error) {
    console.error('[Notification] Error while sending mobile tracker notification:', error);
  }
}

// For mobile push notifications
export async function sendPushNotification(
  userId: number,
  title: string,
  body: string,
  data?: Record<string, any>
) {
  try {
    // Get user push token from database
    // This assumes you've added an expoPushToken field to the User model
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { expoPushToken: true }
    });

    if (!user?.expoPushToken) {
      console.log(`[PushNotification] No push token for user ${userId}`);
      return;
    }

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: user.expoPushToken,
        title,
        body,
        data,
        badge: 1,
        sound: 'default'
      })
    });

    const result = await response.json();
    console.log('[PushNotification] Sent:', result);
  } catch (error) {
    console.error('[PushNotification] Error:', error);
  }
}

// SSE endpoint support (alternative to Socket.IO)
export function setupSSE(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: number
) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const sendHeartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(sendHeartbeat);
    res.end();
  });

  return sendEvent;
}
