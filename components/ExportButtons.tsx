// components/ExportButtons.tsx
import React from 'react';

type ExportButtonsProps = {
  // External handlers (preferred if provided)
  onExportPDF?: () => void;
  onExportExcel?: () => void;
  onExportCSV?: () => void;
  disabled?: boolean;
  className?: string;
  // Fallback internal export using data
  data?: any[];
  filename?: string;
};

const ExportButtons: React.FC<ExportButtonsProps> = ({
  onExportPDF,
  onExportExcel,
  onExportCSV,
  disabled,
  className,
  data,
  filename,
}) => {
  const exportToPDF = async () => {
    if (onExportPDF) {
      onExportPDF();
      return;
    }
    if (!data || data.length === 0) {
      return;
    }
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default as (doc: any, options: any) => void;
    const doc = new jsPDF();
    const headers = Object.keys(data[0] ?? {});
    const rows = data.map(row => Object.values(row));
    autoTable(doc, {
      head: [headers],
      body: rows,
    });
    doc.save(`${filename || 'export'}.pdf`);
  };

  const exportToExcel = async () => {
    if (onExportExcel) {
      onExportExcel();
      return;
    }
    const XLSX = await import('xlsx');
    const worksheet = XLSX.utils.json_to_sheet(data || []);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, `${filename || 'export'}.xlsx`);
  };

  const exportToCSV = async () => {
    if (onExportCSV) {
      onExportCSV();
      return;
    }
    if (!data || data.length === 0) {
      return;
    }
    const headers = Object.keys(data[0] ?? {});
    const csvRows = [headers.join(',')];
    for (const row of data) {
      const values = headers.map(key => {
        const value = row[key];
        const str = value == null ? '' : String(value);
        const escaped = '"' + str.replace(/"/g, '""') + '"';
        return escaped;
      });
      csvRows.push(values.join(','));
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename || 'export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`export-buttons ${className || ''}`}>
      <button onClick={exportToPDF} disabled={disabled} className="btn btn-primary">
        PDF'e Aktar
      </button>
      <button onClick={exportToExcel} disabled={disabled} className="btn btn-secondary">
        Excel'e Aktar
      </button>
      <button onClick={exportToCSV} disabled={disabled} className="btn">
        CSV'e Aktar
      </button>
    </div>
  );
};

export default ExportButtons;