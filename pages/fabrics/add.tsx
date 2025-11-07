'use client';

import { useState, useEffect } from "react";
import axios from "axios";

export default function FabricEntry() {
  const [formData, setFormData] = useState({
    materialCode: "KUM.001.00000004",
    materialName: "RAŞEL KUMAS DESENLI",
    materialType: "Pamuk",
    materialGroup: "KUM.001",
    fabricProperty: "Desenli kumaş",
    color: "Mavi",
    unit: "metre",
    patternCode: "",
    category: "",
    model: "",
    warehouse: "İstanbul",
    shelfLife: "",
    barcode: "",
    season: "",
    gtip: "",
    taxRate: 10,
    supplierCode: "",
    productCode: "",
    isoDocumentNo: "",
    website: "",
    campaignGroup: "",
    priceGroup: ""
  });

  const [fabricTypes, setFabricTypes] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [showAddType, setShowAddType] = useState(false);
  const [newType, setNewType] = useState("");
  const [showAddColor, setShowAddColor] = useState(false);
  const [newColor, setNewColor] = useState("");
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);
  const [newWarehouse, setNewWarehouse] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  // Load types/colors/warehouses on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fabricTypesRes, colorsRes] = await Promise.all([
          axios.get('/api/fabric-types'),
          axios.get('/api/colors')
        ]);
        setFabricTypes(fabricTypesRes.data.map((t: any) => t.name));
        setColors(colorsRes.data.map((c: any) => c.name));
      } catch (error) {
        console.error('Error fetching data:', error);
        // Fallback to empty or default
        setFabricTypes([]);
        setColors([]);
      }
    };
    fetchData();
    setWarehouses(["İstanbul", "Ankara", "İzmir"]); // Keep hardcoded for now
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        name: formData.materialName,
        quantity: 0, // Default quantity
      };
      await axios.post("/api/fabrics", payload);
      alert("Kumaş başarıyla kaydedildi!");
      // Reset form except for predefined values
      setFormData({
        ...formData,
        patternCode: "",
        category: "",
        model: "",
        shelfLife: "",
        barcode: "",
        season: "",
        gtip: "",
        supplierCode: "",
        productCode: "",
        isoDocumentNo: "",
        website: "",
        campaignGroup: "",
        priceGroup: ""
      });
    } catch (err) {
      console.error(err);
      alert("Kayıt sırasında hata oluştu!");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add new fabric type
  const handleAddType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newType.trim()) return;
    try {
      await axios.post('/api/fabric-types', { name: newType });
      setFabricTypes((prev) => [...prev, newType]);
      setFormData((prev) => ({ ...prev, materialType: newType }));
      setNewType("");
      setShowAddType(false);
    } catch (error) {
      console.error('Error adding fabric type:', error);
      alert('Kumaş türü eklenemedi');
    }
  };

  // Add new color
  const handleAddColor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColor.trim()) return;
    try {
      await axios.post('/api/colors', { name: newColor });
      setColors((prev) => [...prev, newColor]);
      setFormData((prev) => ({ ...prev, color: newColor }));
      setNewColor("");
      setShowAddColor(false);
    } catch (error) {
      console.error('Error adding color:', error);
      alert('Renk eklenemedi');
    }
  };

  // Add new warehouse
  const handleAddWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWarehouse.trim()) return;
    setWarehouses((prev) => [...prev, newWarehouse]);
    setFormData((prev) => ({ ...prev, warehouse: newWarehouse }));
    setNewWarehouse("");
    setShowAddWarehouse(false);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>📥 Kumaş Tanımlama Sayfası</h1>
      <span style={styles.codeBadge}>Kodu: {formData.materialCode}</span>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.formSection}>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.row}>
            {/* Sol Sütun */}
            <div style={styles.column}>
              <h2 style={styles.sectionTitle}>Temel Bilgiler</h2>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Malzeme Kodu *</label>
                <input
                  type="text"
                  name="materialCode"
                  value={formData.materialCode}
                  onChange={handleChange}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Malzeme Adı *</label>
                <input
                  type="text"
                  name="materialName"
                  value={formData.materialName}
                  onChange={handleChange}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Malzeme Türü *</label>
                <div style={styles.selectWithButton}>
                  <select
                    name="materialType"
                    value={formData.materialType}
                    onChange={handleChange}
                    style={styles.select}
                    required
                  >
                    <option value="">Seçiniz</option>
                    {fabricTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddType((v) => !v)}
                    style={styles.addButton}
                    title="Yeni tür ekle"
                  >
                    +
                  </button>
                </div>
                {showAddType && (
                  <div style={styles.addForm}>
                    <input
                      type="text"
                      value={newType}
                      onChange={e => setNewType(e.target.value)}
                      placeholder="Yeni tür"
                      style={styles.textInput}
                      required
                    />
                    <button
                      type="button"
                      onClick={handleAddType}
                      style={styles.smallButton}
                    >
                      Ekle
                    </button>
                  </div>
                )}
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Malzeme Grubu *</label>
                <input
                  type="text"
                  name="materialGroup"
                  value={formData.materialGroup}
                  onChange={handleChange}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Kumaş Özelliği *</label>
                <textarea
                  name="fabricProperty"
                  value={formData.fabricProperty}
                  onChange={handleChange}
                  style={styles.textarea}
                  rows={2}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Birim</label>
                <select
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  style={styles.select}
                >
                  <option value="metre">Metre</option>
                  <option value="adet">Adet</option>
                  <option value="top">Top</option>
                  <option value="kg">Kilogram</option>
                </select>
              </div>
            </div>

            {/* Sağ Sütun */}
            <div style={styles.column}>
              <h2 style={styles.sectionTitle}>Renk ve Desen</h2>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Renk</label>
                <div style={styles.selectWithButton}>
                  <select
                    name="color"
                    value={formData.color}
                    onChange={handleChange}
                    style={styles.select}
                  >
                    <option value="">Renk seçiniz</option>
                    {colors.map((color) => (
                      <option key={color} value={color}>{color}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddColor((v) => !v)}
                    style={styles.addButton}
                    title="Yeni renk ekle"
                  >
                    +
                  </button>
                </div>
                {showAddColor && (
                  <div style={styles.addForm}>
                    <input
                      type="text"
                      value={newColor}
                      onChange={e => setNewColor(e.target.value)}
                      placeholder="Yeni renk"
                      style={styles.textInput}
                      required
                    />
                    <button
                      type="button"
                      onClick={handleAddColor}
                      style={styles.smallButton}
                    >
                      Ekle
                    </button>
                  </div>
                )}
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Desen Kodu</label>
                <input
                  type="text"
                  name="patternCode"
                  value={formData.patternCode}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Kategori</label>
                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Model</label>
                <input
                  type="text"
                  name="model"
                  value={formData.model}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>
            </div>
          </div>

          <div style={styles.row}>
            <div style={styles.column}>
              <h2 style={styles.sectionTitle}>Tedarikçi Bilgileri</h2>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Tedarikçi Kodu</label>
                <input
                  type="text"
                  name="supplierCode"
                  value={formData.supplierCode}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Ürün Kodu</label>
                <input
                  type="text"
                  name="productCode"
                  value={formData.productCode}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>ISO Doküman No</label>
                <input
                  type="text"
                  name="isoDocumentNo"
                  value={formData.isoDocumentNo}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.column}>
              <h2 style={styles.sectionTitle}>Depo ve Diğer Bilgiler</h2>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Depo</label>
                <div style={styles.selectWithButton}>
                  <select
                    name="warehouse"
                    value={formData.warehouse}
                    onChange={handleChange}
                    style={styles.select}
                  >
                    {warehouses.map((warehouse) => (
                      <option key={warehouse} value={warehouse}>{warehouse}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddWarehouse((v) => !v)}
                    style={styles.addButton}
                    title="Yeni depo ekle"
                  >
                    +
                  </button>
                </div>
                {showAddWarehouse && (
                  <div style={styles.addForm}>
                    <input
                      type="text"
                      value={newWarehouse}
                      onChange={e => setNewWarehouse(e.target.value)}
                      placeholder="Yeni depo"
                      style={styles.textInput}
                      required
                    />
                    <button
                      type="button"
                      onClick={handleAddWarehouse}
                      style={styles.smallButton}
                    >
                      Ekle
                    </button>
                  </div>
                )}
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Raf Ömrü (Gün)</label>
                <input
                  type="number"
                  name="shelfLife"
                  value={formData.shelfLife}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Barkod</label>
                <input
                  type="text"
                  name="barcode"
                  value={formData.barcode}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Web Sayfası</label>
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>
            </div>
          </div>

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Ek Bilgiler</h2>
            <div style={styles.grid}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Sezon</label>
                <input
                  type="text"
                  name="season"
                  value={formData.season}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>GTIP No</label>
                <input
                  type="text"
                  name="gtip"
                  value={formData.gtip}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>KDV Oranı</label>
                <div style={styles.inputWithSuffix}>
                  <input
                    type="number"
                    name="taxRate"
                    value={formData.taxRate}
                    onChange={handleChange}
                    style={styles.input}
                  />
                  <span style={styles.suffix}>%</span>
                </div>
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Kampanya Grubu</label>
                <input
                  type="text"
                  name="campaignGroup"
                  value={formData.campaignGroup}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Fiyat Grubu</label>
                <input
                  type="text"
                  name="priceGroup"
                  value={formData.priceGroup}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>
            </div>
          </div>

          <div style={styles.submitContainer}>
            <button type="reset" style={styles.resetButton}>Temizle</button>
            <button
              type="submit"
              style={isSubmitting ? {...styles.submitButton, ...styles.submitButtonLoading} : styles.submitButton}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '2rem auto',
    padding: '2rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
  },
  title: {
    textAlign: 'center' as const,
    color: '#2c3e50',
    marginBottom: '1rem',
    fontSize: '1.8rem'
  },
  codeBadge: {
    display: 'block',
    textAlign: 'center' as const,
    backgroundColor: '#e9ecef',
    color: '#495057',
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    marginBottom: '2rem',
    fontSize: '1rem',
    fontWeight: '600'
  },
  error: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    padding: '0.75rem',
    borderRadius: '6px',
    marginBottom: '1.5rem',
    border: '1px solid #f5c6cb'
  },
  formSection: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
  },
  form: {
    width: '100%'
  },
  row: {
    display: 'flex',
    gap: '2rem',
    marginBottom: '2rem',
    flexWrap: 'wrap' as const
  },
  column: {
    flex: 1,
    minWidth: '300px'
  },
  sectionTitle: {
    color: '#2c3e50',
    marginBottom: '1.5rem',
    fontSize: '1.4rem',
    borderBottom: '2px solid #3498db',
    paddingBottom: '0.5rem'
  },
  inputGroup: {
    marginBottom: '1.5rem'
  },
  label: {
    display: 'block',
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: '0.5rem',
    fontSize: '0.9rem'
  },
  input: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.3s',
    boxSizing: 'border-box' as const
  },
  textarea: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.3s',
    boxSizing: 'border-box' as const,
    resize: 'vertical' as const
  },
  select: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.3s',
    boxSizing: 'border-box' as const
  },
  selectWithButton: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'stretch'
  },
  addButton: {
    padding: '0.75rem',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '600',
    transition: 'background-color 0.3s',
    minWidth: '40px'
  },
  addForm: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '0.5rem',
    alignItems: 'center'
  },
  textInput: {
    flex: 1,
    padding: '0.5rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '0.9rem',
    outline: 'none'
  },
  smallButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '600',
    transition: 'background-color 0.3s'
  },
  section: {
    marginTop: '2rem',
    paddingTop: '2rem',
    borderTop: '1px solid #eee'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1rem'
  },
  inputWithSuffix: {
    display: 'flex',
    alignItems: 'center'
  },
  suffix: {
    marginLeft: '0.5rem',
    color: '#6c757d',
    fontWeight: '600'
  },
  submitContainer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '1rem',
    marginTop: '2rem',
    paddingTop: '2rem',
    borderTop: '1px solid #eee'
  },
  resetButton: {
    padding: '0.75rem 2rem',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '600',
    transition: 'background-color 0.3s'
  },
  submitButton: {
    padding: '0.75rem 2rem',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '600',
    transition: 'background-color 0.3s'
  },
  submitButtonLoading: {
    backgroundColor: '#6c757d',
    cursor: 'not-allowed'
  }
};
