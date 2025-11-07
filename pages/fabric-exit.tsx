import { useState, useEffect } from 'react';
import type { CSSProperties } from "react";
import axios from 'axios';
import { useRouter } from 'next/router';

interface FabricExitFormData {
  modelNo: string;
  modelName: string; // Yeni alan: model adı
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
  fabricType: string;
}

interface Product {
  id: number;
  modelNo: string;
  name: string;
  materialTypeId?: number;
  fabricTypeId?: number;
  fabricType?: { id: number; name: string };
  groupId?: number;
  taxRateId?: number;
  description?: string;
  image?: string;
  createdAt: Date;
}

interface ExternalProduct {
  id: string;
  code: string;
  description: string;
}

interface CuttingTable {
  id: number;
  name: string;
}

interface LoadingState {
  products: boolean;
  external: boolean;
  submit: boolean;
  scale: boolean;
  cuttingTables: boolean;
}

export default function FabricExit() {
  const router = useRouter();

  const [formData, setFormData] = useState<FabricExitFormData>({
    modelNo: '',
    modelName: '', // Yeni alan
    orderNo: '',
    customerId: '',
    layerCount: 1,
    grammage: 0,
    externalProductId: '',
    productionKg: 0,
    productionMeters: 0,
    unitType: 'kg',
    cuttingTable: '',
    color: '',
    fabricType: ''
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [externalProducts, setExternalProducts] = useState<ExternalProduct[]>([]);
  const [cuttingTables, setCuttingTables] = useState<CuttingTable[]>([]);
  const [loading, setLoading] = useState<LoadingState>({
    products: false,
    external: false,
    submit: false,
    scale: false,
    cuttingTables: false
  });
  const [error, setError] = useState<string>('');
  const [manualModelNo, setManualModelNo] = useState<string>('');
  const [manualModelName, setManualModelName] = useState<string>(''); // Yeni state
  const [useManualModelNo, setUseManualModelNo] = useState<boolean>(false);

  // Ürün seçim modalı için yeni state'ler
  const [showProductModal, setShowProductModal] = useState<boolean>(false);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAutocomplete, setShowAutocomplete] = useState<boolean>(false);

  // Color and fabric type options from API
  const [colorOptions, setColorOptions] = useState<string[]>([]);
  const [fabricTypeOptions, setFabricTypeOptions] = useState<string[]>([]);

  // Color autocomplete states
  const [filteredColors, setFilteredColors] = useState<string[]>([]);
  const [showColorAutocomplete, setShowColorAutocomplete] = useState<boolean>(false);

  // Fabric type autocomplete states
  const [filteredFabricTypes, setFilteredFabricTypes] = useState<string[]>([]);
  const [showFabricTypeAutocomplete, setShowFabricTypeAutocomplete] = useState<boolean>(false);

  // Ürünleri yükle
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(prev => ({ ...prev, products: true }));
        const [productsRes, colorsRes, fabricsRes] = await Promise.all([
          axios.get<Product[]>('/api/products'),
          axios.get('/api/colors'),
          axios.get('/api/fabrics')
        ]);
        setProducts(productsRes.data);
        setColorOptions(colorsRes.data.map((c: any) => c.name));
        setFabricTypeOptions(fabricsRes.data.map((f: any) => f.name));
      } catch (err) {
        setError('Veriler yüklenemedi');
        console.error(err);
      } finally {
        setLoading(prev => ({ ...prev, products: false }));
      }
    };
    fetchData();
  }, []);

  // Model No değiştiğinde otomatik olarak fabric type'ı set et (manuel giriş için)
  useEffect(() => {
    if (useManualModelNo && formData.modelNo && products.length > 0) {
      const selectedProduct = products.find(p => p.modelNo === formData.modelNo);
      if (selectedProduct) {
        setFormData(prev => ({
          ...prev,
          fabricType: selectedProduct.fabricType?.name || '',
          modelName: selectedProduct.name || '' // Model adını da otomatik set et
        }));
        setManualModelName(selectedProduct.name || ''); // Manuel model adını da güncelle
      }
    }
  }, [formData.modelNo, useManualModelNo, products]);

  // Kesim masalarını yükle
  useEffect(() => {
    const fetchCuttingTables = async () => {
      try {
        setLoading(prev => ({ ...prev, cuttingTables: true }));
        const response = await axios.get('/api/cutting-tables');
        setCuttingTables(response.data.data);
      } catch (err) {
        setError('Kesim masaları yüklenemedi');
        console.error(err);
      } finally {
        setLoading(prev => ({ ...prev, cuttingTables: false }));
      }
    };
    fetchCuttingTables();
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

    // Model No değiştiğinde otomatik tamamlama
    if (name === 'modelNo' && !useManualModelNo) {
      handleModelNoChange(value);
    }

    // Color değiştiğinde otomatik tamamlama
    if (name === 'color') {
      handleColorChange(value);
    }
  };

  // Model No değişikliği için otomatik tamamlama
  const handleModelNoChange = (value: string) => {
    if (value.length > 0) {
      const filtered = products.filter(product =>
        product.modelNo.toLowerCase().includes(value.toLowerCase()) ||
        product.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredProducts(filtered.slice(0, 5)); // İlk 5 sonuç
      setShowAutocomplete(filtered.length > 0);
    } else {
      setShowAutocomplete(false);
    }
  };

  // Color değişikliği için otomatik tamamlama
  const handleColorChange = (value: string) => {
    if (value.length > 0) {
      const filtered = colorOptions.filter(color =>
        color.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredColors(filtered.slice(0, 5)); // İlk 5 sonuç
      setShowColorAutocomplete(filtered.length > 0);
    } else {
      setShowColorAutocomplete(false);
    }
  };

  // Fabric type değişikliği için otomatik tamamlama
  const handleFabricTypeChange = (value: string) => {
    if (value.length > 0) {
      const filtered = fabricTypeOptions.filter(type =>
        type.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredFabricTypes(filtered.slice(0, 5)); // İlk 5 sonuç
      setShowFabricTypeAutocomplete(filtered.length > 0);
    } else {
      setShowFabricTypeAutocomplete(false);
    }
  };

  // Ürün seçimi (autocomplete'den)
  const handleProductSelect = (product: Product) => {
    setFormData(prev => ({
      ...prev,
      modelNo: product.modelNo,
      modelName: product.name,
      fabricType: product.fabricType?.name || ''
    }));
    setShowAutocomplete(false);
  };

  // Color seçimi
  const handleColorSelect = (color: string) => {
    setFormData(prev => ({
      ...prev,
      color: color
    }));
    setShowColorAutocomplete(false);
  };

  // Fabric type seçimi
  const handleFabricTypeSelect = (fabricType: string) => {
    setFormData(prev => ({
      ...prev,
      fabricType: fabricType
    }));
    setShowFabricTypeAutocomplete(false);
  };

  // Ürün modalını açma
  const handleShowProductModal = () => {
    setShowProductModal(true);
    setFilteredProducts(products);
    setSearchQuery('');
  };

  // Modal'dan ürün seçimi
  const handleModalProductSelect = (product: Product) => {
    setFormData(prev => ({
      ...prev,
      modelNo: product.modelNo,
      modelName: product.name,
      fabricType: product.fabricType?.name || ''
    }));
    setShowProductModal(false);
  };

  // Modal arama
  const handleModalSearch = (query: string) => {
    setSearchQuery(query);
    if (query.length > 0) {
      const filtered = products.filter(product => 
        product.modelNo.toLowerCase().includes(query.toLowerCase()) ||
        product.name.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(products);
    }
  };

  const handleManualModelNoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setManualModelNo(value);
    setFormData(prev => ({ ...prev, modelNo: value }));
  };

  const handleManualModelNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setManualModelName(value);
    setFormData(prev => ({ ...prev, modelName: value }));
  };

  const toggleManualModelNo = () => {
    setUseManualModelNo(!useManualModelNo);
    if (!useManualModelNo) {
      setFormData(prev => ({ 
        ...prev, 
        modelNo: '',
        modelName: '',
        fabricType: '' 
      }));
      setManualModelNo('');
      setManualModelName('');
    }
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

    if (!formData.modelNo.trim()) {
      setError('Model No girilmelidir.');
      return;
    }
    if (!formData.modelName.trim()) {
      setError('Model Adı girilmelidir.');
      return;
    }
    if (!formData.orderNo.trim()) {
      setError('Sipariş No girilmelidir.');
      return;
    }
    if (!formData.customerId.trim()) {
      setError('Müşteri ID girilmelidir.');
      return;
    }
    if ((formData.unitType === 'kg' && formData.productionKg <= 0) || (formData.unitType === 'm' && formData.productionMeters <= 0)) {
      setError('Üretim miktarı girilmelidir.');
      return;
    }
    if (!formData.cuttingTable) {
      setError('Kesim masası seçilmelidir.');
      return;
    }
    if (!formData.color) {
      setError('Renk seçilmelidir.');
      return;
    }
    if (!formData.fabricType) {
      setError('Kumaş türü seçilmelidir.');
      return;
    }
    if (formData.externalProductId && !externalProducts.some(p => p.id === formData.externalProductId)) {
      setError('Geçerli bir dış sistem ürün ID seçilmelidir.');
      return;
    }

    try {
      setLoading(prev => ({ ...prev, submit: true }));
      setError('');
      console.log('Gönderilen formData:', formData);
      const response = await axios.post('/api/fabric-exit', {
        ...formData,
        createdAt: new Date().toISOString()
      });
      console.log('API yanıtı:', response.data);
      router.push('/success');
    } catch (err: any) {
      console.error('Gönderme hatası:', err.response || err.message || err);
      setError(err.response?.data?.error || 'Kayıt işlemi başarısız oldu. Lütfen verileri kontrol edin.');
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
            <div style={styles.modelNoHeader}>
              <label style={styles.label}>Model No</label>
              <button
                type="button"
                onClick={toggleManualModelNo}
                style={useManualModelNo ? styles.manualButtonActive : styles.manualButton}
              >
                {useManualModelNo ? '📝 Manuel' : '📋 Listeden Seç'}
              </button>
            </div>
            
            {useManualModelNo ? (
              <>
                <input
                  type="text"
                  value={manualModelNo}
                  onChange={handleManualModelNoChange}
                  style={styles.input}
                  placeholder="Model numarasını yazın..."
                  required
                />
                <input
                  type="text"
                  value={manualModelName}
                  onChange={handleManualModelNameChange}
                  style={styles.input}
                  placeholder="Model adını yazın..."
                  required
                />
              </>
            ) : (
              <div style={styles.inputWithAutocomplete}>
                <input
                  type="text"
                  name="modelNo"
                  value={formData.modelNo}
                  onChange={handleChange}
                  style={styles.input}
                  placeholder="Model numarası yazın veya listeden seçin..."
                  required
                />
                <button
                  type="button"
                  onClick={handleShowProductModal}
                  style={styles.listButton}
                  title="Ürün listesinden seç"
                >
                  📋
                </button>
                
                {/* Otomatik tamamlama dropdown */}
                {showAutocomplete && filteredProducts.length > 0 && (
                  <div style={styles.autocompleteDropdown}>
                    {filteredProducts.map(product => (
                      <div
                        key={product.id}
                        style={styles.autocompleteItem}
                        onClick={() => handleProductSelect(product)}
                      >
                        <div style={styles.autocompleteModelNo}>{product.modelNo}</div>
                        <div style={styles.autocompleteName}>{product.name}</div>
                        {product.fabricType && (
                          <div style={styles.autocompleteFabricType}>
                            Kumaş: {product.fabricType.name}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Model Adı</label>
            <input
              type="text"
              name="modelName"
              value={formData.modelName}
              onChange={handleChange}
              style={styles.input}
              placeholder="Model adı..."
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Kumaş Türü</label>
            <div style={styles.inputWithAutocomplete}>
              <input
                type="text"
                name="fabricType"
                value={formData.fabricType}
                onChange={(e) => {
                  handleChange(e);
                  handleFabricTypeChange(e.target.value);
                }}
                style={styles.input}
                placeholder="Kumaş türü yazın veya listeden seçin..."
                required
              />

              {/* Fabric type otomatik tamamlama dropdown */}
              {showFabricTypeAutocomplete && filteredFabricTypes.length > 0 && (
                <div style={styles.fabricTypeAutocompleteDropdown}>
                  {filteredFabricTypes.map(type => (
                    <div
                      key={type}
                      style={styles.autocompleteItem}
                      onClick={() => handleFabricTypeSelect(type)}
                    >
                      {type}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. Satır */}
        <div style={styles.row}>
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
        </div>

        {/* 3. Satır */}
        <div style={styles.row}>
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

          <div style={styles.inputGroup}>
            <label style={styles.label}>Kesim Masası</label>
            <select
              name="cuttingTable"
              value={formData.cuttingTable}
              onChange={handleChange}
              style={loading.cuttingTables ? {...styles.select, ...styles.disabled} : styles.select}
              required
              disabled={loading.cuttingTables}
            >
              <option value="">Seçiniz</option>
              {cuttingTables.map(table => (
                <option key={table.id} value={table.id.toString()}>
                  {table.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 4. Satır */}
        <div style={styles.row}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Renk</label>
            <div style={styles.inputWithAutocomplete}>
              <input
                type="text"
                name="color"
                value={formData.color}
                onChange={handleChange}
                style={styles.input}
                placeholder="Renk yazın veya listeden seçin..."
                required
              />

              {/* Color otomatik tamamlama dropdown */}
              {showColorAutocomplete && filteredColors.length > 0 && (
                <div style={styles.colorAutocompleteDropdown}>
                  {filteredColors.map(color => (
                    <div
                      key={color}
                      style={styles.autocompleteItem}
                      onClick={() => handleColorSelect(color)}
                    >
                      {color}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

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

      {/* Ürün Seçim Modalı */}
      {showProductModal && (
        <div style={styles.modalOverlay} onClick={() => setShowProductModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Ürün Seç</h2>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                style={styles.modalCloseButton}
              >
                ✕
              </button>
            </div>
            
            <div style={styles.modalSearch}>
              <input
                type="text"
                placeholder="Model No veya ürün adı ile ara..."
                value={searchQuery}
                onChange={(e) => handleModalSearch(e.target.value)}
                style={styles.modalSearchInput}
              />
            </div>
            
            <div style={styles.modalBody}>
              {filteredProducts.length > 0 ? (
                <div style={styles.productList}>
                  {filteredProducts.map(product => (
                    <div
                      key={product.id}
                      style={styles.productItem}
                      onClick={() => handleModalProductSelect(product)}
                    >
                      <div style={styles.productModelNo}>{product.modelNo}</div>
                      <div style={styles.productName}>{product.name}</div>
                      {product.fabricType && (
                        <div style={styles.productFabricType}>
                          Kumaş Türü: {product.fabricType.name}
                        </div>
                      )}
                      {product.description && (
                        <div style={styles.productDescription}>{product.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={styles.noResults}>Ürün bulunamadı</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '900px',
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
    marginBottom: '1.5rem',
    fontSize: '1.8rem'
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.5rem'
  },
  row: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap' as const,
    justifyContent: 'space-between'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
    flex: '1',
    minWidth: '200px'
  },
  modelNoHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  label: {
    fontWeight: '600',
    color: '#2c3e50',
    fontSize: '0.9rem'
  },
  manualButton: {
    padding: '0.3rem 0.6rem',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    transition: 'background-color 0.3s'
  },
  manualButtonActive: {
    padding: '0.3rem 0.6rem',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    transition: 'background-color 0.3s'
  },
  selectWithButton: {
    display: 'flex',
    gap: '0.5rem'
  },
  input: {
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.3s',
  },
  select: {
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '1rem',
    backgroundColor: 'white',
    outline: 'none',
    transition: 'border-color 0.3s',
    flex: 1
  },
  fetchButton: {
    padding: '0.75rem 1rem',
    backgroundColor: '#17a2b8',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    transition: 'background-color 0.3s'
  },
  fetchButtonLoading: {
    backgroundColor: '#6c757d',
    cursor: 'not-allowed'
  },
  submitButton: {
    padding: '0.9rem 2rem',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '1.1rem',
    fontWeight: '600',
    transition: 'background-color 0.3s'
  },
  submitButtonLoading: {
    backgroundColor: '#6c757d',
    cursor: 'not-allowed'
  },
  submitContainer: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '1rem'
  },
  error: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    padding: '0.75rem',
    borderRadius: '6px',
    marginBottom: '1.5rem',
    border: '1px solid #f5c6cb'
  },
  disabled: {
    backgroundColor: '#e9ecef',
    cursor: 'not-allowed'
  },
  unitGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem'
  },
  radioGroup: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '0.5rem'
  },
  inputWithButton: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center'
  },
  scaleButton: {
    padding: '0.75rem',
    backgroundColor: '#17a2b8',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '1rem',
    transition: 'background-color 0.3s'
  },
  scaleButtonLoading: {
    backgroundColor: '#6c757d',
    cursor: 'not-allowed'
  },
  
  // Yeni stiller
  inputWithAutocomplete: {
    position: 'relative' as const,
    display: 'flex',
    gap: '0.5rem'
  },
  listButton: {
    padding: '0.75rem',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '1rem',
    minWidth: '50px',
    transition: 'background-color 0.3s'
  },
  autocompleteDropdown: {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    right: '60px',
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    zIndex: 1000,
    maxHeight: '200px',
    overflowY: 'auto' as const
  },
  autocompleteItem: {
    padding: '0.75rem',
    cursor: 'pointer',
    borderBottom: '1px solid #f0f0f0',
    transition: 'background-color 0.2s'
  },
  autocompleteModelNo: {
    fontWeight: 'bold',
    color: '#2c3e50',
    fontSize: '0.9rem'
  },
  autocompleteName: {
    color: '#495057',
    fontSize: '0.9rem',
    marginTop: '0.25rem'
  },
  autocompleteFabricType: {
    color: '#28a745',
    fontSize: '0.8rem',
    marginTop: '0.25rem',
    fontStyle: 'italic'
  },
  
  // Modal stilleri
  modalOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '2rem'
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: '12px',
    maxWidth: '700px',
    width: '100%',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column' as const,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.5rem',
    borderBottom: '1px solid #eee'
  },
  modalTitle: {
    margin: 0,
    color: '#2c3e50',
    fontSize: '1.5rem'
  },
  modalCloseButton: {
    background: 'none',
    border: 'none',
    fontSize: '1.5rem',
    cursor: 'pointer',
    color: '#6c757d',
    padding: '0.5rem',
    borderRadius: '4px',
    transition: 'background-color 0.2s'
  },
  modalSearch: {
    padding: '1rem 1.5rem',
    borderBottom: '1px solid #eee'
  },
  modalSearchInput: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '1rem',
    outline: 'none'
  },
  modalBody: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '1.5rem'
  },
  productList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem'
  },
  productItem: {
    padding: '1rem',
    border: '1px solid #eee',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    backgroundColor: '#f8f9fa'
  },
  productModelNo: {
    fontWeight: 'bold',
    color: '#2c3e50',
    fontSize: '1rem'
  },
  productName: {
    color: '#495057',
    fontSize: '0.95rem',
    marginTop: '0.25rem'
  },
  productFabricType: {
    color: '#28a745',
    fontSize: '0.85rem',
    marginTop: '0.25rem',
    fontWeight: '500'
  },
  productDescription: {
    color: '#6c757d',
    fontSize: '0.8rem',
    marginTop: '0.25rem',
    fontStyle: 'italic'
  },
  noResults: {
    textAlign: 'center' as const,
    color: '#6c757d',
    padding: '2rem',
    fontSize: '1rem'
  },

  // Color autocomplete styles
  colorAutocompleteDropdown: {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    zIndex: 1000,
    maxHeight: '200px',
    overflowY: 'auto' as const
  },

  // Fabric type autocomplete styles
  fabricTypeAutocompleteDropdown: {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    zIndex: 1000,
    maxHeight: '200px',
    overflowY: 'auto' as const
  }
};