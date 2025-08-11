import type { AppProps } from 'next/app';
import '../styles/globals.css';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  return (
    <div style={{ display: "flex" }}>
      <aside style={{
        width: '250px',
        backgroundColor: '#0f3460',
        color: 'white',
        padding: '20px',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <h2 style={{ textAlign: 'center', marginBottom: '30px' }}>📦 MIRA STOK</h2>
        
        <Link 
          href="/fabric-entry" 
          style={linkStyle(router.pathname === '/fabric-entry')}
          className="nav-link"
        >
          Kumaş Girişi
        </Link>
        <Link 
          href="/fabric-exit" 
          style={linkStyle(router.pathname === '/fabric-exit')}
          className="nav-link"
        >
          Kumaş Çıkışı
        </Link>
        <Link 
          href="/reports" 
          style={linkStyle(router.pathname === '/reports')}
          className="nav-link"
        >
          Raporlar
        </Link>
        <Link 
          href="/users" 
          style={linkStyle(router.pathname === '/users')}
          className="nav-link"
        >
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
    fontWeight: active ? 'bold' : 'normal',
    display: 'block',
    marginBottom: '5px'
  };
}