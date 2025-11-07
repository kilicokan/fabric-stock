import React, { useState, useEffect } from "react";
import { Card, CardContent } from "../../components/ui/card";
import jsPDF from "jspdf";
import "jspdf-autotable";
import ExportButtons from "../../components/ExportButtons";
import Link from "next/link";

type StockItem = {
  id: number;
  fabricName: string;
  color: string;
  totalIn: number;
  totalOut: number;
  currentStock: number;
  unit: string;
  category: string;
  minStockLevel: number;
  lastUpdated: string;
};

function StockReportsPage() {
  const [stockData, setStockData] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<string>("all");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'currentStock',
    direction: 'desc'
  });

  // Fetch real stock data
  useEffect(() => {
    const fetchStockData = async () => {
      try {
        const response = await fetch('/api/fabrics');
        if (response.ok) {
          const data = await response.json();
          // Map fabrics data to StockItem format
          const mappedData: StockItem[] = data.map((fabric: any, index: number) => ({
            id: fabric.id,
            fabricName: fabric.name,
            color: fabric.property || 'N/A', // Use property as color if available
            totalIn: fabric.totalIn || 0,
            totalOut: fabric.totalOut || 0,
            currentStock: fabric.stockQuantity || 0,
            unit: fabric.unit || 'kg',
            category: fabric.property || 'Genel', // Use property as category
            minStockLevel: 10, // Default minimum stock level
            lastUpdated: fabric.updatedAt || new Date().toISOString().split('T')[0],
          }));
          setStockData(mappedData);
        } else {
          console.error('Failed to fetch stock data');
          setStockData([]);
        }
      } catch (error) {
        console.error('Error fetching stock data:', error);
        setStockData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchStockData();
  }, []);

  // Sıralama işlemi
  const sortedData = [...stockData].sort((a, b) => {
    const key = sortConfig.key as keyof StockItem;
    const aValue = a[key];
    const bValue = b[key];

    // Handle undefined/null values
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return 1;
    if (bValue == null) return -1;

    // Numeric sort if both are numbers
    if (typeof aValue === "number" && typeof bValue === "number") {
      return sortConfig.direction === "asc"
        ? aValue - bValue
        : bValue - aValue;
    }

    // Date sort if both are dates (ISO string)
    if (
      typeof aValue === "string" &&
      typeof bValue === "string" &&
      /^\d{4}-\d{2}-\d{2}/.test(aValue) &&
      /^\d{4}-\d{2}-\d{2}/.test(bValue)
    ) {
      const aDate = new Date(aValue).getTime();
      const bDate = new Date(bValue).getTime();
      return sortConfig.direction === "asc"
        ? aDate - bDate
        : bDate - aDate;
    }

    // String sort (default)
    if (typeof aValue === "string" && typeof bValue === "string") {
      return sortConfig.direction === "asc"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    return 0;
  });
  // Filtreleme
  const filteredData = sortedData.filter(
    (item: StockItem) => filter === "all" || item.category === filter
  );

  // Düşük stok uyarısı (stok minimum seviyenin altındaysa)
  const lowStockItems = filteredData.filter(item => item.currentStock <= item.minStockLevel);
  const criticalStockItems = filteredData.filter(item => item.currentStock <= item.minStockLevel * 0.5);

  // Sütun sıralama
  const handleSort = (key: string) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    });
  };

  // PDF export işlemi
  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text("Mevcut Stok Raporu", 14, 15);
    doc.setFontSize(10);
    doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 22);
    doc.text(`Toplam Ürün: ${filteredData.length}`, 14, 28);
    
    // Tablo verileri
    const tableData = filteredData.map((item) => [
      item.id.toString(),
      item.fabricName,
      item.color,
      item.totalIn.toString(),
      item.totalOut.toString(),
      item.currentStock.toString(),
      item.unit,
      item.category,
      item.minStockLevel.toString(),
      new Date(item.lastUpdated).toLocaleDateString('tr-TR')
    ]);

    // @ts-ignore: autoTable is provided by the jsPDF autotable plugin
    (doc as any).autoTable({
      startY: 35,
      head: [["ID", "Kumaş Adı", "Renk", "Toplam Giriş", "Toplam Çıkış", "Mevcut Stok", "Birim", "Kategori", "Min. Stok", "Son Günc."]],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 135, 245] },
      didDrawCell: (data: { column: { index: number; }; cell: { raw: string | number | string[]; x: number; y: number; }; row: { raw: number[]; }; }) => {
        // Düşük stokları kırmızı yap
        if (
          data.column.index === 5 &&
          typeof data.cell.raw === "string" &&
          typeof data.row.raw[8] === "number" &&
          Number(data.cell.raw) <= data.row.raw[8]
        ) {
          doc.setTextColor(255, 0, 0);
          doc.text(String(data.cell.raw), data.cell.x + 2, data.cell.y + 4);
        }
      }
    });

    // Uyarılar
    // @ts-ignore: autoTable plugin attaches lastAutoTable to doc
    const finalY = (doc as any).lastAutoTable && (doc as any).lastAutoTable.finalY
      ? (doc as any).lastAutoTable.finalY + 10
      : 45;
    if (criticalStockItems.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(255, 0, 0);
      doc.text(`KRİTİK STOK: ${criticalStockItems.length} ürün stokları çok az!`, 14, finalY);
      doc.text(`KRİTİK STOK: ${criticalStockItems.length} ürün stokları çok az!`, 14, finalY);
    }
    
    if (lowStockItems.length > 0) {
      doc.setFontSize(10);
      doc.setTextColor(255, 165, 0);
      doc.text(`Düşük Stok: ${lowStockItems.length} ürün`, 14, finalY + (criticalStockItems.length > 0 ? 6 : 0));
    }
    
    doc.save(`mevcut-stok-raporu-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Excel export işlemi
  const handleExportExcel = () => {
    const headers = ["ID", "Kumaş Adı", "Renk", "Toplam Giriş", "Toplam Çıkış", "Mevcut Stok", "Birim", "Kategori", "Min. Stok", "Son Güncelleme"];
    const csvData = filteredData.map((item) =>
      [item.id, item.fabricName, item.color, item.totalIn, item.totalOut, item.currentStock, item.unit, item.category, item.minStockLevel, item.lastUpdated].join(",")
    );
    
    const csvContent = [headers.join(","), ...csvData].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `mevcut-stok-raporu-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV export işlemi
  const handleExportCSV = () => {
    const headers = ["ID", "Kumaş Adı", "Renk", "Toplam Giriş", "Toplam Çıkış", "Mevcut Stok", "Birim", "Kategori", "Min. Stok", "Son Güncelleme"];
    const csvData = filteredData.map((item) =>
      [item.id, item.fabricName, item.color, item.totalIn, item.totalOut, item.currentStock, item.unit, item.category, item.minStockLevel, item.lastUpdated].join(";")
    );
    
    const csvContent = [headers.join(";"), ...csvData].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `mevcut-stok-raporu-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Fix: Use filteredData for categories and add types
  const categories: string[] = ["all", ...Array.from(new Set(filteredData.map((item: any) => item.category)))];

  // Fix: Ensure loading is defined (assume it's a state or prop)
  if (typeof loading !== "undefined" && loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Stok raporu yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '2rem auto', padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
      <div>
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ textAlign: 'left', color: '#2c3e50', marginBottom: '0.25rem', fontSize: '1.8rem' }}>Mevcut Stok Raporu</h1>
              <p style={{ color: '#6c757d' }}>Anlık stok durumu ve envanter bilgileri</p>
            </div>
            <Link 
              href="/reports"
              style={{ padding: '0.75rem 1.25rem', backgroundColor: '#0d6efd', color: '#fff', borderRadius: 8, fontWeight: 600, textDecoration: 'none' }}
            >
              📊 Hareket Raporları
            </Link>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="p-6">
            {/* Filtre ve İstatistikler */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kategori Filtresi
                </label>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Tüm Kategoriler</option>
                  {categories.filter(cat => cat !== "all").map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div style={{ background: '#f8f9fa', padding: 16, borderRadius: 12, border: '1px solid #e9ecef' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#0d6efd' }}>{filteredData.length}</div>
                  <div style={{ fontSize: 13, color: '#6c757d' }}>Toplam Ürün</div>
                </div>
                <div style={{ background: '#f8fff9', padding: 16, borderRadius: 12, border: '1px solid #e6f4ea' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#28a745' }}>
                    {filteredData.reduce((sum, item) => sum + item.currentStock, 0)}
                  </div>
                  <div style={{ fontSize: 13, color: '#6c757d' }}>Toplam Stok</div>
                </div>
                <div style={{ background: '#fff8f1', padding: 16, borderRadius: 12, border: '1px solid #ffe4cc' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#fd7e14' }}>{lowStockItems.length}</div>
                  <div style={{ fontSize: 13, color: '#6c757d' }}>Düşük Stok</div>
                </div>
                <div style={{ background: '#fff5f7', padding: 16, borderRadius: 12, border: '1px solid #ffd6db' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#dc3545' }}>{criticalStockItems.length}</div>
                  <div style={{ fontSize: 13, color: '#6c757d' }}>Kritik Stok</div>
                </div>
              </div>
            </div>

            {/* Uyarılar */}
            {criticalStockItems.length > 0 && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <span className="text-red-600 font-semibold">🚨 KRİTİK STOK UYARISI!</span>
                  <span className="ml-2 text-red-600">
                    {criticalStockItems.length} ürünün stok miktarı minimum seviyenin altında!
                  </span>
                </div>
                <div className="mt-2 text-sm text-red-600">
                  {criticalStockItems.map(item => `${item.fabricName} (${item.color})`).join(", ")}
                </div>
              </div>
            )}

            {lowStockItems.length > 0 && (
              <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center">
                  <span className="text-orange-600 font-semibold">⚠ Düşük Stok Uyarısı</span>
                  <span className="ml-2 text-orange-600">
                    {lowStockItems.length} ürünün stok miktarı minimum seviyeye yaklaşmış.
                  </span>
                </div>
              </div>
            )}

            <ExportButtons
              onExportPDF={handleExportPDF}
              onExportExcel={handleExportExcel}
              onExportCSV={handleExportCSV}
              disabled={filteredData.length === 0}
            />

            {/* Stok Tablosu */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">
                  Stok Durumu ({filteredData.length} ürün)
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('id')}>
                        ID {sortConfig.key === 'id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('fabricName')}>
                        Kumaş Adı {sortConfig.key === 'fabricName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Renk</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('totalIn')}>
                        Toplam Giriş {sortConfig.key === 'totalIn' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('totalOut')}>
                        Toplam Çıkış {sortConfig.key === 'totalOut' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('currentStock')}>
                        Mevcut Stok {sortConfig.key === 'currentStock' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Min. Stok</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('lastUpdated')}>
                        Son Günc. {sortConfig.key === 'lastUpdated' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredData.map((item) => {
                      const isCritical = item.currentStock <= item.minStockLevel * 0.5;
                      const isLow = item.currentStock <= item.minStockLevel && !isCritical;
                      
                      return (
                        <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${
                          isCritical ? 'bg-red-50' : isLow ? 'bg-orange-50' : ''
                        }`}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{item.id}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.fabricName}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                              {item.color}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.totalIn}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.totalOut}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm font-semibold ${
                              isCritical ? 'text-red-600' : isLow ? 'text-orange-600' : 'text-gray-900'
                            }`}>
                              {item.currentStock}
                            </span>
                            {isCritical && <span className="ml-1 text-xs text-red-500">🚨</span>}
                            {isLow && !isCritical && <span className="ml-1 text-xs text-orange-500">⚠</span>}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.minStockLevel}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                              {item.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(item.lastUpdated).toLocaleDateString('tr-TR')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                
                {filteredData.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Filtre kriterlerine uygun veri bulunamadı.</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default StockReportsPage;