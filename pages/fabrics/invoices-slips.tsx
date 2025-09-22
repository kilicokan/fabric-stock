import { useState, useEffect } from "react";
import axios from "axios";

export default function InvoicesSlipsPage() {
  const [activeTab, setActiveTab] = useState("irsaliyeler");
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, selectedRow: null });
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    id: undefined,
    documentType: "irsaliye",
    fgTuru: "",
    fgNumarasi: "",
    fgTarihi: "",
    cariHesapKodu: "",
    cariHesapAdi: "",
    belgeNumarasi: "",
    girisDepoKodu: "",
    cikisDepoKodu: "",
    fgToplam: ""
  });
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const sampleData = [
          { 
            id: 1, 
            fgTuru: "1-Alım İrsaliyesi", 
            fgNumarasi: "00000707", 
            fgTarihi: "11.05.2025", 
            cariHesapKodu: "00000162", 
            cariHesapAdi: "02GQIN BECANAPILAT KUMAŞÇILIK", 
            belgeNumarasi: "00000707", 
            girisDepoKodu: "KD", 
            cikisDepoKodu: "", 
            fgToplam: "62.819,620",
            documentType: "irsaliye"
          },
          { 
            id: 2, 
            fgTuru: "122-Alım İade İrsaliyesi", 
            fgNumarasi: "00000237", 
            fgTarihi: "09.09.2025", 
            cariHesapKodu: "00000138", 
            cariHesapAdi: "MAVİŞ KUMAŞÇILIK", 
            belgeNumarasi: "00000237", 
            girisDepoKodu: "KD", 
            cikisDepoKodu: "KD", 
            fgToplam: "33.150,00",
            documentType: "irsaliye"
          },
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

  useEffect(() => {
    const filtered = data.filter(item => 
      item.documentType === activeTab && (
        item.fgTuru.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.fgNumarasi.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.cariHesapAdi.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.belgeNumarasi.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
    setFilteredData(filtered);
  }, [searchTerm, data, activeTab]);

  const handleRightClick = (e, row) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      selectedRow: row
    });
  };

  useEffect(() => {
    const handleClick = () => setContextMenu({ visible: false, x: 0, y: 0, selectedRow: null });
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const handleNewDocument = () => {
    setFormData({
      documentType: activeTab,
      fgTuru: "",
      fgNumarasi: "",
      fgTarihi: "",
      cariHesapKodu: "",
      cariHesapAdi: "",
      belgeNumarasi: "",
      girisDepoKodu: "",
      cikisDepoKodu: "",
      fgToplam: ""
    });
    setShowForm(true);
    setContextMenu({ visible: false, x: 0, y: 0, selectedRow: null });
  };

  const handleCopyDocument = () => {
    if (contextMenu.selectedRow) {
      setFormData({
        ...contextMenu.selectedRow,
        fgNumarasi: "",
        belgeNumarasi: "",
        fgTarihi: new Date().toLocaleDateString('tr-TR')
      });
      setShowForm(true);
    }
    setContextMenu({ visible: false, x: 0, y: 0, selectedRow: null });
  };

  const handleDeleteDocument = () => {
    if (contextMenu.selectedRow) {
      if (confirm("Bu belgeyi silmek istediğinize emin misiniz?")) {
        setData(data.filter(item => item.id !== contextMenu.selectedRow.id));
      }
    }
    setContextMenu({ visible: false, x: 0, y: 0, selectedRow: null });
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const newId = Math.max(...data.map(item => item.id), 0) + 1;
    
    const newDocument = {
      ...formData,
      id: formData.id || newId
    };
    
    if (formData.id) {
      setData(data.map(item => item.id === formData.id ? newDocument : item));
    } else {
      setData([...data, newDocument]);
    }
    
    setShowForm(false);
    alert("Belge başarıyla kaydedildi!");
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const styles = {
    container: {
      maxWidth: "1200px",
      margin: "2rem auto",
      padding: "2rem",
      backgroundColor: "#f8f9fa",
      borderRadius: "12px",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
    },
    title: {
      textAlign: "center",
      color: "#2c3e50",
      marginBottom: "1.5rem",
      fontSize: "1.8rem"
    },
    tabContainer: {
      display: "flex",
      gap: "1rem",
      borderBottom: "1px solid #ddd",
      marginBottom: "1.5rem"
    },
    tab: {
      padding: "0.75rem 1.5rem",
      backgroundColor: "transparent",
      color: "#2c3e50",
      border: "none",
      borderBottom: "2px solid transparent",
      cursor: "pointer",
      fontSize: "1rem",
      fontWeight: "600",
      transition: "all 0.3s"
    },
    activeTab: {
      borderBottom: "2px solid #007bff",
      color: "#007bff"
    },
    searchContainer: {
      display: "flex",
      gap: "1rem",
      alignItems: "center",
      backgroundColor: "white",
      padding: "1rem",
      borderRadius: "6px",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
      marginBottom: "1.5rem"
    },
    searchInput: {
      flex: 1,
      padding: "0.75rem",
      border: "1px solid #ddd",
      borderRadius: "6px",
      fontSize: "1rem",
      outline: "none",
      transition: "border-color 0.3s"
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
      position: "fixed",
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
      textAlign: "left",
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
      position: "fixed",
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
      maxWidth: "800px",
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
      flexDirection: "column",
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
    buttonGroup: {
      display: "flex",
      gap: "1rem",
      justifyContent: "flex-end",
      paddingTop: "1rem",
      borderTop: "1px solid #ddd"
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
      <h1 style={styles.title}>📄 Kumaş Belgeleri</h1>
      
      <div style={styles.tabContainer}>
        <button
          style={{ ...styles.tab, ...(activeTab === "irsaliyeler" ? styles.activeTab : {}) }}
          onClick={() => setActiveTab("irsaliyeler")}
        >
          Kumaş İrsaliyeleri
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === "faturalar" ? styles.activeTab : {}) }}
          onClick={() => setActiveTab("faturalar")}
        >
          Kumaş Faturaları
        </button>
      </div>

      <div style={styles.searchContainer}>
        <div style={{ position: "relative", flex: 1, maxWidth: "400px" }}>
          <svg style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", height: "20px", width: "20px", color: "#6c757d" }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            placeholder="Belge no, cari adı veya FG türü ara..."
            style={{ ...styles.searchInput, paddingLeft: "2.5rem" }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          style={styles.button}
          onClick={handleNewDocument}
        >
          <svg style={{ height: "20px", width: "20px", marginRight: "0.5rem" }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Yeni Belge
        </button>
      </div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              {["Fg Türü", "Fg Numarası", "Fg Tarihi", "Cari Hesap Kodu", "Cari Hesap Adı", "Belge Numarası", "Giriş Depo Kodu", "Çıkış Depo Kodu", "Fg Toplam"].map((header) => (
                <th key={header} style={styles.th}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ ...styles.td, textAlign: "center", padding: "2rem" }}>
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
                <td colSpan={9} style={{ ...styles.td, textAlign: "center", padding: "2rem" }}>
                  {searchTerm ? "Arama kriterlerine uygun belge bulunamadı." : "Henüz belge kaydı bulunmamaktadır."}
                </td>
              </tr>
            ) : (
              filteredData.map((row) => (
                <tr
                  key={row.id}
                  style={styles.tr}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = styles.trHover.backgroundColor}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
                  onContextMenu={(e) => handleRightClick(e, row)}
                >
                  <td style={styles.td}>{row.fgTuru}</td>
                  <td style={styles.td}>{row.fgNumarasi}</td>
                  <td style={styles.td}>{row.fgTarihi}</td>
                  <td style={styles.td}>{row.cariHesapKodu}</td>
                  <td style={styles.td}>{row.cariHesapAdi}</td>
                  <td style={styles.td}>{row.belgeNumarasi}</td>
                  <td style={styles.td}>{row.girisDepoKodu}</td>
                  <td style={styles.td}>{row.cikisDepoKodu}</td>
                  <td style={{ ...styles.td, textAlign: "right" }}>{row.fgToplam}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {contextMenu.visible && (
        <div style={{ ...styles.contextMenu, top: contextMenu.y, left: contextMenu.x }}>
          <button
            style={styles.contextMenuItem}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = styles.contextMenuItemHover.backgroundColor}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
            onClick={handleNewDocument}
          >
            <svg style={{ height: "16px", width: "16px", marginRight: "0.5rem", color: "#6c757d" }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Yeni
          </button>
          <button
            style={{ ...styles.contextMenuItem, ...(contextMenu.selectedRow ? {} : styles.contextMenuItemDisabled) }}
            onMouseEnter={(e) => contextMenu.selectedRow && (e.currentTarget.style.backgroundColor = styles.contextMenuItemHover.backgroundColor)}
            onMouseLeave={(e) => contextMenu.selectedRow && (e.currentTarget.style.backgroundColor = "white")}
            onClick={handleCopyDocument}
            disabled={!contextMenu.selectedRow}
          >
            <svg style={{ height: "16px", width: "16px", marginRight: "0.5rem", color: contextMenu.selectedRow ? "#6c757d" : "#adb5bd" }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
              <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" />
            </svg>
            Kopyala
          </button>
          <button
            style={{ ...styles.contextMenuItem, ...(contextMenu.selectedRow ? { color: "#dc3545" } : styles.contextMenuItemDisabled) }}
            onMouseEnter={(e) => contextMenu.selectedRow && (e.currentTarget.style.backgroundColor = styles.contextMenuItemHover.backgroundColor)}
            onMouseLeave={(e) => contextMenu.selectedRow && (e.currentTarget.style.backgroundColor = "white")}
            onClick={handleDeleteDocument}
            disabled={!contextMenu.selectedRow}
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
              <h2 style={styles.modalTitle}>{formData.id ? "Belge Düzenle" : "Yeni Belge"}</h2>
              <button style={styles.modalClose} onClick={() => setShowForm(false)}>
                <svg style={{ height: "24px", width: "24px" }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleFormSubmit} style={styles.form}>
              {[
                { name: "fgTuru", label: "Fg Türü", required: true },
                { name: "fgNumarasi", label: "Fg Numarası", required: true },
                { name: "fgTarihi", label: "Fg Tarihi", required: true },
                { name: "cariHesapKodu", label: "Cari Hesap Kodu", required: true },
                { name: "cariHesapAdi", label: "Cari Hesap Adı", required: true, span: true },
                { name: "belgeNumarasi", label: "Belge Numarası", required: true },
                { name: "girisDepoKodu", label: "Giriş Depo Kodu" },
                { name: "cikisDepoKodu", label: "Çıkış Depo Kodu" },
                { name: "fgToplam", label: "Fg Toplam", required: true }
              ].map((field) => (
                <div key={field.name} style={{ ...styles.inputGroup, ...(field.span ? { gridColumn: "1 / -1" } : {}) }}>
                  <label style={styles.label}>{field.label}</label>
                  <input
                    type="text"
                    name={field.name}
                    value={formData[field.name]}
                    onChange={handleFormChange}
                    style={styles.input}
                    required={field.required}
                  />
                </div>
              ))}
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