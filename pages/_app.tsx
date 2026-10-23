import type { AppProps } from 'next/app';
import type { ComponentType, ReactElement } from 'react';
// @ts-ignore: CSS imports are handled by Next.js
import '../styles/globals.css';
import { AuthProvider, useAuth } from '../components/AuthContext';
import TabbedLayout from '../components/TabbedLayout';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Toaster } from 'react-hot-toast';
import { useNotifications } from '../hooks/useNotifications';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

const theme = createTheme();

function NotificationListener(): null {
  const { user } = useAuth();
  useNotifications(user?.id || null);
  return null;
}

const tabTitleMap: Record<string, string> = {
  '/customer-orders/add': 'Siparis Ekle',
  '/customer-orders/list': 'Siparis Listesi',
};

const resolveTabTitle = (pathname: string): string => {
  if (tabTitleMap[pathname]) {
    return tabTitleMap[pathname];
  }

  return pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' / ') || 'Sayfa';
};

function AppLayout({ Component, pageProps, router }: AppProps): ReactElement {
  const { authenticated } = useAuth();

  if (router.pathname === '/login' || router.pathname === '/admin/login') {
    return <Component {...pageProps} />;
  }

  if (!authenticated) {
    return <></>;
  }

  const isHomeRoute = router.pathname === '/' || router.pathname === '/home';
  const initialTab = isHomeRoute
    ? undefined
    : {
        title: resolveTabTitle(router.pathname),
        path: router.asPath || router.pathname,
        component: Component as ComponentType,
        closable: true,
      };

  return (
    <>
      <NotificationListener />
      <TabbedLayout initialTab={initialTab} />
    </>
  );
}

export default function MyApp(props: AppProps): ReactElement {
  const { router } = props;
  const publicPaths = ['/login', '/admin/login'];

  const requireAuth = !publicPaths.includes(router.pathname);

  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Toaster position="top-right" />
        <AuthProvider requireAuth={requireAuth}>
          <AppLayout {...props} />
        </AuthProvider>
      </ThemeProvider>
    </NextThemesProvider>
  );
}
