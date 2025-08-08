import type { AppProps } from 'next/app';
import '../styles/globals.css';
import Sidebar from "../components/Sidebar";
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: '250px',
        backgroundColor: '#1a1a2e',
        color: 'white',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '15px'
      }}>
        <h2 style={{ textAlign: 'center', marginBottom: '30px' }}>📦 MIRA STOK</h2>
        
        <Link href="/fabric-entry" style={linkStyle(router.pathname === '/fabric-entry')}>
          Kumaş Girişi
        </Link>
        <Link href="/fabric-exit" style={linkStyle(router.pathname === '/fabric-exit')}>
          Kumaş Çıkışı
        </Link>
        <Link href="/reports" style={linkStyle(router.pathname === '/reports')}>
          Raporlar
        </Link>
        <Link href="/users" style={linkStyle(router.pathname === '/users')}>
          Kullanıcı Yönetimi
        </Link>
      </aside>

      {/* İçerik */}
      <main style={{ flex: 1, padding: '20px', backgroundColor: '#f4f4f4' }}>
        <Component {...pageProps} />
      </main>
    </div>
  );
}

function linkStyle(active: boolean) {
  return {
    padding: '10px 15px',
    backgroundColor: active ? '#16213e' : 'transparent',
    borderRadius: '5px',
    color: 'white',
    textDecoration: 'none',
    fontWeight: active ? 'bold' : 'normal'
  };
}
