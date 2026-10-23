import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';

export function useNotifications(userId: number | null) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!userId) return;

    // Initialize Socket.IO connection
    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000', {
      path: '/api/socket.io/',
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Notifications] Socket connected:', socket.id);
      // Register user with their ID
      socket.emit('register', userId);
    });

    socket.on('notification', (notification: any) => {
      console.log('[Notifications] Received:', notification);
      
      // Show toast notification
      toast.success(`${notification.title}: ${notification.body}`, {
        duration: 5000,
        position: 'top-right'
      });
    });

    socket.on('disconnect', () => {
      console.log('[Notifications] Socket disconnected');
    });

    socket.on('error', (error: any) => {
      console.error('[Notifications] Socket error:', error);
    });

    return () => {
      socket.disconnect();
    };
  }, [userId]);

  return socketRef.current;
}
