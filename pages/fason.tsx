"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "../components/AuthGuard";
import { useTabs } from "../components/TabContext";
import { Truck, Smartphone, Settings, BarChart3, Users, MapPin, ArrowLeft, Package, Scissors, Flame, Zap } from "lucide-react";

export default function FasonPage() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { addTab } = useTabs();

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const getComponentForPath = async (path: string): Promise<React.ComponentType | null> => {
    const basePath = path.split("?")[0];
    const pathMap: Record<string, () => Promise<{ default: React.ComponentType }>> = {
      "/fason/dashboard": () => import("./fason/dashboard"),
      "/fason/mobile-tracker": () => import("./fason/mobile-tracker"),
      "/fason/workshops": () => import("./fason/workshops"),
      "/fason/create-work-order": () => import("./fason/create-work-order"),
      "/fason/cutting-suggestions": () => import("./fason/cutting-suggestions"),
      "/fason/cutting-workshop": () => import("./fason/cutting-workshop"),
      "/reports/cutting-fabric-conversion": () => import("./reports/cutting-fabric-conversion"),
      "/fason/trackers": () => import("./fason/trackers"),
      "/fason/reports": () => import("./fason/reports"),
      "/reports/order-cutting": () => import("./reports/order-cutting"),
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
          <p style={styles.loadingText}>Dış Kaynak Üretim modülü yükleniyor...</p>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard requireAuth={true} requiredAccess="fason">
      <div style={styles.container}>
        <div style={styles.wrapper}>
          {/* Header */}
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
                  Mira Dış Kaynak Üretim Takip
                </h1>
                <p style={styles.pageSubtitle}>
                  Dış Kaynak Üretim atölye süreçlerini takip edin ve yönetin
                </p>
              </div>
            </div>
          </div>

          {/* Ana Modüller Grid */}
          <div style={styles.menuGrid}>
            {/* Dashboard */}
            <button
              type="button"
              onClick={() => void handleModuleClick("/fason/dashboard", "Dış Kaynak Üretim Dashboard")}
              style={{...styles.menuCard, ...styles.dashboardCard}}
            >
              <div style={styles.menuIcon}>
                <BarChart3 style={styles.menuIconSvg} />
              </div>
              <h3 style={styles.menuTitle}>Dış Kaynak Üretim Dashboard</h3>
              <p style={styles.menuDescription}>
                İş emirlerini görüntüleyin, süreçleri takip edin ve raporlar oluşturun
              </p>
            </button>

            {/* Mobil Takipçi */}
            <button
              type="button"
              onClick={() => void handleModuleClick("/fason/mobile-tracker", "Mobil Takipçi")}
              style={{...styles.menuCard, ...styles.mobileCard}}
            >
              <div style={styles.menuIcon}>
                <Smartphone style={styles.menuIconSvg} />
              </div>
              <h3 style={styles.menuTitle}>Mobil Takipçi</h3>
              <p style={styles.menuDescription}>
                Telefon uygulaması için optimize edilmiş takip formu
              </p>
            </button>

            {/* Atölye Yönetimi */}
            <button
              type="button"
              onClick={() => void handleModuleClick("/fason/workshops", "Atölye Yönetimi")}
              style={{...styles.menuCard, ...styles.workshopCard}}
            >
              <div style={styles.menuIcon}>
                <MapPin style={styles.menuIconSvg} />
              </div>
              <h3 style={styles.menuTitle}>Atölye Yönetimi</h3>
              <p style={styles.menuDescription}>
                Dış Kaynak Üretim atölyelerini kaydedin ve yönetin
              </p>
            </button>

            {/* İş Emri Oluştur */}
            <button
              type="button"
              onClick={() => void handleModuleClick("/fason/create-work-order", "İş Emri Oluştur")}
              style={{...styles.menuCard, ...styles.orderCard}}
            >
              <div style={styles.menuIcon}>
                <Settings style={styles.menuIconSvg} />
              </div>
              <h3 style={styles.menuTitle}>İş Emri Oluştur</h3>
              <p style={styles.menuDescription}>
                Manuel iş emri oluşturun veya ERP&apos;den emirleri görüntüleyin
              </p>
            </button>

            {/* Takipçi Yönetimi */}
            <button
              type="button"
              onClick={() => void handleModuleClick("/fason/cutting-suggestions", "Kesim Onerileri")}
              style={{...styles.menuCard, ...styles.cuttingCard}}
            >
              <div style={styles.menuIcon}>
                <Scissors style={styles.menuIconSvg} />
              </div>
              <h3 style={styles.menuTitle}>Kesim Onerileri</h3>
              <p style={styles.menuDescription}>
                Recete, stok ve termin uygunluguna gore kesime verilecek isleri secin
              </p>
            </button>

            <button
              type="button"
              onClick={() => void handleModuleClick("/fason/cutting-workshop", "Kesimhane Ekranı")}
              style={{...styles.menuCard, ...styles.cuttingCard}}
            >
              <div style={styles.menuIcon}>
                <Package style={styles.menuIconSvg} />
              </div>
              <h3 style={styles.menuTitle}>Kesimhane Ekranı</h3>
              <p style={styles.menuDescription}>
                Kesime atanmış iş emirlerini bildirim şeklinde takip edin ve sahadan veri girin
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
              onClick={() => void handleModuleClick("/fason/trackers", "Takipçi Yönetimi")}
              style={{...styles.menuCard, ...styles.trackerCard}}
            >
              <div style={styles.menuIcon}>
                <Users style={styles.menuIconSvg} />
              </div>
              <h3 style={styles.menuTitle}>Takipçi Yönetimi</h3>
              <p style={styles.menuDescription}>
                Dış Kaynak Üretim takipçilerini yönetin ve görevler atayın
              </p>
            </button>

            {/* Raporlar */}
            <button
              type="button"
              onClick={() => void handleModuleClick("/fason/reports", "Dış Kaynak Üretim Raporları")}
              style={{...styles.menuCard, ...styles.reportsCard}}
            >
              <div style={styles.menuIcon}>
                <Truck style={styles.menuIconSvg} />
              </div>
              <h3 style={styles.menuTitle}>Dış Kaynak Üretim Raporları</h3>
              <p style={styles.menuDescription}>
                Detaylı dış kaynak üretim takip raporları ve analizler
              </p>
            </button>

            <button
              type="button"
              onClick={() => void handleModuleClick("/reports/order-cutting", "Siparis Kesim Raporu")}
              style={{...styles.menuCard, ...styles.orderCuttingReportCard}}
            >
              <div style={styles.menuIcon}>
                <BarChart3 style={styles.menuIconSvg} />
              </div>
              <h3 style={styles.menuTitle}>Siparis Kesim Raporu</h3>
              <p style={styles.menuDescription}>
                Musteri siparis adedi, kesime atanan ve kesilen adetlerin karsilastirmali raporu
              </p>
            </button>
          </div>

          {/* Süreç Bilgileri */}
          <div style={styles.processSection}>
            <h3 style={styles.processTitle}>Dış Kaynak Üretim Takip Süreci</h3>
            <div style={styles.processGrid}>
              <div style={styles.processStep}>
                <div style={styles.processIcon}>
                  <Scissors style={styles.processIconSvg} />
                </div>
                <h4 style={styles.processStepTitle}>Kesim</h4>
                <p style={styles.processStepDesc}>İlk aşama</p>
              </div>
              
              <div style={styles.processStep}>
                <div style={styles.processIcon}>
                  <Package style={styles.processIconSvg} />
                </div>
                <h4 style={styles.processStepTitle}>Dikim</h4>
                <p style={styles.processStepDesc}>Ana üretim</p>
              </div>
              
              <div style={styles.processStep}>
                <div style={styles.processIcon}>
                  <Zap style={styles.processIconSvg} />
                </div>
                <h4 style={styles.processStepTitle}>Baskı/Nakış</h4>
                <p style={styles.processStepDesc}>Opsiyonel</p>
              </div>
              
              <div style={styles.processStep}>
                <div style={styles.processIcon}>
                  <Flame style={styles.processIconSvg} />
                </div>
                <h4 style={styles.processStepTitle}>Ütü</h4>
                <p style={styles.processStepDesc}>Son aşama</p>
              </div>
            </div>
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
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
  dashboardCard: {
    borderLeftColor: '#3b82f6',
  },
  mobileCard: {
    borderLeftColor: '#10b981',
  },
  workshopCard: {
    borderLeftColor: '#8b5cf6',
  },
  orderCard: {
    borderLeftColor: '#f59e0b',
  },
  cuttingCard: {
    borderLeftColor: '#06b6d4',
  },
  trackerCard: {
    borderLeftColor: '#ec4899',
  },
  reportsCard: {
    borderLeftColor: '#ef4444',
  },
  orderCuttingReportCard: {
    borderLeftColor: '#14b8a6',
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
  processSection: {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    border: '1px solid #e2e8f0',
  },
  processTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1e293b',
    margin: '0 0 20px 0',
    textAlign: 'center' as const,
  },
  processGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
  },
  processStep: {
    textAlign: 'center' as const,
    padding: '16px',
  },
  processIcon: {
    backgroundColor: '#f1f5f9',
    padding: '16px',
    borderRadius: '8px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '12px',
  },
  processIconSvg: {
    width: '24px',
    height: '24px',
    color: '#475569',
  },
  processStepTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1e293b',
    margin: '0 0 4px 0',
  },
  processStepDesc: {
    fontSize: '14px',
    color: '#64748b',
    margin: 0,
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


