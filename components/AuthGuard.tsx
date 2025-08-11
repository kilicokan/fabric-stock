import { useEffect } from 'react';
import { useRouter } from 'next/router';
import jwt from 'jsonwebtoken';

export default function AuthGuard({ children, requiredRole = 'user' }: { 
  children: React.ReactNode,
  requiredRole?: string 
}) {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
      
      if (decoded.role !== requiredRole && decoded.role !== 'admin') {
        router.push('/unauthorized');
      }
    } catch (err) {
      localStorage.removeItem('token');
      router.push('/login');
    }
  }, []);

  return <>{children}</>;
}