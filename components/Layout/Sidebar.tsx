import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Sidebar() {
  const router = useRouter();

  return (
    <aside style={{
      width: '220px',
      backgroundColor: '#1a1a2e',
      color: 'white',
      padding: '20px',
      height: '100vh'
    }}>
      <h2 style={{ textAlign: 'center', marginBottom: '30px' }}>📦 MIRA STOK</h2>

      <Link href="/fabric-entry" style={linkStyle(router.pathname === '/fabric-entry')}>
        Kumaş Girişi
      </Link>
      <br />
      <Link href="/fabric-exit" style={linkStyle(router.pathname === '/fabric-exit')}>
        Kumaş Çıkışı
      </Link>
      <br />
      <Link href="/reports" style={linkStyle(router.pathname === '/reports')}>
        Raporlar
      </Link>
      <br />
      <Link href="/users" style={linkStyle(router.pathname === '/users')}>
        Kullanıcı Yönetimi
      </Link>
    </aside>
  );
}

function linkStyle(active: boolean) {
  return {
    display: 'block',
    padding: '10px 15px',
    backgroundColor: active ? '#16213e' : 'transparent',
    borderRadius: '5px',
    color: 'white',
    textDecoration: 'none',
    fontWeight: active ? 'bold' : 'normal',
    marginBottom: '10px'
  };
}
