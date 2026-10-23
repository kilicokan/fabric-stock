import type { NextApiRequest, NextApiResponse } from 'next';
import type { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { initializeSocket } from '@/lib/notification-service';

type NextApiResponseWithSocket = NextApiResponse & {
  socket: NextApiResponse['socket'] & {
    server: HTTPServer & {
      io?: SocketIOServer;
    };
  };
};

const defaultOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
];

const getAllowedOrigins = (): string[] => {
  const extra = (process.env.CORS_ALLOWED_ORIGIN || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set([...defaultOrigins, ...extra]));
};

const ioHandler = (req: NextApiRequest, res: NextApiResponseWithSocket) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (res.socket.server.io) {
    return res.status(200).json({ ok: true, initialized: true });
  }

  const io = new SocketIOServer(res.socket.server, {
    cors: {
      origin: getAllowedOrigins(),
      methods: ['GET', 'POST'],
    },
    path: '/api/socket.io',
  });

  res.socket.server.io = io;
  initializeSocket(io);

  return res.status(200).json({ ok: true, initialized: false });
};

export default ioHandler;
