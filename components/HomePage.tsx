import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Card, CardContent } from '@mui/material';
import { Package, Truck, Users, ChevronDown, LogOut, User } from 'lucide-react';

interface User {
  id: number;
  email: string;
  name?: string;
  role: string;
  stockAccess: boolean;
  fasonAccess: boolean;
}

interface HomePageProps {
  user: User;
}

const HomePage: React.FC<HomePageProps> = ({ user }) => {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const navigateToStock = () => {
    router.push('/stock');
  };

  const navigateToFason = () => {
    router.push('/fason');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  // Dropdown dışında tıklandığında kapat
  useEffect(() => {
    const handleClickOutside = () => {
      setDropdownOpen(false);
    };

    if (dropdownOpen) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [dropdownOpen]);

  return (
    <div style={styles.container}>
      <div style={styles.wrapper}>
        {/* Header */}
        <div style={styles.header}>
          {/* Sol taraf - Logo ve başlık */}
          <div style={styles.logoSection}>
            <h1 style={styles.mainTitle}>
               MiraApp Entegre Sistem
            </h1>
            <div style={styles.roleBadge}>
              <Users className="w-4 h-4 mr-1" />
              {user.role}
            </div>
          </div>
          
          {/* Sağ taraf - Kullanıcı menüsü */}
          <div style={styles.userMenuContainer}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleDropdown();
              }}
              style={styles.userButton}
            >
              <div style={styles.userInfo}>
                <div style={styles.avatar}>
                  <User className="w-4 h-4 text-white" />
                </div>
                <span style={styles.userName}>
                  {user.name || user.email}
                </span>
              </div>
              <ChevronDown 
                style={{
                  ...styles.chevronIcon,
                  transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                }}
              />
            </button>

            {/* Dropdown Menü */}
            {dropdownOpen && (
              <div style={styles.dropdown}>
                <div style={styles.dropdownHeader}>
                  <p style={styles.dropdownName}>
                    {user.name || user.email}
                  </p>
                  <p style={styles.dropdownEmail}>{user.email}</p>
                  <span style={styles.dropdownRole}>
                    {user.role}
                  </span>
                </div>
                
                <button
                  onClick={handleLogout}
                  style={styles.logoutButton}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Çıkış Yap
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Ana Modül Seçim Kartları */}
        <div style={styles.cardGrid}>
          {/* Mira Stock Kartı */}
          {user.stockAccess && (
            <div 
              style={styles.moduleCard}
              onClick={navigateToStock}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
              }}
            >
              <div style={{...styles.iconContainer, ...styles.stockIcon}}>
                <Package style={styles.cardIcon} />
              </div>
              <h2 style={styles.cardTitle}>
                Mira Stock
              </h2>
              <p style={styles.cardDescription}>
                Kumaş stok yönetimi, giriş-çıkış takibi ve raporlama
              </p>
              <div style={{...styles.accessBadge, ...styles.stockBadge}}>
                Stok Modülüne Erişim
              </div>
            </div>
          )}

          {/* Mira Fason Takip Kartı */}
          {user.fasonAccess && (
            <div 
              style={styles.moduleCard}
              onClick={navigateToFason}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
              }}
            >
              <div style={{...styles.iconContainer, ...styles.fasonIcon}}>
                <Truck style={styles.cardIcon} />
              </div>
              <h2 style={styles.cardTitle}>
                Mira Fason Takip
              </h2>
              <p style={styles.cardDescription}>
                Fason atölye süreç takibi ve mobil uygulama desteği
              </p>
              <div style={{...styles.accessBadge, ...styles.fasonBadge}}>
                Fason Takip Modülüne Erişim
              </div>
            </div>
          )}
        </div>

        {/* Erişim Yoksa Uyarı */}
        {!user.stockAccess && !user.fasonAccess && (
          <div className="text-center mt-8">
            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-r-lg">
              <p className="font-medium">Erişim Yetkisi Bulunamadı</p>
              <p className="text-sm mt-1">
                Lütfen sistem yöneticiniz ile iletişime geçin.
              </p>
            </div>
          </div>
        )}

        {/* Alt Bilgi */}
        <div style={styles.footer}>
          <p>© 2025 MiraApp - Kumaş Stok & Fason Takip</p>
        </div>
      </div>
    </div>
  );
};

// Modern tasarım için stiller (fabric-entry tarzı)
const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8f9fa',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
  },
  wrapper: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '3rem',
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
  },
  logoSection: {
    textAlign: 'center',
    flex: 1
  },
  mainTitle: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: '1rem',
    textAlign: 'center'
  },
  roleBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    color: '#1976d2',
    padding: '0.5rem 1rem',
    borderRadius: '20px',
    fontSize: '0.9rem',
    fontWeight: '600'
  },
  userMenuContainer: {
    position: 'relative'
  },
  userButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '0.75rem 1rem',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    transition: 'all 0.3s ease'
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  avatar: {
    width: '32px',
    height: '32px',
    backgroundColor: '#007bff',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  userName: {
    color: '#2c3e50',
    fontWeight: '600'
  },
  chevronIcon: {
    width: '16px',
    height: '16px',
    color: '#6c757d',
    transition: 'transform 0.3s ease'
  },
  dropdown: {
    position: 'absolute',
    right: 0,
    top: '100%',
    marginTop: '0.5rem',
    width: '220px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    border: '1px solid #e9ecef',
    padding: '0.5rem 0',
    zIndex: 50
  },
  dropdownHeader: {
    padding: '1rem',
    borderBottom: '1px solid #e9ecef'
  },
  dropdownName: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#2c3e50',
    margin: 0,
    marginBottom: '0.25rem'
  },
  dropdownEmail: {
    fontSize: '0.8rem',
    color: '#6c757d',
    margin: 0,
    marginBottom: '0.5rem'
  },
  dropdownRole: {
    display: 'inline-block',
    backgroundColor: '#e3f2fd',
    color: '#1976d2',
    fontSize: '0.75rem',
    padding: '0.25rem 0.5rem',
    borderRadius: '12px',
    fontWeight: '600'
  },
  logoutButton: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '0.75rem 1rem',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#dc3545',
    cursor: 'pointer',
    fontSize: '0.9rem',
    transition: 'background-color 0.3s ease'
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '2rem',
    maxWidth: '800px',
    margin: '0 auto'
  },
  moduleCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    padding: '2rem',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    border: '1px solid #e9ecef'
  },
  iconContainer: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1.5rem',
  },
  stockIcon: {
    backgroundColor: '#e8f5e9'
  },
  fasonIcon: {
    backgroundColor: '#e3f2fd'
  },
  cardIcon: {
    width: '40px',
    height: '40px',
    color: '#2c3e50'
  },
  cardTitle: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: '1rem'
  },
  cardDescription: {
    color: '#6c757d',
    marginBottom: '1.5rem',
    lineHeight: '1.5'
  },
  accessBadge: {
    display: 'inline-block',
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    fontSize: '0.9rem',
    fontWeight: '600'
  },
  stockBadge: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32'
  },
  fasonBadge: {
    backgroundColor: '#e3f2fd',
    color: '#1976d2'
  },
  footer: {
    textAlign: 'center',
    marginTop: '3rem',
    color: '#6c757d',
    fontSize: '0.9rem'
  }
};

export default HomePage;
