// components/layout/Sidebar.tsx
import Link from 'next/link';
import { useRouter } from 'next/router';

const menuItems = [
  { name: 'Kumaş Girişi', path: '/fabric-entry', icon: '📥' },
  { name: 'Kumaş Çıkışı', path: '/fabric-exit', icon: '📤' },
  { name: 'Raporlar', path: '/reports', icon: '📊' },
  { name: 'Kullanıcılar', path: '/users', icon: '👥' },
  // Yeni eklenenler:
  { name: 'Müşteriler', path: '/customers', icon: '👔' },
  { name: 'Kumaşlar', path: '/fabrics', icon: '🧵' },
  { name: 'Ürünler', path: '/products', icon: '👕' }
];

export default function Sidebar() {
  const router = useRouter();

  const linkStyle = (active: boolean) => ({
    padding: '10px 15px',
    backgroundColor: active ? '#16213e' : 'transparent',
    borderRadius: '5px',
    color: 'white',
    textDecoration: 'none',
    fontWeight: active ? 'bold' : 'normal',
    display: 'flex',
    alignItems: 'center',
    marginBottom: '5px',
    transition: 'all 0.3s ease'
  });

  return (
    <aside style={{
      width: '250px',
      backgroundColor: '#0f3460',
      color: 'white',
      padding: '20px',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      position: 'sticky',
      top: 0
    }}>
      <h2 style={{ textAlign: 'center', marginBottom: '30px' }}>📦 MIRA STOK</h2>
      
      {menuItems.map((item) => (
        <Link 
          key={item.path}
          href={item.path} 
          style={linkStyle(router.pathname === item.path)}
          className="nav-link"
        >
          <span style={{ marginRight: '10px' }}>{item.icon}</span>
          {item.name}
        </Link>
      ))}
    </aside>
  );
}