import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Sidebar() {
  const router = useRouter();

  return (
    <div className="sidebar" style={{
      width: 250,
      backgroundColor: '#0f3460',
      padding: 20,
      color: 'white'
    }}>
      {/* Logo için Link kullanımı */}
      <Link href="/" passHref>
        <div style={{
          textAlign: 'center',
          marginBottom: 30,
          cursor: 'pointer',
          fontSize: '1.5rem',
          fontWeight: 'bold'
        }}>
          📦 MIRA STOK
        </div>
      </Link>

      {/* Menü Öğeleri */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Link href="/fabric-entry" passHref>
          <a style={{
            padding: '10px 15px',
            backgroundColor: router.pathname === '/fabric-entry' ? '#16213e' : 'transparent',
            borderRadius: 5,
            textDecoration: 'none',
            color: 'white'
          }}>
            Kumaş Girişi
          </a>
        </Link>

        <Link href="/fabric-exit" passHref>
          <a style={{
            padding: '10px 15px',
            backgroundColor: router.pathname === '/fabric-exit' ? '#16213e' : 'transparent',
            borderRadius: 5,
            textDecoration: 'none',
            color: 'white'
          }}>
            Kumaş Çıkışı
          </a>
        </Link>
      </nav>
    </div>
  );
}