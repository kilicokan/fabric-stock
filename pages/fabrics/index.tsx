'use client';

import { useState, useEffect, CSSProperties } from "react";
import axios from "axios";
import ExportButtons from "../../components/ExportButtons";
import * as XLSX from "xlsx";

interface Fabric {
  id: number;
  code?: string;
  name: string;
  property?: string;
  width?: number;
  length?: number;
  depot?: string;
  unit?: string;
  stockQuantity: number;
  createdAt: string;
}

interface FabricForm {
  code: string;
  name: string;
  property: string;
  width: string;
  length: string;
  depot: string;
  unit: string;
  stockQuantity: string;
}

interface FabricListProps {
  fabrics: Fabric[];
  setFabrics: React.Dispatch<React.SetStateAction<Fabric[]>>;
}

interface FabricAddProps {
  fabrics: Fabric[];
  setFabrics: React.Dispatch<React.SetStateAction<Fabric[]>>;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
}

interface FabricEditProps {
  fabric: Fabric;
  onSave: (updatedFabric: Fabric) => void;
  onCancel: () => void;
}

// CSV parsing utility
function parseCSV(csvText: string): any[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const obj: any = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    return obj;
  });

  return rows;
}

// Ana Kumaşlar Bileşeni
export default function FabricsPage() {
  const [activeTab, setActiveTab] = useState("list"); // "list" veya "add"
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFabrics();
  }, []);

  const fetchFabrics = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/fabrics');
      setFabrics(response.data as Fabric[]);
    } catch (error) {
      console.error('Kumaşlar yüklenirken hata:', error);
      alert('Kumaşlar yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.mainTitle}>Kumaş Yönetimi</h2>

      {/* Sekmeler */}
      <div style={styles.tabContainer}>
        <button
          style={activeTab === "list" ? {...styles.tabButton, ...styles.activeTab} : styles.tabButton}
          onClick={() => setActiveTab("list")}
        >
          Kumaşlar
        </button>
        <button
          style={activeTab === "add" ? {...styles.tabButton, ...styles.activeTab} : styles.tabButton}
          onClick={() => setActiveTab("add")}
        >
          Kumaş Ekle
        </button>
      </div>

      {/* İçerik Alanı */}
      <div style={styles.content}>
        {activeTab === "list" ?
          <FabricList fabrics={fabrics} setFabrics={setFabrics} /> :
          <FabricAdd fabrics={fabrics} setFabrics={setFabrics} setActiveTab={setActiveTab} />
        }
      </div>
    </div>
  );
}

// Kumaş Listesi Bileşeni
function FabricList({ fabrics, setFabrics }: FabricListProps) {
  const [editingFabric, setEditingFabric] = useState<Fabric | null>(null);
  const [importing, setImporting] = useState(false);
  const [filters, setFilters] = useState({
    name: '',
    property: '',
    depot: '',
  });

  const handleEdit = (fabric: Fabric) => {
    setEditingFabric(fabric);
  };

  const handleUpdate = (updatedFabric: Fabric) => {
    setFabrics(fabrics.map((f: Fabric) => f.id === updatedFabric.id ? updatedFabric : f));
    setEditingFabric(null);
    alert("Kumaş başarıyla güncellendi!");
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Bu kumaşı silmek istediğinize emin misiniz?")) {
      setFabrics(fabrics.filter((f: Fabric) => f.id !== id));
      alert("Kumaş başarıyla silindi!");
    }
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      let parsedData: any[] = [];

      if (fileExtension === 'csv') {
        const text = await file.text();
        parsedData = parseCSV(text);
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        parsedData = XLSX.utils.sheet_to_json(worksheet);
      } else {
        alert('Sadece CSV ve Excel dosyaları desteklenir.');
        return;
      }

      if (parsedData.length === 0) {
        alert('Dosya boş veya geçersiz format.');
        return;
      }

      // Transform data to match API expectations
      const fabricsToImport = parsedData.map(row => ({
        code: row['Kod'] || row['code'] || row['Code'],
        name: row['Ad'] || row['name'] || row['Name'],
        property: row['Özellik'] || row['property'] || row['Property'],
        width: row['En'] || row['width'] || row['Width'],
        length: row['Boy'] || row['length'] || row['Length'],
        depot: row['Depo'] || row['depot'] || row['Depot'],
        unit: row['Birim'] || row['unit'] || row['Unit'],
        stockQuantity: row['Stok Miktarı'] || row['stockQuantity'] || row['StockQuantity']
      }));

      const response = await axios.post('/api/fabrics/import', { fabrics: fabricsToImport });

      if (response.data.success > 0) {
        alert(response.data.message);
        // Refresh the fabrics list
        window.location.reload();
      } else {
        alert(`İçe aktarma başarısız: ${response.data.importErrors.join(', ')}`);
      }

    } catch (error) {
      console.error('Import error:', error);
      alert('İçe aktarma sırasında hata oluştu.');
    } finally {
      setImporting(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const filteredFabrics = fabrics.filter(fabric => {
    const matchesName = filters.name === '' || fabric.name.toLowerCase().includes(filters.name.toLowerCase());
    const matchesProperty = filters.property === '' || (fabric.property && fabric.property.toLowerCase().includes(filters.property.toLowerCase()));
    const matchesDepot = filters.depot === '' || (fabric.depot && fabric.depot.toLowerCase().includes(filters.depot.toLowerCase()));
    return matchesName && matchesProperty && matchesDepot;
  });

  const exportData = filteredFabrics.map(fabric => ({
    'Kod': fabric.code || '',
    'Ad': fabric.name,
    'Özellik': fabric.property || '',
    'En': fabric.width || '',
    'Boy': fabric.length || '',
    'Depo': fabric.depot || '',
    'Birim': fabric.unit || '',
    'Stok Miktarı': fabric.stockQuantity,
    'Oluşturulma Tarihi': new Date(fabric.createdAt).toLocaleDateString('tr-TR')
  }));

  return (
    <div>
      {editingFabric ? (
        <FabricEdit
          fabric={editingFabric}
          onSave={handleUpdate}
          onCancel={() => setEditingFabric(null)}
        />
      ) : (
        <>
          {/* Filters */}
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Kumaş Adı"
              value={filters.name}
              onChange={(e) => setFilters({ ...filters, name: e.target.value })}
              style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', minWidth: '150px' }}
            />
            <input
              type="text"
              placeholder="Özellik"
              value={filters.property}
              onChange={(e) => setFilters({ ...filters, property: e.target.value })}
              style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', minWidth: '150px' }}
            />
            <input
              type="text"
              placeholder="Depo"
              value={filters.depot}
              onChange={(e) => setFilters({ ...filters, depot: e.target.value })}
              style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', minWidth: '150px' }}
            />
          </div>

          {/* Import/Export Buttons */}
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <label style={{...styles.scaleButton, backgroundColor: '#28a745', cursor: 'pointer'}}>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileImport}
                style={{ display: 'none' }}
                disabled={importing}
              />
              {importing ? 'İçe Aktarılıyor...' : 'Kumaş İçe Aktar'}
            </label>

            <ExportButtons
              data={exportData}
              filename="kumas-listesi"
              disabled={filteredFabrics.length === 0}
            />
          </div>

          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Kod</th>
                  <th style={styles.th}>Ad</th>
                  <th style={styles.th}>Özellik</th>
                  <th style={styles.th}>En</th>
                  <th style={styles.th}>Boy</th>
                  <th style={styles.th}>Depo</th>
                  <th style={styles.th}>Birim</th>
                  <th style={styles.th}>Stok Miktarı</th>
                  <th style={styles.th}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredFabrics.length > 0 ? (
                  filteredFabrics.map(fabric => (
                    <tr key={fabric.id}>
                      <td style={styles.td}>{fabric.code || '-'}</td>
                      <td style={styles.td}>{fabric.name}</td>
                      <td style={styles.td}>{fabric.property || '-'}</td>
                      <td style={styles.td}>{fabric.width || '-'}</td>
                      <td style={styles.td}>{fabric.length || '-'}</td>
                      <td style={styles.td}>{fabric.depot || '-'}</td>
                      <td style={styles.td}>{fabric.unit || '-'}</td>
                      <td style={styles.td}>{fabric.stockQuantity}</td>
                      <td style={styles.td}>
                        <button
                          style={{...styles.smallButton, marginRight: '0.5rem'}}
                          onClick={() => handleEdit(fabric)}
                        >
                          Düzenle
                        </button>
                        <button
                          style={{...styles.smallButton, backgroundColor: '#dc3545'}}
                          onClick={() => handleDelete(fabric.id)}
                        >
                          Sil
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} style={{...styles.td, textAlign: 'center'}}>
                      Filtrelemeye uygun kumaş bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{marginTop: '1rem', textAlign: 'center', color: '#6c757d'}}>
            Toplam {filteredFabrics.length} kumaş listeleniyor.
          </div>
        </>
      )}
    </div>
  );
}

// Kumaş Ekleme Bileşeni
function FabricAdd({ fabrics, setFabrics, setActiveTab }: FabricAddProps) {
  const [form, setForm] = useState<FabricForm>({
    code: "",
    name: "",
    property: "",
    width: "",
    length: "",
    depot: "",
    unit: "",
    stockQuantity: ""
  });

  const [isManualCode, setIsManualCode] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const response = await axios.post('/api/fabrics', {
        code: form.code,
        name: form.name,
        property: form.property,
        width: form.width ? parseFloat(form.width) : null,
        length: form.length ? parseFloat(form.length) : null,
        depot: form.depot,
        unit: form.unit,
        stockQuantity: parseFloat(form.stockQuantity) || 0
      });

      alert("Kumaş başarıyla eklendi!");
      setFabrics([...fabrics, response.data.fabric]);

      // Formu temizle
      setForm({
        code: "",
        name: "",
        property: "",
        width: "",
        length: "",
        depot: "",
        unit: "",
        stockQuantity: ""
      });
      setIsManualCode(false);

      // Listeleme sekmesine geç
      setActiveTab("list");
    } catch (error) {
      console.error('Kumaş eklenirken hata:', error);
      alert('Kumaş eklenirken hata oluştu');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const generateFabricCode = () => {
    const randomCode = "FAB-" + Math.floor(1000 + Math.random() * 9000);
    setForm(prev => ({ ...prev, code: randomCode }));
  };

  return (
    <div>
      <form onSubmit={handleSubmit} style={styles.form}>
        {/* Kumaş Kodu Alanı */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Kumaş Kodu</label>
          <div style={styles.inputWithButton}>
            <input
              type="text"
              name="code"
              value={form.code}
              onChange={handleChange}
              style={styles.textInput}
              placeholder="Kumaş kodunu giriniz"
              required
              disabled={!isManualCode}
            />
            {!isManualCode ? (
              <button
                type="button"
                style={styles.scaleButton}
                onClick={generateFabricCode}
              >
                Kod Oluştur
              </button>
            ) : null}
            <button
              type="button"
              style={styles.addButton}
              onClick={() => setIsManualCode(!isManualCode)}
              title={isManualCode ? "Otomatik koda geç" : "Manuel giriş yap"}
            >
              {isManualCode ? "A" : "M"}
            </button>
          </div>
        </div>

        {/* Kumaş Adı Alanı */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Kumaş Adı</label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            style={styles.input}
            placeholder="Kumaş adını giriniz"
            required
          />
        </div>

        {/* Özellik Alanı */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Özellik</label>
          <input
            type="text"
            name="property"
            value={form.property}
            onChange={handleChange}
            style={styles.input}
            placeholder="Kumaş özelliğini giriniz"
          />
        </div>

        {/* En ve Boy Alanları */}
        <div style={{display: 'flex', gap: '1rem'}}>
          <div style={{...styles.inputGroup, flex: 1}}>
            <label style={styles.label}>En (cm)</label>
            <input
              type="number"
              name="width"
              value={form.width}
              onChange={handleChange}
              style={styles.input}
              placeholder="En"
              step="0.01"
            />
          </div>
          <div style={{...styles.inputGroup, flex: 1}}>
            <label style={styles.label}>Boy (cm)</label>
            <input
              type="number"
              name="length"
              value={form.length}
              onChange={handleChange}
              style={styles.input}
              placeholder="Boy"
              step="0.01"
            />
          </div>
        </div>

        {/* Depo ve Birim Alanları */}
        <div style={{display: 'flex', gap: '1rem'}}>
          <div style={{...styles.inputGroup, flex: 1}}>
            <label style={styles.label}>Depo</label>
            <input
              type="text"
              name="depot"
              value={form.depot}
              onChange={handleChange}
              style={styles.input}
              placeholder="Depo bilgisi"
            />
          </div>
          <div style={{...styles.inputGroup, flex: 1}}>
            <label style={styles.label}>Birim</label>
            <input
              type="text"
              name="unit"
              value={form.unit}
              onChange={handleChange}
              style={styles.input}
              placeholder="Birim (m, kg, vb.)"
            />
          </div>
        </div>

        {/* Stok Miktarı Alanı */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Stok Miktarı</label>
          <input
            type="number"
            name="stockQuantity"
            value={form.stockQuantity}
            onChange={handleChange}
            style={styles.input}
            placeholder="Stok miktarı"
            step="0.01"
            required
          />
        </div>

        {/* Butonlar */}
        <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem'}}>
          <button
            type="button"
            style={{...styles.scaleButton, backgroundColor: '#6c757d'}}
            onClick={() => {
              setForm({
                code: "",
                name: "",
                property: "",
                width: "",
                length: "",
                depot: "",
                unit: "",
                stockQuantity: ""
              });
              setIsManualCode(false);
            }}
          >
            Formu Temizle
          </button>
          <button
            type="submit"
            style={styles.submitButton}
          >
            Kumaşı Kaydet
          </button>
        </div>
      </form>
    </div>
  );
}

// Kumaş Düzenleme Bileşeni
function FabricEdit({ fabric, onSave, onCancel }: FabricEditProps) {
  const [form, setForm] = useState<FabricForm>({
    code: fabric.code || "",
    name: fabric.name,
    property: fabric.property || "",
    width: fabric.width?.toString() || "",
    length: fabric.length?.toString() || "",
    depot: fabric.depot || "",
    unit: fabric.unit || "",
    stockQuantity: fabric.stockQuantity.toString()
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const updatedFabric: Fabric = {
      ...fabric,
      code: form.code,
      name: form.name,
      property: form.property,
      width: form.width ? parseFloat(form.width) : undefined,
      length: form.length ? parseFloat(form.length) : undefined,
      depot: form.depot,
      unit: form.unit,
      stockQuantity: parseFloat(form.stockQuantity)
    };
    onSave(updatedFabric);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div style={styles.editModal}>
      <div style={styles.editContent}>
        <h3 style={{marginTop: 0}}>Kumaşı Düzenle</h3>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Kumaş Kodu</label>
            <input
              type="text"
              name="code"
              value={form.code}
              onChange={handleChange}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Kumaş Adı</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Özellik</label>
            <input
              type="text"
              name="property"
              value={form.property}
              onChange={handleChange}
              style={styles.input}
            />
          </div>

          <div style={{display: 'flex', gap: '1rem'}}>
            <div style={{...styles.inputGroup, flex: 1}}>
              <label style={styles.label}>En (cm)</label>
              <input
                type="number"
                name="width"
                value={form.width}
                onChange={handleChange}
                style={styles.input}
                step="0.01"
              />
            </div>
            <div style={{...styles.inputGroup, flex: 1}}>
              <label style={styles.label}>Boy (cm)</label>
              <input
                type="number"
                name="length"
                value={form.length}
                onChange={handleChange}
                style={styles.input}
                step="0.01"
              />
            </div>
          </div>

          <div style={{display: 'flex', gap: '1rem'}}>
            <div style={{...styles.inputGroup, flex: 1}}>
              <label style={styles.label}>Depo</label>
              <input
                type="text"
                name="depot"
                value={form.depot}
                onChange={handleChange}
                style={styles.input}
              />
            </div>
            <div style={{...styles.inputGroup, flex: 1}}>
              <label style={styles.label}>Birim</label>
              <input
                type="text"
                name="unit"
                value={form.unit}
                onChange={handleChange}
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Stok Miktarı</label>
            <input
              type="number"
              name="stockQuantity"
              value={form.stockQuantity}
              onChange={handleChange}
              style={styles.input}
              step="0.01"
              required
            />
          </div>

          <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem'}}>
            <button
              type="button"
              style={{...styles.scaleButton, backgroundColor: '#6c757d'}}
              onClick={onCancel}
            >
              İptal
            </button>
            <button
              type="submit"
              style={styles.submitButton}
            >
              Güncelle
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Stiller
const styles: Record<string, CSSProperties> = {
  container: {
    maxWidth: "1200px",
    margin: "2rem auto",
    padding: "1.5rem",
    backgroundColor: "#fff",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
  },
  mainTitle: {
    textAlign: "center",
    color: "#2c3e50",
    marginBottom: "1.5rem",
    fontSize: "1.8rem"
  },
  tabContainer: {
    display: "flex",
    borderBottom: "2px solid #dee2e6",
    marginBottom: "1.5rem"
  },
  tabButton: {
    padding: "0.75rem 1.5rem",
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "1rem",
    fontWeight: "500",
    color: "#6c757d",
    transition: "all 0.3s"
  },
  activeTab: {
    color: "#007bff",
    borderBottom: "3px solid #007bff",
    marginBottom: "-2px"
  },
  content: {
    padding: "0 0.5rem"
  },
  tableContainer: {
    overflowX: "auto"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse"
  },
  th: {
    padding: "0.75rem",
    borderBottom: "2px solid #dee2e6",
    textAlign: "left",
    fontWeight: "600",
    color: "#2c3e50",
    backgroundColor: "#f8f9fa"
  },
  td: {
    padding: "0.75rem",
    borderBottom: "1px solid #dee2e6"
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1.2rem"
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
  inputWithButton: {
    display: "flex",
    gap: "0.5rem"
  },
  input: {
    padding: "0.75rem",
    border: "1px solid #ddd",
    borderRadius: "6px",
    fontSize: "1rem",
    outline: "none",
    transition: "border-color 0.3s",
  },
  textInput: {
    padding: "0.75rem",
    border: "1px solid #ddd",
    borderRadius: "6px",
    fontSize: "1rem",
    outline: "none",
    transition: "border-color 0.3s",
    flex: 1
  },
  addButton: {
    padding: "0.5rem 0.8rem",
    backgroundColor: "#6c757d",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "1.2rem",
    transition: "background-color 0.3s",
    width: "40px"
  },
  scaleButton: {
    padding: "0.75rem 1rem",
    backgroundColor: "#17a2b8",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "background-color 0.3s"
  },
  smallButton: {
    padding: "0.5rem 0.8rem",
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.9rem"
  },
  submitButton: {
    padding: "0.9rem 1.5rem",
    backgroundColor: "#28a745",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "1.1rem",
    fontWeight: "600",
    transition: "background-color 0.3s"
  },
  editModal: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000
  },
  editContent: {
    backgroundColor: "white",
    padding: "2rem",
    borderRadius: "8px",
    width: "90%",
    maxWidth: "600px",
    maxHeight: "90vh",
    overflowY: "auto"
  }
};
