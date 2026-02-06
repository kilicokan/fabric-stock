import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import SplashScreen from './splash-screen';

interface User {
  id: number;
  email: string;
  name?: string;
  role: string;
  stockAccess: boolean;
  fasonAccess: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authenticated: boolean;
  error: string | null;
  checkAuth: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
  requireAuth?: boolean;
  requiredAccess?: 'stock' | 'fason' | 'both';
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  requireAuth = true,
  requiredAccess,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authState, setAuthState] = useState<'checking' | 'logging-in' | 'logging-out' | 'idle'>('checking');
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const isTokenExpired = (token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp < Date.now() / 1000;
    } catch (e) {
      return true; // invalid token
    }
  };

  const checkAuth = async () => {
    if (!requireAuth) {
      setLoading(false);
      setAuthenticated(true);
      setAuthState('idle');
      return;
    }

    try {
      const token = localStorage.getItem('token');

      if (!token) {
        redirectToLogin();
        return;
      }

      // Check if token is expired
      if (isTokenExpired(token)) {
        localStorage.removeItem('token');
        redirectToLogin();
        return;
      }

      const response = await axios.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const userData = response.data.user;
      setUser(userData);

      if (requiredAccess) {
        const hasAccess = checkUserAccess(userData, requiredAccess);
        if (!hasAccess) {
          router.push('/');
          return;
        }
      }

      setAuthenticated(true);
      setAuthState('logging-in');
      
      // Giriş splash'ını 3.5 saniye göster
      setTimeout(() => {
        setAuthState('idle');
      }, 3500);
      
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
      redirectToLogin();
    } finally {
      setLoading(false);
    }
  };

  const checkUserAccess = (userData: User, access: string): boolean => {
    switch (access) {
      case 'stock':
        return userData.stockAccess;
      case 'fason':
        return userData.fasonAccess;
      case 'both':
        return userData.stockAccess && userData.fasonAccess;
      default:
        return true;
    }
  };

  const redirectToLogin = () => {
    setAuthState('idle');
    router.push('/login');
  };

  const logout = () => {
    setAuthState('logging-out');
    localStorage.removeItem('token');
    setUser(null);
    setAuthenticated(false);
    
    // Çıkış splash'ını 3.5 saniye göster, sonra login sayfasına yönlendir
    setTimeout(() => {
      router.push('/login');
      // Login sayfasına yönlendikten sonra state'i sıfırla
      setTimeout(() => setAuthState('idle'), 100);
    }, 3500);
  };

  // Splash screen gösterimi
  if (authState === 'logging-in' || authState === 'logging-out') {
    return (
      <SplashScreen 
        autoHide={false} 
        isLogout={authState === 'logging-out'}
        onHide={() => setAuthState('idle')}
      />
    );
  }

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner}></div>
        <p style={styles.loadingText}>Kimlik doğrulama kontrol ediliyor...</p>
      </div>
    );
  }

  if (!authenticated && requireAuth) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ user, loading, authenticated, error, checkAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

const styles = {
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e3f2fd',
    borderTop: '4px solid #1976d2',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: '1rem',
    color: '#6c757d',
    fontSize: '1rem',
  },
};

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}