import React, { useState, useEffect } from "react";
import { Card, CardContent } from "../../components/ui/card";
import jsPDF from "jspdf";
import "jspdf-autotable";
import ExportButtons from "../../components/ExportButtons";
import Link from "next/link";
import { 
  FiTrendingUp, 
  FiTrendingDown, 
  FiPackage, 
  FiCalendar,
  FiFilter,
  FiDownload,
  FiTruck
} from "react-icons/fi";

// Türkçe tarih formatı için locale ayarı
const turkishLocale = "tr-TR";

type FabricTransaction = {
  id: number;
  type: "in" | "out";
  fabricName: string;
  quantity: number;
  unit: string;
  color: string;
  supplier?: string;
  customer?: string;
  transactionDate: string;
  category: string;
  notes?: string;
};

const ReportsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<FabricTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filters, setFilters] = useState({
    type: "all",
    category: "all",
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [showFilters, setShowFilters] = useState(false);

  // Örnek veri
  useEffect(() => {
    const sampleData: FabricTransaction[] = [
      { 
        id: 1, 
        type: 'in', 
        fabricName: "Pamuk Kumaş", 
        quantity: 100, 
        unit: "metre", 
        color: "Beyaz",
        supplier: "Tedarikçi A", 
        transactionDate: "2024-01-15", 
        category: "Pamuk",
        notes: "1. kalite pamuk"
      },
      { 
        id: 2, 
        type: 'in', 
        fabricName: "Polyester Kumaş", 
        quantity: 150, 
        unit: "metre", 
        color: "Siyah",
        supplier: "Tedarikçi B", 
        transactionDate: "2024-01-14", 
        category: "Polyester" 
      },
      { 
        id: 3, 
        type: 'out', 
        fabricName: "Pamuk Kumaş", 
        quantity: 30, 
        unit: "metre", 
        color: "Beyaz",
        customer: "Müşteri X", 
        transactionDate: "2024-01-16", 
        category: "Pamuk",
        notes: "Üretim için çıkış"
      },
      { 
        id: 4, 
        type: 'out', 
        fabricName: "Polyester Kumaş", 
        quantity: 50, 
        unit: "metre", 
        color: "Siyah",
        customer: "Müşteri Y", 
        transactionDate: "2024-01-13", 
        category: "Polyester" 
      },
      { 
        id: 5, 
        type: 'in', 
        fabricName: "Yün Kumaş", 
        quantity: 80, 
        unit: "metre", 
        color: "Krem",
        supplier: "Tedarikçi C", 
        transactionDate: "2024-01-12", 
        category: "Yün" 
      },
      { 
        id: 6, 
        type: 'out', 
        fabricName: "Yün Kumaş", 
        quantity: 20, 
        unit: "metre", 
        color: "Krem",
        customer: "Müşteri Z", 
        transactionDate: "2024-01-11", 
        category: "Yün" 
      }
    ];

    setTimeout(() => {
      setTransactions(sampleData);
      setLoading(false);
    }, 1000);
  }, []);

  // Filtreleme
  const filteredData = transactions.filter(transaction => {
    const matchesType = filters.type === "all" || transaction.type === filters.type;
    const matchesCategory = filters.category === "all" || transaction.category === filters.category;
    const transactionDate = new Date(transaction.transactionDate);
    const startDate = new Date(filters.startDate);
    const endDate = new Date(filters.endDate);
    const matchesDate = transactionDate >= startDate && transactionDate <= endDate;
    
    return matchesType && matchesCategory && matchesDate;
  });

  // İstatistikler
  const totalIn = filteredData.filter(t => t.type === 'in').reduce((sum, t) => sum + t.quantity, 0);
  const totalOut = filteredData.filter(t => t.type === 'out').reduce((sum, t) => sum + t.quantity, 0);
  const netMovement = totalIn - totalOut;

  // Export fonksiyonları
  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text("Kumaş Hareket Raporu", 14, 15);
    doc.setFontSize(10);
    doc.text(`Tarih: ${filters.startDate} - ${filters.endDate}`, 14, 22);
    
    const tableData = filteredData.map((t) => [
      t.id.toString(),
      t.type === 'in' ? 'Giriş' : 'Çıkış',
      t.fabricName,
      t.color,
      t.quantity.toString(),
      t.unit,
      t.category,
      t.type === 'in' ? t.supplier : t.customer,
      new Date(t.transactionDate).toLocaleDateString('tr-TR')
    ]);

    // @ts-ignore
    (doc as any).autoTable({
      startY: 35,
      head: [["ID", "Tip", "Kumaş Adı", "Renk", "Miktar", "Birim", "Kategori", "Tedarikçi/Müşteri", "Tarih"]],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 135, 245] }
    });

    // @ts-ignore
    const finalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : 45;
    doc.setFontSize(10);
    doc.text(`Toplam Giriş: ${totalIn} metre`, 14, finalY);
    doc.text(`Toplam Çıkış: ${totalOut} metre`, 14, finalY + 6);
    doc.text(`Net Hareket: ${netMovement} metre`, 14, finalY + 12);
    
    doc.save(`kumas-hareket-raporu-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExportExcel = () => {
    const headers = ["ID", "Tip", "Kumaş Adı", "Renk", "Miktar", "Birim", "Kategori", "Tedarikçi/Müşteri", "Tarih", "Notlar"];
    const csvData = filteredData.map((t) =>
      [t.id, t.type === 'in' ? 'Giriş' : 'Çıkış', t.fabricName, t.color, t.quantity, t.unit, t.category, t.type === 'in' ? t.supplier : t.customer, t.transactionDate, t.notes || ''].join(",")
    );
    
    const csvContent = [headers.join(","), ...csvData].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `kumas-hareket-raporu-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCSV = () => {
    const headers = ["ID", "Tip", "Kumaş Adı", "Renk", "Miktar", "Birim", "Kategori", "Tedarikçi/Müşteri", "Tarih", "Notlar"];
    const csvData = filteredData.map((t) =>
      [t.id, t.type === 'in' ? 'Giriş' : 'Çıkış', t.fabricName, t.color, t.quantity, t.unit, t.category, t.type === 'in' ? t.supplier : t.customer, t.transactionDate, t.notes || ''].join(";")
    );
    
    const csvContent = [headers.join(";"), ...csvData].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `kumas-hareket-raporu-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const categories = ["all", ...new Set(transactions.map(t => t.category))];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600 text-lg font-medium">Raporlar yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-2 md:px-8">
      <div>
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <div>
              <Link href="/" style={{ color: '#007bff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ marginRight: '0.5rem' }} aria-hidden="true">←</span>
                Ana Sayfaya Dön
              </Link>
              <h1 style={styles.mainTitle}>Kumaş Hareket Raporları</h1>
              <p style={{ color: '#6c757d', marginTop: '0.25rem' }}>Gelen ve giden kumaş hareketlerini takip edin</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Link href="/reports/stock" style={styles.scaleButton}>
                <FiPackage style={{ marginRight: '0.5rem' }} />
                Stok Raporu
              </Link>
            </div>
          </div>
        </div>

        <Card className="mb-6" style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', borderRadius: 12, overflow: 'hidden' }}>
          <CardContent className="p-0">
            {/* Filtreler ve İstatistikler */}
            <div className="bg-white p-6 border-b border-gray-100">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Hareket Özeti</h2>
                  <p className="text-gray-600">{filteredData.length} kayıt bulundu</p>
                </div>
                
                <button onClick={() => setShowFilters(!showFilters)} style={styles.smallButton}>
                  <FiFilter style={{ marginRight: '0.5rem' }} />
                  Filtreler {showFilters ? '✓' : ''}
                </button>
              </div>

              {/* Filtre Formu */}
              {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 bg-blue-50 rounded-xl">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Hareket Tipi
                    </label>
                    <select
                      value={filters.type}
                      onChange={(e) => setFilters({...filters, type: e.target.value})}
                      className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                    >
                      <option value="all">Tüm Hareketler</option>
                      <option value="in">Gelen Kumaş</option>
                      <option value="out">Giden Kumaş</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Kategori
                    </label>
                    <select
                      value={filters.category}
                      onChange={(e) => setFilters({...filters, category: e.target.value})}
                      className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                    >
                      {categories.map(category => (
                        <option key={category} value={category}>
                          {category === "all" ? "Tüm Kategoriler" : category}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FiCalendar className="inline mr-2" />
                      Başlangıç
                    </label>
                    <input
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                      className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FiCalendar className="inline mr-2" />
                      Bitiş
                    </label>
                    <input
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                      className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                    />
                  </div>
                </div>
              )}

              {/* İstatistik Kartları */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div style={{ background: '#0d6efd', padding: 24, borderRadius: 16, color: 'white', boxShadow: '0 6px 16px rgba(13,110,253,0.25)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-3xl font-bold">{totalIn}</div>
                      <div className="text-blue-100">Toplam Giriş (metre)</div>
                    </div>
                    <FiTrendingUp className="text-3xl opacity-80" />
                  </div>
                  <div style={{ marginTop: 8, opacity: 0.85, fontSize: 14 }}>
                    <FiTruck className="inline mr-1" />
                    {filteredData.filter(t => t.type === 'in').length} giriş hareketi
                  </div>
                </div>

                <div style={{ background: '#dc3545', padding: 24, borderRadius: 16, color: 'white', boxShadow: '0 6px 16px rgba(220,53,69,0.25)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-3xl font-bold">{totalOut}</div>
                      <div className="text-red-100">Toplam Çıkış (metre)</div>
                    </div>
                    <FiTrendingDown className="text-3xl opacity-80" />
                  </div>
                  <div style={{ marginTop: 8, opacity: 0.85, fontSize: 14 }}>
                    <FiTruck className="inline mr-1" />
                    {filteredData.filter(t => t.type === 'out').length} çıkış hareketi
                  </div>
                </div>

                <div style={{ padding: 24, borderRadius: 16, color: 'white', boxShadow: '0 6px 16px rgba(0,0,0,0.12)', background: netMovement >= 0 ? '#28a745' : '#fd7e14' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-3xl font-bold">{netMovement}</div>
                      <div className="opacity-90">Net Hareket (metre)</div>
                    </div>
                    <div style={{ fontSize: 20, opacity: 0.9 }}>{netMovement >= 0 ? '↗' : '↘'}</div>
                  </div>
                  <div className="mt-2 opacity-80 text-sm">
                    {netMovement >= 0 ? 'Stok artışı' : 'Stok azalışı'}
                  </div>
                </div>
              </div>

              {/* Export Butonları */}
              <div className="flex flex-wrap gap-3 mb-6">
                <button
                  onClick={handleExportPDF}
                  disabled={filteredData.length === 0}
                  style={{ ...styles.scaleButton, backgroundColor: '#dc3545' }}
                >
                  <FiDownload className="mr-2" />
                  PDF Rapor
                </button>
                <button
                  onClick={handleExportExcel}
                  disabled={filteredData.length === 0}
                  style={{ ...styles.scaleButton, backgroundColor: '#28a745' }}
                >
                    <FiDownload className="mr-2" />
                    Excel Export
                  </button>
                  <button
                    onClick={handleExportCSV}
                    disabled={filteredData.length === 0}
                    style={{ ...styles.scaleButton, backgroundColor: '#0d6efd' }}
                >
                  <FiDownload className="mr-2" />
                  CSV Export
                </button>
              </div>
            </div>

            {/* Veri Tablosu */}
            <div className="bg-white">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 style={{ display: 'flex', alignItems: 'center', fontWeight: 600, color: '#2c3e50' }}>
                  <FiPackage style={{ marginRight: 8, color: '#0d6efd' }} />
                  Kumaş Hareket Detayları
                  <span style={{ marginLeft: 8, padding: '2px 8px', background: '#e7f1ff', color: '#0d6efd', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                    {filteredData.length} kayıt
                  </span>
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tip</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Kumaş</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Renk</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Miktar</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Kategori</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">İlgili Kişi</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tarih</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Notlar</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredData.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-blue-50 transition-all duration-200">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900 bg-gray-100 px-2 py-1 rounded-full">
                            #{transaction.id}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            transaction.type === 'in' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {transaction.type === 'in' ? 
                              <><FiTrendingUp className="mr-1" /> Giriş</> : 
                              <><FiTrendingDown className="mr-1" /> Çıkış</>
                            }
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {transaction.fabricName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            <div className="w-3 h-3 rounded-full mr-2" style={{backgroundColor: transaction.color.toLowerCase()}}></div>
                            {transaction.color}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-semibold text-gray-900">{transaction.quantity}</span>
                          <span className="text-gray-500 text-sm ml-1">{transaction.unit}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            {transaction.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {transaction.type === 'in' ? 
                            <span className="text-green-600">{transaction.supplier}</span> : 
                            <span className="text-red-600">{transaction.customer}</span>
                          }
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(transaction.transactionDate).toLocaleDateString('tr-TR')}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                          {transaction.notes && (
                            <span className="bg-yellow-50 px-2 py-1 rounded text-xs">
                              {transaction.notes}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {filteredData.length === 0 && (
                  <div className="text-center py-12">
                    <FiPackage className="text-4xl text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">Filtre kriterlerine uygun veri bulunamadı.</p>
                    <p className="text-gray-400 mt-2">Filtreleri genişleterek tekrar deneyin.</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
export default ReportsPage;
// remove duplicate default export (already exported above)

// Basit tema stilleri (Ürünler sayfasına uyumlu)
const styles = {
  container: {
    maxWidth: "900px",
    margin: "2rem auto",
    padding: "1.5rem",
    backgroundColor: "#fff",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  mainTitle: {
    textAlign: "left",
    color: "#2c3e50",
    marginBottom: "0.25rem",
    fontSize: "1.8rem",
  },
  scaleButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "0.75rem 1.25rem",
    backgroundColor: "#0d6efd",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontWeight: 600,
    textDecoration: "none",
    cursor: "pointer",
  },
  smallButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "0.5rem 0.9rem",
    backgroundColor: "#e7f1ff",
    color: "#0d6efd",
    border: "1px solid #cfe2ff",
    borderRadius: 8,
    fontWeight: 600,
    textDecoration: "none",
    cursor: "pointer",
  },
} as const;