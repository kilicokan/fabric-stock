import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';

interface FabricExitFormData {
  modelNo: string;
  orderNo: string;
  customerId: string;
  layerCount: number;
  grammage: number;
  externalProductId: string;
  productionKg: number;
  productionMeters: number;
  unitType: 'kg' | 'm';
  cuttingTable: string;
  color: string;
}

interface Product {
  id: string;
  modelNo: string;
  name: string;
}

interface ExternalProduct {
  id: string;
  code: string;
  description: string;
}

interface LoadingState {
  products: boolean;
  external: boolean;
  submit: boolean;
  scale: boolean;
}

export default function FabricExit() {
  const router = useRouter();

  const [formData, setFormData] = useState<FabricExitFormData>({
    modelNo: '',
    orderNo: '',
    customerId: '',
    layerCount: 1,
    grammage: 0,
    externalProductId: '',
    productionKg: 0,
    productionMeters: 0,
    unitType: 'kg',
    cuttingTable: '',
    color: ''
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [externalProducts, setExternalProducts] = useState<ExternalProduct[]>([]);
  const [loading, setLoading] = useState<LoadingState>({
    products: false,
    external: false,
    submit: false,
    scale: false
  });
  const [error, setError] = useState<string>('');

  // Predefined color options
  const colorOptions = [
    'Beyaz', 'Siyah', 'Mavi', 'Kırmızı', 'Yeşil', 'Sarı', 'Gri', 'Mor'
  ];

  // Ürünleri yükle
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(prev => ({ ...prev, products: true }));
        const response = await axios.get<Product[]>('/api/products');
        setProducts(response.data);
      } catch (err) {
        setError('Sistem ürünleri yüklenemedi');
        console.error(err);
      } finally {
        setLoading(prev => ({ ...prev, products: false }));
      }
    };
    fetchProducts();
  }, []);

  const fetchExternalProducts = async () => {
    try {
      setLoading(prev => ({ ...prev, external: true }));
      setError('');
      const response = await axios.get<ExternalProduct[]>('/api/external-products');
      setExternalProducts(response.data);
    } catch (err) {
      setError('Dış sistem ürünleri alınamadı');
      console.error(err);
    } finally {
      setLoading(prev => ({ ...prev, external: false }));
    }
  };

  // Tartıdan veri alma
  const handleScaleData = async () => {
    if (formData.unitType !== 'kg') {
      alert('Kg birimi seçili olmalıdır.');
      return;
    }
    try {
      setLoading(prev => ({ ...prev, scale: true }));
      const { data } = await axios.get<{ weight: number }>('/api/scale');
      setFormData(prev => ({ ...prev, productionKg: data.weight }));
    } catch (err) {
      alert('Tartıdan veri alınamadı!');
      console.error(err);
    } finally {
      setLoading(prev => ({ ...prev, scale: false }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'layerCount' || name === 'grammage' || name === 'productionKg' || name === 'productionMeters' ? Number(value) : value
    }));
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value as 'kg' | 'm';
    setFormData(prev => ({
      ...prev,
      unitType: value,
      ...(value === 'kg' ? { productionMeters: 0 } : { productionKg: 0 })
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if ((formData.unitType === 'kg' && formData.productionKg <= 0) || (formData.unitType === 'm' && formData.productionMeters <= 0)) {
      setError('Üretim miktarı girilmelidir.');
      return;
    }
    if (!formData.cuttingTable.trim()) {
      setError('Kesim masası seçilmelidir.');
      return;
    }
    if (!formData.color) {
      setError('Renk seçilmelidir.');
      return;
    }
    try {
      setLoading(prev => ({ ...prev, submit: true }));
      setError('');
      await axios.post('/api/fabric-exits', formData);
      router.push('/success');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Kayıt işlemi başarısız oldu');
      console.error(err);
    } finally {
      setLoading(prev => ({ ...prev, submit: false }));
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>📤 Kumaş Çıkış Formu</h1>

      {error && <div style={styles.error}>{error}</div>}

      <form onSubmit={handleSubmit} style={styles.form}>
        {/* 1. Satır */}
        <div style={styles.row}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Model No (Sistem)</label>
            <select
              name="modelNo"
              value={formData.modelNo}
              onChange={handleChange}
              style={loading.products ? {...styles.select, ...styles.disabled} : styles.select}
              required
              disabled={loading.products}
            >
              <option value="">Seçiniz</option>
              {products.map(product => (
                <option key={product.id} value={product.modelNo}>
                  {product.modelNo} - {product.name}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Sipariş No</label>
            <input
              type="text"
              name="orderNo"
              value={formData.orderNo}
              onChange={handleChange}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Müşteri ID</label>
            <input
              type="text"
              name="customerId"
              value={formData.customerId}
              onChange={handleChange}
              style={styles.input}
              required
            />
          </div>
        </div>

        {/* 2. Satır */}
        <div style={styles.row}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Kat Sayısı</label>
            <input
              type="number"
              name="layerCount"
              value={formData.layerCount}
              onChange={handleChange}
              style={styles.input}
              min={1}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Gramaj (g/m²)</label>
            <input
              type="number"
              name="grammage"
              value={formData.grammage}
              onChange={handleChange}
              style={styles.input}
              step={0.01}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Model No (Dış Sistem)</label>
            <div style={styles.selectWithButton}>
              <select
                name="externalProductId"
                value={formData.externalProductId}
                onChange={handleChange}
                style={styles.select}
              >
                <option value="">Seçiniz</option>
                {externalProducts.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.description}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={fetchExternalProducts}
                style={loading.external ? {...styles.fetchButton, ...styles.fetchButtonLoading} : styles.fetchButton}
                disabled={loading.external}
              >
                {loading.external ? '...' : 'Getir'}
              </button>
            </div>
          </div>
        </div>

        {/* 3. Satır - Üretim Miktarı, Kesim Masası ve Renk */}
        <div style={styles.row}>
          <div style={{ ...styles.inputGroup, flex: 2 }}>
            <label style={styles.label}>Üretim Miktarı</label>
            <div style={styles.unitGroup}>
              <div style={styles.radioGroup}>
                <label>
                  <input
                    type="radio"
                    name="unitType"
                    value="kg"
                    checked={formData.unitType === 'kg'}
                    onChange={handleUnitChange}
                  />
                  Kg (Tartı)
                </label>
                <label>
                  <input
                    type="radio"
                    name="unitType"
                    value="m"
                    checked={formData.unitType === 'm'}
                    onChange={handleUnitChange}
                  />
                  Metre (Manuel)
                </label>
              </div>
              <div style={styles.inputWithButton}>
                {formData.unitType === 'kg' ? (
                  <>
                    <input
                      type="number"
                      name="productionKg"
                      value={formData.productionKg}
                      onChange={handleChange}
                      style={styles.input}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                    <button
                      type="button"
                      onClick={handleScaleData}
                      style={loading.scale ? {...styles.scaleButton, ...styles.scaleButtonLoading} : styles.scaleButton}
                      disabled={loading.scale}
                    >
                      {loading.scale ? '⏳' : '⚖️'}
                    </button>
                  </>
                ) : (
                  <input
                    type="number"
                    name="productionMeters"
                    value={formData.productionMeters}
                    onChange={handleChange}
                    style={styles.input}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                )}
              </div>
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Kesim Masası (örn: ahmet-mehmet MASA1)</label>
            <input
              type="text"
              name="cuttingTable"
              value={formData.cuttingTable}
              onChange={handleChange}
              style={styles.input}
              placeholder="ahmet-mehmet MASA1"
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Renk</label>
            <select
              name="color"
              value={formData.color}
              onChange={handleChange}
              style={styles.select}
              required
            >
              <option value="">Seçiniz</option>
              {colorOptions.map(color => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Kaydet */}
        <div style={styles.submitContainer}>
          <button
            type="submit"
            style={loading.submit ? {...styles.submitButton, ...styles.submitButtonLoading} : styles.submitButton}
            disabled={loading.submit}
          >
            {loading.submit ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>
    </div>
  );
}

// Modern tasarım için stiller (fabric-entry ile aynı)
const styles = {
  container: {
    maxWidth: "800px",
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
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1.5rem"
  },
  row: {
    display: "flex",
    gap: "1rem",
    flexWrap: "wrap" as const,
    justifyContent: "space-between"
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
    flex: "1",
    minWidth: "200px"
  },
  label: {
    fontWeight: "600",
    color: "#2c3e50",
    fontSize: "0.9rem"
  },
  selectWithButton: {
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
  select: {
    padding: "0.75rem",
    border: "1px solid #ddd",
    borderRadius: "6px",
    fontSize: "1rem",
    backgroundColor: "white",
    outline: "none",
    transition: "border-color 0.3s",
    flex: 1
  },
  fetchButton: {
    padding: "0.75rem 1rem",
    backgroundColor: "#17a2b8",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    transition: "background-color 0.3s"
  },
  fetchButtonLoading: {
    backgroundColor: "#6c757d",
    cursor: "not-allowed"
  },
  submitButton: {
    padding: "0.9rem 2rem",
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "1.1rem",
    fontWeight: "600",
    transition: "background-color 0.3s"
  },
  submitButtonLoading: {
    backgroundColor: "#6c757d",
    cursor: "not-allowed"
  },
  submitContainer: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "1rem"
  },
  error: {
    backgroundColor: "#f8d7da",
    color: "#721c24",
    padding: "0.75rem",
    borderRadius: "6px",
    marginBottom: "1.5rem",
    border: "1px solid #f5c6cb"
  },
  disabled: {
    backgroundColor: "#e9ecef",
    cursor: "not-allowed"
  },
  unitGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.75rem"
  },
  radioGroup: {
    display: "flex",
    gap: "1rem",
    marginBottom: "0.5rem"
  },
  inputWithButton: {
    display: "flex",
    gap: "0.5rem",
    alignItems: "center"
  },
  scaleButton: {
    padding: "0.75rem",
    backgroundColor: "#17a2b8",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "1rem",
    transition: "background-color 0.3s"
  },
  scaleButtonLoading: {
    backgroundColor: "#6c757d",
    cursor: "not-allowed"
  }
};