import type { AppProps } from 'next/app';
import '../styles/globals.css';
import { AuthProvider, useAuth } from '../components/AuthContext';
import TabbedLayout from '../components/TabbedLayout';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const theme = createTheme();

function AppLayout({ Component, pageProps }: AppProps) {
  const { authenticated } = useAuth();

  // For login pages, don't show the layout with sidebar
  if (Component.name === 'AdminLogin' || Component.name === 'Login') {
    return <Component {...pageProps} />;
  }

  if (!authenticated) {
    return <Component {...pageProps} />;
  }

  return (
    <TabbedLayout>
      <Component {...pageProps} />
    </TabbedLayout>
  );
}

export default function MyApp(props: AppProps) {
  const { Component, pageProps, router } = props;
  const publicPaths = ['/login', '/admin/login'];

  const requireAuth = !publicPaths.includes(router.pathname);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider requireAuth={requireAuth}>
        <AppLayout {...props} />
      </AuthProvider>
    </ThemeProvider>
  );
}
