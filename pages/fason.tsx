"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "../components/AuthGuard";
import { Truck, Smartphone, Settings, BarChart3, Users, MapPin, ArrowLeft, Package, Scissors, Flame, Zap, CheckCircle } from "lucide-react";

export default function FasonPage() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <AuthGuard requireAuth={true} requiredAccess="fason">
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner}></div>
          <p style={styles.loadingText}>Fason modülü yükleniyor...</p>
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
                  🚛 Mira Fason Takip
                </h1>
                <p style={styles.pageSubtitle}>
                  Fason atölye süreçlerini takip edin ve yönetin
                </p>
              </div>
            </div>
          </div>

          {/* Ana Modüller Grid */}
          <div style={styles.menuGrid}>
            {/* Dashboard */}
            <Link href="/fason/dashboard">
              <div style={{...styles.menuCard, ...styles.dashboardCard}}>
                <div style={styles.menuIcon}>
                  <BarChart3 style={styles.menuIconSvg} />
                </div>
                <h3 style={styles.menuTitle}>Fason Dashboard</h3>
                <p style={styles.menuDescription}>
                  İş emirlerini görüntüleyin, süreçleri takip edin ve raporlar oluşturun
                </p>
              </div>
            </Link>

            {/* Mobil Takipçi */}
            <Link href="/fason/mobile-tracker">
              <div style={{...styles.menuCard, ...styles.mobileCard}}>
                <div style={styles.menuIcon}>
                  <Smartphone style={styles.menuIconSvg} />
                </div>
                <h3 style={styles.menuTitle}>Mobil Takipçi</h3>
                <p style={styles.menuDescription}>
                  Telefon uygulaması için optimize edilmiş takip formu
                </p>
              </div>
            </Link>

            {/* Atölye Yönetimi */}
            <Link href="/fason/workshops">
              <div style={{...styles.menuCard, ...styles.workshopCard}}>
                <div style={styles.menuIcon}>
                  <MapPin style={styles.menuIconSvg} />
                </div>
                <h3 style={styles.menuTitle}>Atölye Yönetimi</h3>
                <p style={styles.menuDescription}>
                  Fason atölyelerini kaydedin ve yönetin
                </p>
              </div>
            </Link>

            {/* İş Emri Oluştur */}
            <Link href="/fason/create-work-order">
              <div style={{...styles.menuCard, ...styles.orderCard}}>
                <div style={styles.menuIcon}>
                  <Settings style={styles.menuIconSvg} />
                </div>
                <h3 style={styles.menuTitle}>İş Emri Oluştur</h3>
                <p style={styles.menuDescription}>
                  Manuel iş emri oluşturun veya ERP'den emirleri görüntüleyin
                </p>
              </div>
            </Link>

            {/* Takipçi Yönetimi */}
            <Link href="/fason/trackers">
              <div style={{...styles.menuCard, ...styles.trackerCard}}>
                <div style={styles.menuIcon}>
                  <Users style={styles.menuIconSvg} />
                </div>
                <h3 style={styles.menuTitle}>Takipçi Yönetimi</h3>
                <p style={styles.menuDescription}>
                  Fason takipçilerini yönetin ve görevler atayın
                </p>
              </div>
            </Link>

            {/* Raporlar */}
            <Link href="/fason/reports">
              <div style={{...styles.menuCard, ...styles.reportsCard}}>
                <div style={styles.menuIcon}>
                  <Truck style={styles.menuIconSvg} />
                </div>
                <h3 style={styles.menuTitle}>Fason Raporları</h3>
                <p style={styles.menuDescription}>
                  Detaylı fason takip raporları ve analizler
                </p>
              </div>
            </Link>
          </div>

          {/* Süreç Bilgileri */}
          <div style={styles.processSection}>
            <h3 style={styles.processTitle}>Fason Takip Süreci</h3>
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
  trackerCard: {
    borderLeftColor: '#ec4899',
  },
  reportsCard: {
    borderLeftColor: '#ef4444',
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