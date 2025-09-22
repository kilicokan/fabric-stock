import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface FabricOrder {
  id: number;
  orderNumber: string;
  orderDate: string;
  supplierName: string;
  fabricType: string;
  color: string;
  pattern: string;
  quantity: string;
  unitType: string;
  arrivalDate: string;
  status: string;
}

export default function FabricOrdersPage() {
  const [data, setData] = useState<FabricOrder[]>([]);
  const [filteredData, setFilteredData] = useState<FabricOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, selectedRow: null });
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    id: undefined as number | undefined,
    orderNumber: "",
    orderDate: "",
    supplierName: "",
    fabricType: "",
    color: "",
    pattern: "",
    quantity: "",
    unitType: "kg",
    arrivalDate: "",
    status: ""
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [fabricTypeFilter, setFabricTypeFilter] = useState("");
  const [arrivalDateFrom, setArrivalDateFrom] = useState("");
  const [arrivalDateTo, setArrivalDateTo] = useState("");
  const [quantityKgMin, setQuantityKgMin] = useState("");
  const [quantityKgMax, setQuantityKgMax] = useState("");
  const [quantityMMin, setQuantityMMin] = useState("");
  const [quantityMMax, setQuantityMMax] = useState("");

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR');
  };

  // Unique values for filters
  const uniqueSuppliers = useMemo(() => [...new Set(data.map(d => d.supplierName))].sort(), [data]);
  const uniqueFabricTypes = useMemo(() => [...new Set(data.map(d => d.fabricType))].sort(), [data]);

  // Örnek veri - Gerçek uygulamada API'den çekilecek
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const sampleData: FabricOrder[] = [
          { 
            id: 1, 
            orderNumber: "SIP001", 
            orderDate: "2025-09-10", 
            supplierName: "AYK Tekstil", 
            fabricType: "Pamuk", 
            color: "Beyaz",
            pattern: "Çizgili",
            quantity: "500", 
            unitType: "kg",
            arrivalDate: "2025-09-20",
            status: "Onaylandı"
          },
          { 
            id: 2, 
            orderNumber: "SIP002", 
            orderDate: "2025-09-12", 
            supplierName: "Maviş Kumaşçılık", 
            fabricType: "Polyester", 
            color: "Mavi",
            pattern: "Düz",
            quantity: "300", 
            unitType: "m",
            arrivalDate: "2025-09-22",
            status: "Beklemede"
          },
          {
            id: 3,
            orderNumber: "SIP003",
            orderDate: "2025-09-15",
            supplierName: "Kumaş Ltd.",
            fabricType: "Viskon",
            color: "Kırmızı",
            pattern: "Desenli",
            quantity: "200",
            unitType: "kg",
            arrivalDate: "2025-09-25",
            status: "İptal Edildi"
          }
        ];
        setData(sampleData);
        setFilteredData(sampleData);
      } catch (error) {
        console.error("Veri yükleme hatası:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Arama ve filtreleme
  useEffect(() => {
    const getSearchableText = (item: FabricOrder) => `
      ${item.orderNumber} ${formatDate(item.orderDate)} ${item.supplierName} ${item.fabricType} ${item.color} ${item.pattern} ${formatDate(item.arrivalDate)} ${item.status}
    `.toLowerCase();

    let filtered = data.filter(item => 
      getSearchableText(item).includes(searchTerm.toLowerCase())
    );

    // Diğer filtreler
    filtered = filtered.filter(item => {
      if (supplierFilter && item.supplierName !== supplierFilter) return false;
      if (fabricTypeFilter && item.fabricType !== fabricTypeFilter) return false;
      if (arrivalDateFrom && item.arrivalDate < arrivalDateFrom) return false;
      if (arrivalDateTo && item.arrivalDate > arrivalDateTo) return false;
      if (statusFilter && item.status !== statusFilter) return false;

      const q = parseFloat(item.quantity);
      if (isNaN(q)) return true;

      if (item.unitType === "kg") {
        if (quantityKgMin && q < parseFloat(quantityKgMin)) return false;
        if (quantityKgMax && q > parseFloat(quantityKgMax)) return false;
      } else if (item.unitType === "m") {
        if (quantityMMin && q < parseFloat(quantityMMin)) return false;
        if (quantityMMax && q > parseFloat(quantityMMax)) return false;
      }

      return true;
    });

    setFilteredData(filtered);
  }, [searchTerm, statusFilter, supplierFilter, fabricTypeFilter, arrivalDateFrom, arrivalDateTo, quantityKgMin, quantityKgMax, quantityMMin, quantityMMax, data]);

  // Sağ tık menüsü
  const handleRightClick = (e: React.MouseEvent, row: FabricOrder) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      selectedRow: row
    });
  };

  // Menü dışına tıklandığında menüyü kapat
  useEffect(() => {
    const handleClick = () => setContextMenu({ visible: false, x: 0, y: 0, selectedRow: null });
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // Yeni sipariş oluştur
  const handleNewOrder = () => {
    setFormData({
      id: undefined,
      orderNumber: "",
      orderDate: new Date().toISOString().split('T')[0],
      supplierName: "",
      fabricType: "",
      color: "",
      pattern: "",
      quantity: "",
      unitType: "kg",
      arrivalDate: "",
      status: "Beklemede"
    });
    setShowForm(true);
    setContextMenu({ visible: false, x: 0, y: 0, selectedRow: null });
  };

  // Siparişi kopyala
  const handleCopyOrder = () => {
    if (contextMenu.selectedRow) {
      setFormData({
        ...contextMenu.selectedRow,
        id: undefined,
        orderNumber: "",
        orderDate: new Date().toISOString().split('T')[0]
      });
      setShowForm(true);
    }
    setContextMenu({ visible: false, x: 0, y: 0, selectedRow: null });
  };

  // Siparişi sil
  const handleDeleteOrder = () => {
    if (contextMenu.selectedRow) {
      if (confirm("Bu siparişi silmek istediğinize emin misiniz?")) {
        setData(data.filter(item => item.id !== contextMenu.selectedRow!.id));
      }
    }
    setContextMenu({ visible: false, x: 0, y: 0, selectedRow: null });
  };

  // Form gönderimi
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newId = Math.max(...data.map(item => item.id), 0) + 1;
    
    const newOrder: FabricOrder = {
      ...formData,
      id: formData.id || newId,
      quantity: formData.quantity,
      orderDate: formData.orderDate,
      arrivalDate: formData.arrivalDate
    };
    
    if (formData.id) {
      setData(data.map(item => item.id === formData.id ? newOrder : item));
    } else {
      setData([...data, newOrder]);
    }
    
    setShowForm(false);
    alert("Sipariş başarıyla kaydedildi!");
  };

  // Form değişikliklerini işle
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Excel Export
  const handleExcelExport = () => {
    if (filteredData.length === 0) {
      alert("Dışarı aktarılacak veri bulunamadı.");
      return;
    }

    const headers = ['Sipariş No', 'Sipariş Tarihi', 'Tedarikçi', 'Kumaş Türü', 'Renk', 'Desen', 'Miktar', 'Birim', 'Geliş Tarihi', 'Durum'];
    const exportData = filteredData.map(row => ({
      'Sipariş No': row.orderNumber,
      'Sipariş Tarihi': formatDate(row.orderDate),
      'Tedarikçi': row.supplierName,
      'Kumaş Türü': row.fabricType,
      'Renk': row.color,
      'Desen': row.pattern,
      'Miktar': row.quantity,
      'Birim': row.unitType,
      'Geliş Tarihi': formatDate(row.arrivalDate),
      'Durum': row.status
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kumaş Siparişleri");
    XLSX.writeFile(wb, `kumas_siparisleri_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // PDF Export
  const handlePDFExport = () => {
    if (filteredData.length === 0) {
      alert("Dışarı aktarılacak veri bulunamadı.");
      return;
    }

    const doc = new jsPDF();
    const headers = [['Sipariş No', 'Sipariş Tarihi', 'Tedarikçi', 'Kumaş Türü', 'Renk', 'Desen', 'Miktar', 'Birim', 'Geliş Tarihi', 'Durum']];
    const body = filteredData.map(row => [
      row.orderNumber,
      formatDate(row.orderDate),
      row.supplierName,
      row.fabricType,
      row.color,
      row.pattern,
      row.quantity,
      row.unitType,
      formatDate(row.arrivalDate),
      row.status
    ]);

    doc.autoTable({
      head: headers,
      body: body,
      startY: 20,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] }
    });

    doc.save(`kumas_siparisleri_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const styles = {
    container: {
      maxWidth: "1400px",
      margin: "2rem auto",
      padding: "2rem",
      backgroundColor: "#f8f9fa",
      borderRadius: "12px",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
    },
    title: {
      textAlign: "center" as const,
      color: "#2c3e50",
      marginBottom: "1.5rem",
      fontSize: "1.8rem"
    },
    searchContainer: {
      display: "flex",
      gap: "1rem",
      alignItems: "center",
      flexWrap: "wrap" as const,
      backgroundColor: "white",
      padding: "1rem",
      borderRadius: "6px",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
      marginBottom: "1.5rem"
    },
    searchInput: {
      flex: 1,
      minWidth: "250px",
      padding: "0.75rem",
      border: "1px solid #ddd",
      borderRadius: "6px",
      fontSize: "1rem",
      outline: "none",
      transition: "border-color 0.3s"
    },
    filterSelect: {
      minWidth: "150px",
      padding: "0.75rem",
      border: "1px solid #ddd",
      borderRadius: "6px",
      fontSize: "1rem",
      outline: "none",
      transition: "border-color 0.3s",
      backgroundColor: "white"
    },
    filterInput: {
      minWidth: "120px",
      padding: "0.75rem",
      border: "1px solid #ddd",
      borderRadius: "6px",
      fontSize: "1rem",
      outline: "none",
      transition: "border-color 0.3s"
    },
    quantityGroup: {
      display: "flex" as const,
      gap: "0.5rem",
      alignItems: "center"
    },
    button: {
      padding: "0.75rem 1.5rem",
      backgroundColor: "#007bff",
      color: "white",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "1rem",
      fontWeight: "600",
      transition: "background-color 0.3s"
    },
    exportButton: {
      padding: "0.75rem 1.5rem",
      backgroundColor: "#28a745",
      color: "white",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "1rem",
      fontWeight: "600",
      transition: "background-color 0.3s"
    },
    pdfButton: {
      padding: "0.75rem 1.5rem",
      backgroundColor: "#dc3545",
      color: "white",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "1rem",
      fontWeight: "600",
      transition: "background-color 0.3s"
    },
    tableContainer: {
      backgroundColor: "white",
      borderRadius: "6px",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
      overflow: "hidden"
    },
    table: {
      width: "100%",
      borderCollapse: "collapse"
    },
    th: {
      padding: "1rem",
      backgroundColor: "#f8f9fa",
      color: "#2c3e50",
      fontSize: "0.9rem",
      fontWeight: "600",
      textTransform: "uppercase",
      textAlign: "left"
    },
    td: {
      padding: "1rem",
      fontSize: "0.9rem",
      color: "#2c3e50",
      borderTop: "1px solid #ddd"
    },
    tr: {
      transition: "background-color 0.2s"
    },
    trHover: {
      backgroundColor: "#f1f3f5"
    },
    contextMenu: {
      position: "fixed" as const,
      backgroundColor: "white",
      borderRadius: "6px",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
      border: "1px solid #ddd",
      zIndex: 1000
    },
    contextMenuItem: {
      display: "flex",
      alignItems: "center",
      padding: "0.75rem 1.5rem",
      color: "#2c3e50",
      fontSize: "0.9rem",
      cursor: "pointer",
      border: "none",
      background: "none",
      width: "100%",
      textAlign: "left" as const,
      transition: "background-color 0.2s"
    },
    contextMenuItemHover: {
      backgroundColor: "#f1f3f5"
    },
    contextMenuItemDisabled: {
      color: "#6c757d",
      cursor: "not-allowed"
    },
    modal: {
      position: "fixed" as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "1rem"
    },
    modalContent: {
      backgroundColor: "white",
      borderRadius: "12px",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
      width: "100%",
      maxWidth: "700px",
      maxHeight: "90vh",
      overflowY: "auto"
    },
    modalHeader: {
      padding: "1rem 1.5rem",
      borderBottom: "1px solid #ddd",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    },
    modalTitle: {
      color: "#2c3e50",
      fontSize: "1.5rem",
      fontWeight: "600"
    },
    modalClose: {
      padding: "0.5rem",
      background: "none",
      border: "none",
      cursor: "pointer",
      color: "#6c757d"
    },
    form: {
      padding: "1.5rem",
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap: "1rem"
    },
    inputGroup: {
      display: "flex",
      flexDirection: "column" as const,
      gap: "0.5rem"
    },
    label: {
      fontWeight: "600",
      color: "#2c3e50",
      fontSize: "0.9rem"
    },
    input: {
      padding: "0.75rem",
      border: "1px solid #ddd",
      borderRadius: "6px",
      fontSize: "1rem",
      outline: "none",
      transition: "border-color 0.3s"
    },
    select: {
      padding: "0.75rem",
      border: "1px solid #ddd",
      borderRadius: "6px",
      fontSize: "1rem",
      outline: "none",
      transition: "border-color 0.3s",
      backgroundColor: "white"
    },
    unitGroup: {
      display: "flex",
      gap: "0.5rem",
      alignItems: "center"
    },
    unitRadio: {
      margin: 0,
      cursor: "pointer"
    },
    buttonGroup: {
      display: "flex",
      gap: "1rem",
      justifyContent: "flex-end",
      paddingTop: "1rem",
      borderTop: "1px solid #ddd",
      gridColumn: "1 / -1"
    },
    cancelButton: {
      padding: "0.75rem 1.5rem",
      backgroundColor: "#6c757d",
      color: "white",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "1rem"
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>🛒 Kumaş Siparişleri</h1>

      <div style={styles.searchContainer}>
        <div style={{ position: "relative", flex: 1, maxWidth: "300px" }}>
          <svg style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", height: "20px", width: "20px", color: "#6c757d" }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            placeholder="Sipariş no, tedarikçi, kumaş, renk, desen ara..."
            style={{ ...styles.searchInput, paddingLeft: "2.5rem" }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={styles.filterSelect}
        >
          <option value="">Tüm Durumlar</option>
          <option value="Beklemede">Beklemede</option>
          <option value="Onaylandı">Onaylandı</option>
          <option value="İptal Edildi">İptal Edildi</option>
        </select>
        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          style={styles.filterSelect}
        >
          <option value="">Tüm Tedarikçiler</option>
          {uniqueSuppliers.map((supplier) => (
            <option key={supplier} value={supplier}>{supplier}</option>
          ))}
        </select>
        <select
          value={fabricTypeFilter}
          onChange={(e) => setFabricTypeFilter(e.target.value)}
          style={styles.filterSelect}
        >
          <option value="">Tüm Kumaş Tipleri</option>
          {uniqueFabricTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <input
          type="date"
          value={arrivalDateFrom}
          onChange={(e) => setArrivalDateFrom(e.target.value)}
          style={styles.filterInput}
          placeholder="Geliş Tarihi Başlangıç"
        />
        <input
          type="date"
          value={arrivalDateTo}
          onChange={(e) => setArrivalDateTo(e.target.value)}
          style={styles.filterInput}
          placeholder="Geliş Tarihi Bitiş"
        />
        <div style={styles.quantityGroup}>
          <input
            type="number"
            placeholder="Kg Min"
            value={quantityKgMin}
            onChange={(e) => setQuantityKgMin(e.target.value)}
            min="0"
            style={{ ...styles.filterInput, width: "80px" }}
          />
          <input
            type="number"
            placeholder="Kg Max"
            value={quantityKgMax}
            onChange={(e) => setQuantityKgMax(e.target.value)}
            min="0"
            style={{ ...styles.filterInput, width: "80px" }}
          />
        </div>
        <div style={styles.quantityGroup}>
          <input
            type="number"
            placeholder="m Min"
            value={quantityMMin}
            onChange={(e) => setQuantityMMin(e.target.value)}
            min="0"
            style={{ ...styles.filterInput, width: "80px" }}
          />
          <input
            type="number"
            placeholder="m Max"
            value={quantityMMax}
            onChange={(e) => setQuantityMMax(e.target.value)}
            min="0"
            style={{ ...styles.filterInput, width: "80px" }}
          />
        </div>
        <button
          style={styles.button}
          onClick={handleNewOrder}
        >
          <svg style={{ height: "20px", width: "20px", marginRight: "0.5rem" }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Yeni Sipariş
        </button>
        <button
          style={styles.exportButton}
          onClick={handleExcelExport}
        >
          📊 Excel
        </button>
        <button
          style={styles.pdfButton}
          onClick={handlePDFExport}
        >
          📄 PDF
        </button>
      </div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              {["Sipariş No", "Sipariş Tarihi", "Tedarikçi", "Kumaş Türü", "Renk", "Desen", "Miktar", "Birim", "Geliş Tarihi", "Durum"].map((header) => (
                <th key={header} style={styles.th}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} style={{ ...styles.td, textAlign: "center", padding: "2rem" }}>
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                    <svg style={{ animation: "spin 1s linear infinite", height: "20px", width: "20px", marginRight: "0.75rem", color: "#007bff" }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Yükleniyor...
                  </div>
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ ...styles.td, textAlign: "center", padding: "2rem" }}>
                  {searchTerm || statusFilter || supplierFilter || fabricTypeFilter || arrivalDateFrom || arrivalDateTo || quantityKgMin || quantityKgMax || quantityMMin || quantityMMax ? "Filtre kriterlerine uygun sipariş bulunamadı." : "Henüz sipariş kaydı bulunmamaktadır."}
                </td>
              </tr>
            ) : (
              filteredData.map((row) => (
                <tr
                  key={row.id}
                  style={styles.tr}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = (styles.trHover as any).backgroundColor}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
                  onContextMenu={(e) => handleRightClick(e, row)}
                >
                  <td style={styles.td}>{row.orderNumber}</td>
                  <td style={styles.td}>{formatDate(row.orderDate)}</td>
                  <td style={styles.td}>{row.supplierName}</td>
                  <td style={styles.td}>{row.fabricType}</td>
                  <td style={styles.td}>{row.color}</td>
                  <td style={styles.td}>{row.pattern}</td>
                  <td style={styles.td}>{row.quantity}</td>
                  <td style={styles.td}>{row.unitType}</td>
                  <td style={styles.td}>{formatDate(row.arrivalDate)}</td>
                  <td style={styles.td}>{row.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {contextMenu.visible && contextMenu.selectedRow && (
        <div style={{ ...styles.contextMenu, top: contextMenu.y, left: contextMenu.x }}>
          <button
            style={styles.contextMenuItem}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = (styles.contextMenuItemHover as any).backgroundColor}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
            onClick={handleNewOrder}
          >
            <svg style={{ height: "16px", width: "16px", marginRight: "0.5rem", color: "#6c757d" }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Yeni
          </button>
          <button
            style={{ ...styles.contextMenuItem, ...(contextMenu.selectedRow ? {} : styles.contextMenuItemDisabled) }}
            onMouseEnter={(e) => contextMenu.selectedRow && (e.currentTarget.style.backgroundColor = (styles.contextMenuItemHover as any).backgroundColor)}
            onMouseLeave={(e) => contextMenu.selectedRow && (e.currentTarget.style.backgroundColor = "white")}
            onClick={handleCopyOrder}
          >
            <svg style={{ height: "16px", width: "16px", marginRight: "0.5rem", color: contextMenu.selectedRow ? "#6c757d" : "#adb5bd" }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
              <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" />
            </svg>
            Kopyala
          </button>
          <button
            style={{ ...styles.contextMenuItem, ...(contextMenu.selectedRow ? { color: "#dc3545" } : styles.contextMenuItemDisabled) }}
            onMouseEnter={(e) => contextMenu.selectedRow && (e.currentTarget.style.backgroundColor = (styles.contextMenuItemHover as any).backgroundColor)}
            onMouseLeave={(e) => contextMenu.selectedRow && (e.currentTarget.style.backgroundColor = "white")}
            onClick={handleDeleteOrder}
          >
            <svg style={{ height: "16px", width: "16px", marginRight: "0.5rem", color: contextMenu.selectedRow ? "#dc3545" : "#adb5bd" }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Sil
          </button>
        </div>
      )}

      {showForm && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{formData.id ? "Sipariş Düzenle" : "Yeni Sipariş"}</h2>
              <button style={styles.modalClose} onClick={() => setShowForm(false)}>
                <svg style={{ height: "24px", width: "24px" }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleFormSubmit} style={styles.form}>
              {[
                { name: "orderNumber", label: "Sipariş No", required: true },
                { name: "orderDate", label: "Sipariş Tarihi", required: true, type: "date" },
                { name: "supplierName", label: "Tedarikçi", required: true },
                { name: "fabricType", label: "Kumaş Türü", required: true },
                { name: "color", label: "Renk", required: true },
                { name: "pattern", label: "Desen", required: true },
                { name: "quantity", label: "Miktar", required: true, type: "number" },
                { name: "arrivalDate", label: "Geliş Tarihi", required: true, type: "date" }
              ].map((field) => (
                <div key={field.name} style={styles.inputGroup}>
                  <label style={styles.label}>{field.label}</label>
                  <input
                    type={field.type || "text"}
                    name={field.name}
                    value={formData[field.name as keyof typeof formData] || ""}
                    onChange={handleFormChange}
                    style={styles.input}
                    required={field.required}
                    min={field.type === "number" ? "0" : undefined}
                  />
                </div>
              ))}
              <div style={styles.inputGroup}>
                <label style={styles.label}>Birim (kg/m)</label>
                <div style={styles.unitGroup}>
                  <label>
                    <input
                      type="radio"
                      name="unitType"
                      value="kg"
                      checked={formData.unitType === "kg"}
                      onChange={handleFormChange}
                      style={styles.unitRadio}
                    />
                    Kg
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="unitType"
                      value="m"
                      checked={formData.unitType === "m"}
                      onChange={handleFormChange}
                      style={styles.unitRadio}
                    />
                    m
                  </label>
                </div>
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Durum</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleFormChange}
                  style={styles.select}
                  required
                >
                  <option value="">Seçiniz</option>
                  <option value="Beklemede">Beklemede</option>
                  <option value="Onaylandı">Onaylandı</option>
                  <option value="İptal Edildi">İptal Edildi</option>
                </select>
              </div>
              <div style={styles.buttonGroup}>
                <button
                  type="button"
                  style={styles.cancelButton}
                  onClick={() => setShowForm(false)}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  style={styles.button}
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}