import React from 'react';
import ExportButtons from '@/components/ui/button';

export default function StockReportPage() {
  const exportExcel = () => {
    console.log('Excel export ediliyor...');
  };

  const exportPDF = () => {
    console.log('PDF export ediliyor...');
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Stok Raporu</h1>

      <ExportButtons exportExcel={exportExcel} exportPDF={exportPDF} />

      {/* Örnek tablo */}
      <table className="w-full border">
        <thead>
          <tr>
            <th className="border px-2">Kumaş Türü</th>
            <th className="border px-2">Renk</th>
            <th className="border px-2">Miktar (kg)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border px-2">Poplin</td>
            <td className="border px-2">Beyaz</td>
            <td className="border px-2">25</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
