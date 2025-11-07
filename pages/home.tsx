"use client";

import HomePage from '../components/HomePage';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

type User = {
  id: number;
  email: string;
  name?: string;
  role: string;
  stockAccess: boolean;
  fasonAccess: boolean;
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (!token) {
        router.replace('/login');
        return;
      }
      fetchUserInfo(token);
    }
  }, [router]);

  const fetchUserInfo = async (token: string) => {
    try {
      const response = await axios.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data.user);
    } catch (error) {
      console.error('User info alınamadı:', error);
      localStorage.removeItem('token');
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Kullanıcı bilgileri yüklenemedi</p>
          <button 
            onClick={() => router.replace('/login')}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Tekrar Giriş Yap
          </button>
        </div>
      </div>
    );
  }

  return <HomePage user={user} />;
}
