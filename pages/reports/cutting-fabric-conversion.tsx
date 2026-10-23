"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AuthGuard from "../../components/AuthGuard";

interface ConversionRow {
  id: number;
  createdAt: string;
  reportNumber: string | null;
  orderNo: string;
  modelNo: string;
  color: string;
  fabricType: string;
  cuttingTable: string;
  layerCount: number;
  unitType: string;
  quantity: number;
  grammage: number;
  convertedQuantity: number | null;
  convertedUnit: string;
}

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const CuttingFabricConversionReport = () => {
  const [rows, setRows] = useState<ConversionRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

   useEffect(() => {
     const loadReport = async () => {
       try {
         const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
         const response = await fetch('/api/reports/cutting-fabric-conversion', {
           headers: { Authorization: `Bearer ${token}` },
         });
         if (!response.ok) {
           throw new Error('Rapor yüklenemedi');
         }
         const data = await response.json();
         setRows(data.rows || []);
       } catch (fetchError) {
         console.error(fetchError);
         setError('Rapor verileri alınırken hata oluştu.');
       } finally {
         setLoading(false);
       }
     };

     loadReport();
   }, []);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const normalized = search.toLowerCase();
    return rows.filter(row =>
      row.orderNo.toLowerCase().includes(normalized) ||
      row.modelNo.toLowerCase().includes(normalized) ||
      row.color.toLowerCase().includes(normalized) ||
      row.fabricType.toLowerCase().includes(normalized)
    );
  }, [rows, search]);

  const exportCsv = () => {
    const headers = [
      'Tarih',
      'Rapor No',
      'Sipariş No',
      'Model No',
      'Renk',
      'Kumaş Türü',
      'Kesim Masası',
      'Kat',
      'Birim',
      'Miktar',
      'Gramaj',
      'Dönüştürülen Miktar',
      'Dönüşüm Birimi'
    ];

    const csvRows = filteredRows.map(row => [
      formatDate(row.createdAt),
      row.reportNumber || '-',
      row.orderNo,
      row.modelNo,
      row.color,
      row.fabricType,
      row.cuttingTable,
      row.layerCount,
      row.unitType,
      row.quantity.toString(),
      row.grammage.toString(),
      row.convertedQuantity !== null ? row.convertedQuantity.toString() : '-',
      row.convertedUnit
    ]);

    const csvContent = [headers, ...csvRows]
      .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `kumas-donusum-raporu-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <AuthGuard requireAuth={true} requiredAccess="fason">
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner} />
          <p style={styles.loadingText}>Rapor verileri yükleniyor...</p>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard requireAuth={true} requiredAccess="fason">
      <div style={styles.pageContainer}>
        <div style={styles.headerRow}>
          <div>
            <Link href="/fason" style={styles.backLink}>← Fason Ana Sayfa</Link>
            <h1 style={styles.title}>Kumaş Dönüşüm Raporu</h1>
            <p style={styles.subtitle}>Metre ya da kilo bazlı çıkış kayıtlarını karşılaştırın ve karşılıklı dönüştürmeyi görüntüleyin.</p>
          </div>
          <div style={styles.toolbar}>
            <button onClick={exportCsv} style={styles.exportButton}>CSV Olarak İndir</button>
          </div>
        </div>

        {error ? <div style={styles.errorBox}>{error}</div> : null}

        <div style={styles.filterRow}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Sipariş, model, renk veya kumaş türü ara..."
            style={styles.searchInput}
          />
          <div style={styles.summaryBox}>{filteredRows.length} kayıt bulundu</div>
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Rapor No</th>
                <th>Sipariş No</th>
                <th>Model No</th>
                <th>Renk</th>
                <th>Kumaş Türü</th>
                <th>Kesim Masası</th>
                <th>Kat</th>
                <th>Birim</th>
                <th>Miktar</th>
                <th>Gramaj</th>
                <th>Dönüştürülen</th>
                <th>Dönüşüm Birimi</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(row => (
                <tr key={row.id}>
                  <td>{formatDate(row.createdAt)}</td>
                  <td>{row.reportNumber || '-'}</td>
                  <td>{row.orderNo}</td>
                  <td>{row.modelNo}</td>
                  <td>{row.color}</td>
                  <td>{row.fabricType}</td>
                  <td>{row.cuttingTable}</td>
                  <td>{row.layerCount}</td>
                  <td>{row.unitType}</td>
                  <td>{row.quantity}</td>
                  <td>{row.grammage || '-'}</td>
                  <td>{row.convertedQuantity !== null ? row.convertedQuantity : '-'}</td>
                  <td>{row.convertedUnit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AuthGuard>
  );
};

const styles: Record<string, React.CSSProperties> = {
  pageContainer: {
    minHeight: '100vh',
    padding: '24px',
    background: 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)'
  },
  headerRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '18px',
    flexWrap: 'wrap',
    marginBottom: '22px'
  },
  backLink: {
    display: 'inline-block',
    marginBottom: '10px',
    color: '#2563eb',
    textDecoration: 'none'
  },
  title: {
    margin: 0,
    fontSize: '2rem',
    fontWeight: 700,
    color: '#0f172a'
  },
  subtitle: {
    margin: '10px 0 0',
    color: '#475569',
    maxWidth: '640px'
  },
  toolbar: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center'
  },
  exportButton: {
    borderRadius: '12px',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    padding: '12px 18px',
    cursor: 'pointer',
    fontWeight: 600
  },
  filterRow: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
    marginBottom: '16px'
  },
  searchInput: {
    flex: 1,
    minWidth: '280px',
    borderRadius: '14px',
    border: '1px solid #cbd5e1',
    padding: '12px 16px',
    fontSize: '0.95rem',
    outline: 'none'
  },
  summaryBox: {
    borderRadius: '14px',
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    padding: '12px 16px',
    color: '#0f172a',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center'
  },
  tableWrapper: {
    overflowX: 'auto',
    backgroundColor: 'white',
    borderRadius: '22px',
    padding: '18px',
    boxShadow: '0 20px 50px rgba(15,23,42,0.08)'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    padding: '16px 18px',
    borderRadius: '14px',
    marginBottom: '16px'
  },
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef2ff',
    gap: '16px',
    flexDirection: 'column' as const
  },
  loadingSpinner: {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    border: '6px solid rgba(37, 99, 235, 0.2)',
    borderTopColor: '#1d4ed8',
    animation: 'spin 1s linear infinite'
  },
  loadingText: {
    fontSize: '1rem',
    color: '#1f2937'
  }
};

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } table { width: 100%; } th, td { padding: 12px 14px; text-align: left; } th { background-color: #eef2ff; color: #0f172a; font-weight: 700; border-bottom: 1px solid #e2e8f0; } tr:nth-child(even) { background-color: #f8fafc; } tbody tr:hover { background-color: #e0f2fe; }`;
  document.head.appendChild(style);
}

export default CuttingFabricConversionReport;
