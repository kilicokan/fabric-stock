import type { AppProps } from 'next/app';
import '../styles/globals.css';
import { AuthProvider, useAuth } from '../components/AuthContext';
import Sidebar from '../components/Layout/Sidebar';

function AppLayout({ Component, pageProps }: AppProps) {
  const { authenticated } = useAuth();

  // For login pages, don't show the layout with sidebar
  if (Component.name === 'AdminLogin' || Component.name === 'Login') {
    return <Component {...pageProps} />;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {authenticated && <Sidebar />}
      <main
        style={{
          flex: 1,
          padding: '20px',
          backgroundColor: 'var(--color-secondary)',
          overflow: 'auto',
        }}
      >
        <Component {...pageProps} />
      </main>
    </div>
  );
}

export default function MyApp(props: AppProps) {
  const { Component, pageProps, router } = props;
  const publicPaths = ['/login', '/admin/login'];

  const requireAuth = !publicPaths.includes(router.pathname);

  return (
    <AuthProvider requireAuth={requireAuth}>
      <AppLayout {...props} />
    </AuthProvider>
  );
}
