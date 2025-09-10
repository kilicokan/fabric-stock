// pages/_app.tsx
import type { AppProps } from 'next/app';
import '../styles/globals.css';
import Sidebar from '../components/layout/Sidebar';

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <div style={{ 
      display: "flex",
      minHeight: '100vh'
    }}>
      <Sidebar />
      <main style={{ 
        flex: 1, 
        padding: '20px', 
        backgroundColor: '#f4f4f4',
        overflow: 'auto'
      }}>
        <Component {...pageProps} />
      </main>
    </div>
  );
}