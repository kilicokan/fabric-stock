"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import AuthGuard from "../components/AuthGuard";
import { Package, FileText, TrendingUp, BarChart3, PlusCircle, ArrowLeft } from "lucide-react";

type StockItem = {
  fabricType: string;
  color: string;
  remainingKg: number;
};

export default function StockPage() {
  const [stockSummary, setStockSummary] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchStock();
  }, []);

  const fetchStock = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/fabric-entry/remaining-stock/by-fabric-type");
      setStockSummary(res.data);
    } catch (err) {
      console.error("Stok verisi alınamadı", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AuthGuard requireAuth={true} requiredAccess="stock">
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner}></div>
          <p style={styles.loadingText}>Stok verileri yükleniyor...</p>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard requireAuth={true} requiredAccess="stock">
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
                  📦 Mira Stock - Kumaş Stok Yönetimi
                </h1>
                <p style={styles.pageSubtitle}>
                  Stok durumunuzu yönetin, analiz edin, kontrol edin
                </p>
              </div>
            </div>
          </div>

          {/* Stok Özet Kartları */}
          <div style={styles.statsGrid}>
            {stockSummary.length > 0 ? (
              stockSummary.map((item, i) => (
                <div key={i} style={styles.statCard}>
                  <div style={styles.statIcon}>
                    <Package style={styles.statIconSvg} />
                  </div>
                  <div style={styles.statInfo}>
                    <h3 style={styles.statTitle}>{item.fabricType}</h3>
                    <p style={styles.statSubtitle}>{item.color}</p>
                    <p style={styles.statValue}>
                      {typeof item.remainingKg === "number" ? item.remainingKg.toFixed(2) : "0.00"} kg
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div style={styles.noDataCard}>
                <Package style={styles.noDataIcon} />
                <h3 style={styles.noDataTitle}>Henüz Stok Verisi Yok</h3>
                <p style={styles.noDataText}>Kumaş girişi yaparak stok verisi oluşturabilirsiniz</p>
              </div>
            )}
          </div>

          {/* Ana Menü Butonları */}
          <div style={styles.menuGrid}>
            <Link href="/fabric-entry">
              <div style={{...styles.menuCard, ...styles.entryCard}}>
                <div style={styles.menuIcon}>
                  <PlusCircle style={styles.menuIconSvg} />
                </div>
                <h3 style={styles.menuTitle}>Kumaş Girişi</h3>
                <p style={styles.menuDescription}>Yeni kumaş girişi kaydet</p>
              </div>
            </Link>

            <Link href="/fabric-exit">
              <div style={{...styles.menuCard, ...styles.exitCard}}>
                <div style={styles.menuIcon}>
                  <Package style={styles.menuIconSvg} />
                </div>
                <h3 style={styles.menuTitle}>Kumaş Çıkışı</h3>
                <p style={styles.menuDescription}>Stok çıkış işlemi yap</p>
              </div>
            </Link>

            <Link href="/reports/stock">
              <div style={{...styles.menuCard, ...styles.reportsCard}}>
                <div style={styles.menuIcon}>
                  <BarChart3 style={styles.menuIconSvg} />
                </div>
                <h3 style={styles.menuTitle}>Stok Raporları</h3>
                <p style={styles.menuDescription}>Detaylı stok analizleri</p>
              </div>
            </Link>

            <Link href="/fabrics">
              <div style={{...styles.menuCard, ...styles.fabricsCard}}>
                <div style={styles.menuIcon}>
                  <FileText style={styles.menuIconSvg} />
                </div>
                <h3 style={styles.menuTitle}>Kumaş Kartları</h3>
                <p style={styles.menuDescription}>Kumaş tanımları yönet</p>
              </div>
            </Link>

            <Link href="/products">
              <div style={{...styles.menuCard, ...styles.productsCard}}>
                <div style={styles.menuIcon}>
                  <TrendingUp style={styles.menuIconSvg} />
                </div>
                <h3 style={styles.menuTitle}>Ürün Yönetimi</h3>
                <p style={styles.menuDescription}>Ürün tanımları ve kategoriler</p>
              </div>
            </Link>

            <Link href="/customers">
              <div style={{...styles.menuCard, ...styles.customersCard}}>
                <div style={styles.menuIcon}>
                  <FileText style={styles.menuIconSvg} />
                </div>
                <h3 style={styles.menuTitle}>Müşteri Yönetimi</h3>
                <p style={styles.menuDescription}>Müşteri bilgileri ve iletişim</p>
              </div>
            </Link>
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
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px',
    marginBottom: '40px',
  },
  statCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    border: '1px solid #e2e8f0',
  },
  statIcon: {
    backgroundColor: '#eff6ff',
    padding: '12px',
    borderRadius: '8px',
  },
  statIconSvg: {
    width: '24px',
    height: '24px',
    color: '#3b82f6',
  },
  statInfo: {
    flex: 1,
  },
  statTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1e293b',
    margin: '0 0 4px 0',
  },
  statSubtitle: {
    fontSize: '14px',
    color: '#64748b',
    margin: '0 0 8px 0',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#059669',
    margin: 0,
  },
  noDataCard: {
    backgroundColor: 'white',
    padding: '40px 20px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    textAlign: 'center' as const,
    border: '1px solid #e2e8f0',
    gridColumn: '1 / -1',
  },
  noDataIcon: {
    width: '48px',
    height: '48px',
    color: '#94a3b8',
    margin: '0 auto 16px',
  },
  noDataTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#475569',
    margin: '0 0 8px 0',
  },
  noDataText: {
    fontSize: '14px',
    color: '#64748b',
    margin: 0,
  },
  menuGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
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
  },
  entryCard: {
    borderLeft: '4px solid #10b981',
  },
  exitCard: {
    borderLeft: '4px solid #ef4444',
  },
  reportsCard: {
    borderLeft: '4px solid #8b5cf6',
  },
  fabricsCard: {
    borderLeft: '4px solid #f59e0b',
  },
  productsCard: {
    borderLeft: '4px solid #06b6d4',
  },
  customersCard: {
    borderLeft: '4px solid #ec4899',
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