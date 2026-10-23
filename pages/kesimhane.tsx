"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "../components/AuthGuard";
import { useTabs } from "../components/TabContext";
import {
  Scissors,
  Package,
  BarChart3,
  ArrowLeft,
} from "lucide-react";

export default function KesimhanePage() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { addTab } = useTabs();

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const getComponentForPath = async (path: string): Promise<React.ComponentType | null> => {
    const basePath = path.split("?")[0];
    const pathMap: Record<string, () => Promise<{ default: React.ComponentType }>> = {
      "/fason/cutting-suggestions": () => import("./fason/cutting-suggestions"),
      "/fason/cutting-workshop": () => import("./fason/cutting-workshop"),
      "/fason/cutting-operator": () => import("./fason/cutting-operator"),
      "/reports/cutting-fabric-conversion": () => import("./reports/cutting-fabric-conversion"),
      "/reports/stock": () => import("./reports/stock"),
    };

    const importFn = pathMap[basePath];
    if (!importFn) return null;

    try {
      const loaded = await importFn();
      return loaded.default;
    } catch (error) {
      console.error("Sayfa yuklenemedi:", path, error);
      return null;
    }
  };

  const handleModuleClick = async (route: string, title: string) => {
    const component = await getComponentForPath(route);
    if (component) {
      addTab({
        title,
        path: route,
        component,
        closable: true,
      });
    }
  };

  if (loading) {
    return (
      <AuthGuard requireAuth={true} requiredAccess="fason">
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner}></div>
          <p style={styles.loadingText}>Kesimhane modülü yükleniyor...</p>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard requireAuth={true} requiredAccess="fason">
      <div style={styles.container}>
        <div style={styles.wrapper}>
          <div style={styles.header}>
            <div style={styles.headerContent}>
              <button
                onClick={() => router.push('/')}
                style={styles.backButton}
              >
                <ArrowLeft style={styles.backIcon} />
                Ana Sayfaya Dön
              </button>

              <div style={styles.headerInfo}>
                <h1 style={styles.pageTitle}>
                  Kesimhane
                </h1>
                <p style={styles.pageSubtitle}>
                  Kesim önerileri, kesimhane ekranı ve kumaş dönüşüm raporları
                </p>
              </div>
            </div>
          </div>

          <div style={styles.menuGrid}>
            <button
              type="button"
              onClick={() => void handleModuleClick("/fason/cutting-suggestions", "Kesim Önerileri")}
              style={{...styles.menuCard, ...styles.cuttingCard}}
            >
              <div style={styles.menuIcon}>
                <Scissors style={styles.menuIconSvg} />
              </div>
              <h3 style={styles.menuTitle}>Kesim Önerileri</h3>
              <p style={styles.menuDescription}>
                Sipariş reçeteleri, stok ve teslim tarihine göre kesime verilecek iş emirleri
              </p>
            </button>

            <button
              type="button"
              onClick={() => void handleModuleClick("/fason/cutting-operator", "Kesimhane Operatör Ekranı")}
              style={{...styles.menuCard, ...styles.workshopCard}}
            >
              <div style={styles.menuIcon}>
                <Package style={styles.menuIconSvg} />
              </div>
              <h3 style={styles.menuTitle}>Kesimhane Ekranı</h3>
              <p style={styles.menuDescription}>
                Serim makinesi takibi, rol girişi ve kesim raporu girişi
              </p>
            </button>

            <button
              type="button"
              onClick={() => void handleModuleClick("/reports/cutting-fabric-conversion", "Kumaş Dönüşüm Raporu")}
              style={{...styles.menuCard, ...styles.reportsCard}}
            >
              <div style={styles.menuIcon}>
                <BarChart3 style={styles.menuIconSvg} />
              </div>
              <h3 style={styles.menuTitle}>Kumaş Dönüşüm Raporu</h3>
              <p style={styles.menuDescription}>
                Metre veya kilo bazlı kumaş çıkışlarını karşılaştırın ve karşılıklı dönüştürün
              </p>
            </button>

            <button
              type="button"
              onClick={() => void handleModuleClick("/reports/stock", "Mevcut Stok Raporu")}
              style={{...styles.menuCard, ...styles.stockCard}}
            >
              <div style={styles.menuIcon}>
                <BarChart3 style={styles.menuIconSvg} />
              </div>
              <h3 style={styles.menuTitle}>Mevcut Stok Raporu</h3>
              <p style={styles.menuDescription}>
                Anlık stok durumunu detaylı raporlayın
              </p>
            </button>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    padding: '20px',
  },
  wrapper: {
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    marginBottom: '30px',
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
  },
  backIcon: {
    width: '18px',
    height: '18px',
  },
  headerInfo: {
    flex: 1,
  },
  pageTitle: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#1e293b',
    margin: '0 0 8px 0',
  },
  pageSubtitle: {
    fontSize: '16px',
    color: '#64748b',
    margin: 0,
  },
  menuGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
    marginBottom: '40px',
  },
  menuCard: {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    border: '1px solid #e2e8f0',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textDecoration: 'none',
    display: 'block',
    borderLeft: '4px solid #3b82f6',
  },
  cuttingCard: {
    borderLeftColor: '#06b6d4',
  },
  workshopCard: {
    borderLeftColor: '#8b5cf6',
  },
  reportsCard: {
    borderLeftColor: '#ef4444',
  },
  stockCard: {
    borderLeftColor: '#10b981',
  },
  menuIcon: {
    backgroundColor: '#eff6ff',
    padding: '12px',
    borderRadius: '8px',
    display: 'inline-block',
    marginBottom: '16px',
  },
  menuIconSvg: {
    width: '24px',
    height: '24px',
    color: '#3b82f6',
  },
  menuTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1e293b',
    margin: '0 0 8px 0',
  },
  menuDescription: {
    fontSize: '14px',
    color: '#64748b',
    margin: 0,
    lineHeight: '1.5',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    gap: '16px',
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e2e8f0',
    borderLeft: '4px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    fontSize: '16px',
    color: '#64748b',
  },
} as const;
