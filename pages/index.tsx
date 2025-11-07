import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import HomePage from "../components/HomePage";

type User = {
  id: number;
  email: string;
  name?: string;
  role: string;
  stockAccess: boolean;
  fasonAccess: boolean;
};

const Home = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check for token and get user info
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (!token) {
        router.replace('/login');
        return;
      }
      
      // Get current user info from API or decode JWT
      fetchUserInfo(token);
    }
  }, [router]);

  const fetchUserInfo = async (token: string) => {
    try {
      // Try to get user info from API
      const response = await axios.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setUser(response.data.user);
    } catch (error) {
      console.error('User info alınamadı:', error);
      // Fallback: decode JWT manually or redirect to login
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
};

export default Home;
// ...existing code...
