import { useState, useEffect } from 'react';
import type { CSSProperties } from "react";
import axios from 'axios';
import { useRouter } from 'next/router';

interface FabricExitFormData {
  modelNo: string;
  modelName: string; // Yeni alan: model adı
  orderNo: string;
  customerIds: string[]; // Birden fazla müşteri
  layerCount: number;
  grammage: number;
  externalProductId: string;
  productionKg: number;
  productionMeters: number;
  unitType: 'kg' | 'm';
  cuttingTable: string;
  colors: string[]; // Birden fazla renk
  fabricType: string;
  reportNumber: string; // Rapor numarası
  isAutoReportNumber: boolean; // Otomatik rapor numarası mı?
}

interface Product {
  id: number;
  modelNo: string;
  name: string;
  materialTypeId?: number;
  fabricId?: number;
  fabric?: { id: number; name: string };
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
    customerIds: [],
    layerCount: 1,
    grammage: 0,
    externalProductId: '',
    productionKg: 0,
    productionMeters: 0,
    unitType: 'kg',
    cuttingTable: '',
    colors: [],
    fabricType: '',
    reportNumber: '',
    isAutoReportNumber: true
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

  // Kesim emri verilerini tutmak için state
  const [cuttingOrderData, setCuttingOrderData] = useState<any>(null);

  // Ürün seçim modalı için yeni state'ler
  const [showProductModal, setShowProductModal] = useState<boolean>(false);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAutocomplete, setShowAutocomplete] = useState<boolean>(false);

  // Müşteri seçim modalı için yeni state'ler
  const [showCustomerModal, setShowCustomerModal] = useState<boolean>(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([]);
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [selectedCustomers, setSelectedCustomers] = useState<any[]>([]);

  // Color and fabric type options from API
  const [colorOptions, setColorOptions] = useState<string[]>([]);
  const [fabricTypeOptions, setFabricTypeOptions] = useState<string[]>([]);

  // Color autocomplete states
  const [filteredColors, setFilteredColors] = useState<string[]>([]);
  const [showColorAutocomplete, setShowColorAutocomplete] = useState<boolean>(false);

  // Multiple color selection states
  const [showColorModal, setShowColorModal] = useState<boolean>(false);
  const [colorSearchQuery, setColorSearchQuery] = useState<string>('');
  const [filteredColorOptions, setFilteredColorOptions] = useState<string[]>([]);

  // Fabric type autocomplete states
  const [filteredFabricTypes, setFilteredFabricTypes] = useState<string[]>([]);
  const [showFabricTypeAutocomplete, setShowFabricTypeAutocomplete] = useState<boolean>(false);

  // Ürünleri ve müşterileri yükle
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(prev => ({ ...prev, products: true }));
        const [productsRes, colorsRes, fabricsRes, customersRes] = await Promise.all([
          axios.get<Product[]>('/api/products'),
          axios.get('/api/colors'),
          axios.get('/api/fabrics'),
          axios.get('/api/customers')
        ]);
        setProducts(productsRes.data);
        setColorOptions(colorsRes.data.map((c: any) => c.name));
        setFabricTypeOptions(fabricsRes.data.map((f: any) => f.name));
        setCustomers(customersRes.data);
        setFilteredCustomers(customersRes.data);
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
          fabricType: selectedProduct.fabric?.name || '',
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

  // Kesim emri verilerini çekme
  const fetchCuttingOrderData = async (reportNumber: string) => {
    if (!reportNumber.trim()) {
      setCuttingOrderData(null);
      return;
    }

    try {
      const response = await axios.get(`/api/fabric-exits?reportNumber=${encodeURIComponent(reportNumber)}`);
      if (response.data && response.data.length > 0) {
        setCuttingOrderData(response.data[0]);
      } else {
        setCuttingOrderData(null);
      }
    } catch (error) {
      console.error('Kesim emri verisi alınırken hata:', error);
      setCuttingOrderData(null);
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

    // Rapor numarası değiştiğinde kesim emri verilerini çek
    if (name === 'reportNumber') {
      fetchCuttingOrderData(value);
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

  // Otomatik rapor numarası üretme
  const generateReportNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `RPT-${year}${month}${day}-${hours}${minutes}${seconds}`;
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
      fabricType: product.fabric?.name || ''
    }));
    setShowAutocomplete(false);
  };

  // Color seçimi (autocomplete için)
  const handleColorSelect = (color: string) => {
    setFormData(prev => ({
      ...prev,
      colors: [...prev.colors, color]
    }));
    setShowColorAutocomplete(false);
  };

  // Renk ekleme (modal'dan)
  const handleAddColor = (color: string) => {
    if (!formData.colors.includes(color)) {
      setFormData(prev => ({
        ...prev,
        colors: [...prev.colors, color]
      }));
    }
  };

  // Renk çıkarma
  const handleRemoveColor = (colorToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      colors: prev.colors.filter(color => color !== colorToRemove)
    }));
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
      fabricType: product.fabric?.name || ''
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

  // Müşteri modal arama
  const handleCustomerModalSearch = (query: string) => {
    setCustomerSearchQuery(query);
    if (query.length > 0) {
      const filtered = customers.filter(customer =>
        customer.name.toLowerCase().includes(query.toLowerCase()) ||
        (customer.phone && customer.phone.includes(query)) ||
        (customer.email && customer.email.toLowerCase().includes(query.toLowerCase()))
      );
      setFilteredCustomers(filtered);
    } else {
      setFilteredCustomers(customers);
    }
  };

  // Müşteri seçimi (modal'dan)
  const handleCustomerSelect = (customer: any) => {
    if (!selectedCustomers.some(c => c.id === customer.id)) {
      const newSelectedCustomers = [...selectedCustomers, customer];
      setSelectedCustomers(newSelectedCustomers);
      setFormData(prev => ({
        ...prev,
        customerIds: newSelectedCustomers.map(c => c.name)
      }));
    }
    setShowCustomerModal(false);
  };

  // Müşteri çıkarma
  const handleRemoveCustomer = (customerId: number) => {
    const newSelectedCustomers = selectedCustomers.filter(c => c.id !== customerId);
    setSelectedCustomers(newSelectedCustomers);
    setFormData(prev => ({
      ...prev,
      customerIds: newSelectedCustomers.map(c => c.name)
    }));
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
        fabricType: '',
        reportNumber: '',
        isAutoReportNumber: true
      }));
      setManualModelNo('');
      setManualModelName('');
    }
  };

  // Otomatik rapor numarası toggle
  const toggleAutoReportNumber = () => {
    const newIsAuto = !formData.isAutoReportNumber;
    setFormData(prev => ({
      ...prev,
      isAutoReportNumber: newIsAuto,
      reportNumber: newIsAuto ? generateReportNumber() : ''
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

    if (!formData.reportNumber.trim()) {
      setError('Rapor Numarası girilmelidir.');
      return;
    }
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
    if (formData.customerIds.length === 0) {
      setError('En az bir müşteri seçilmelidir.');
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
    if (formData.colors.length === 0) {
      setError('En az bir renk seçilmelidir.');
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

      // Eğer kesim emri verisi varsa, değişiklikleri kesim emirlerine de kaydet
      if (cuttingOrderData) {
        try {
          await axios.put(`/api/fabric-exits/${cuttingOrderData.id}`, {
            modelNo: formData.modelNo,
            modelName: formData.modelName,
            orderNo: formData.orderNo,
            customerId: formData.customerIds.join(', '),
            color: formData.colors.join(', '),
            fabricType: formData.fabricType,
            cuttingTable: formData.cuttingTable,
            layerCount: formData.layerCount,
            grammage: formData.grammage,
            unitType: formData.unitType,
            productWeightKg: formData.productionKg,
            productLengthMeter: formData.productionMeters,
            reportNumber: formData.reportNumber
          });
        } catch (updateError) {
          console.error('Kesim emri güncellenirken hata:', updateError);
          // Ana işlem başarılı olduğu için hata mesajı göstermiyoruz
        }
      }

      router.push('/success');
    } catch (err: any) {
      console.error('Gönderme hatası:', err.response || err.message || err);
      setError(err.response?.data?.error || 'Kayıt işlemi başarısız oldu. Lütfen verileri kontrol edin.');
    } finally {
      setLoading(prev => ({ ...prev, submit: false }));
    }
  };

  // Export fonksiyonları
  const exportToPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default as (doc: any, options: any) => void;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.text('Kumaş Çıkış Raporu', 14, 15);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Rapor Numarası: ${formData.reportNumber || 'Belirtilmemiş'}`, 14, 22);
    doc.text(`Oluşturulma Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, 28);

    const tableData = [
      ['Model No', formData.modelNo || '-'],
      ['Model Adı', formData.modelName || '-'],
      ['Sipariş No', formData.orderNo || '-'],
      ['Müşteriler', formData.customerIds.join(', ') || '-'],
      ['Kat Sayısı', formData.layerCount.toString()],
      ['Gramaj (g/m²)', formData.grammage.toString()],
      ['Kumaş Türü', formData.fabricType || '-'],
      ['Renkler', formData.colors.join(', ') || '-'],
      ['Kesim Masası', formData.cuttingTable || '-'],
      ['Üretim Miktarı', formData.unitType === 'kg' ? `${formData.productionKg} kg` : `${formData.productionMeters} m`],
      ['Birim Tipi', formData.unitType === 'kg' ? 'Kg' : 'Metre']
    ];

    autoTable(doc, {
      startY: 35,
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: [79, 70, 229] },
        1: { fillColor: [240, 240, 240] }
      }
    });

    doc.save(`kumas-cikis-raporu-${formData.reportNumber || 'yeni'}.pdf`);
  };

  const exportToExcel = async () => {
    const XLSX = await import('xlsx');
    const data = [{
      'Rapor Numarası': formData.reportNumber,
      'Model No': formData.modelNo,
      'Model Adı': formData.modelName,
      'Sipariş No': formData.orderNo,
      'Müşteriler': formData.customerIds.join(', '),
      'Kat Sayısı': formData.layerCount,
      'Gramaj': formData.grammage,
      'Kumaş Türü': formData.fabricType,
      'Renkler': formData.colors.join(', '),
      'Kesim Masası': formData.cuttingTable,
      'Üretim Miktarı': formData.unitType === 'kg' ? formData.productionKg : formData.productionMeters,
      'Birim': formData.unitType === 'kg' ? 'kg' : 'm',
      'Tarih': new Date().toISOString().split('T')[0]
    }];
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Kumaş Çıkış');
    XLSX.writeFile(workbook, `kumas-cikis-raporu-${formData.reportNumber || 'yeni'}.xlsx`);
  };

  const exportToCSV = () => {
    const headers = ['Rapor Numarası', 'Model No', 'Model Adı', 'Sipariş No', 'Müşteriler', 'Kat Sayısı', 'Gramaj', 'Kumaş Türü', 'Renkler', 'Kesim Masası', 'Üretim Miktarı', 'Birim', 'Tarih'];
    const values = [
      formData.reportNumber,
      formData.modelNo,
      formData.modelName,
      formData.orderNo,
      formData.customerIds.join('; '),
      formData.layerCount.toString(),
      formData.grammage.toString(),
      formData.fabricType,
      formData.colors.join('; '),
      formData.cuttingTable,
      (formData.unitType === 'kg' ? formData.productionKg : formData.productionMeters).toString(),
      formData.unitType === 'kg' ? 'kg' : 'm',
      new Date().toISOString().split('T')[0]
    ];
    const csvContent = [headers.join(','), values.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `kumas-cikis-raporu-${formData.reportNumber || 'yeni'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>📤 Kumaş Çıkış Formu</h1>
        <div style={styles.exportButtons}>
          <button
            type="button"
            onClick={exportToPDF}
            style={styles.exportButton}
            title="PDF'e Aktar"
          >
            📄 PDF
          </button>
          <button
            type="button"
            onClick={exportToExcel}
            style={styles.exportButton}
            title="Excel'e Aktar"
          >
            📊 Excel
          </button>
          <button
            type="button"
            onClick={exportToCSV}
            style={styles.exportButton}
            title="CSV'ye Aktar"
          >
            📋 CSV
          </button>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <form onSubmit={handleSubmit} style={styles.form}>
        {/* 1. Satır */}
        <div style={styles.row}>
          <div style={styles.inputGroup}>
            <div style={styles.reportNumberHeader}>
              <label style={styles.label}>Rapor Numarası</label>
              <button
                type="button"
                onClick={toggleAutoReportNumber}
                style={formData.isAutoReportNumber ? styles.autoButtonActive : styles.autoButton}
              >
                {formData.isAutoReportNumber ? '🔄 Otomatik' : '✏️ Manuel'}
              </button>
            </div>
            <input
              type="text"
              name="reportNumber"
              value={formData.reportNumber}
              onChange={handleChange}
              style={styles.input}
              placeholder={formData.isAutoReportNumber ? "Otomatik oluşturulacak..." : "Rapor numarasını girin..."}
              required
              readOnly={formData.isAutoReportNumber}
            />
          </div>

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
                        {product.fabric && (
                          <div style={styles.autocompleteFabricType}>
                            Kumaş: {product.fabric.name}
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
            <label style={styles.label}>Müşteriler</label>
            <div style={styles.customerSelection}>
              <div style={styles.selectedCustomers}>
                {selectedCustomers.map(customer => (
                  <div key={customer.id} style={styles.customerTag}>
                    <span>{customer.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomer(customer.id)}
                      style={styles.removeButton}
                      title="Müşteriyi kaldır"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowCustomerModal(true)}
                style={styles.addCustomerButton}
                title="Müşteri ekle"
              >
                ➕ Müşteri Ekle
              </button>
            </div>
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
            <label style={styles.label}>Renkler</label>
            <div style={styles.colorSelection}>
              <div style={styles.selectedColors}>
                {formData.colors.map(color => (
                  <div key={color} style={styles.colorTag}>
                    <span>{color}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveColor(color)}
                      style={styles.removeButton}
                      title="Rengi kaldır"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowColorModal(true);
                  setFilteredColorOptions(colorOptions);
                  setColorSearchQuery('');
                }}
                style={styles.addColorButton}
                title="Renk ekle"
              >
                ➕ Renk Ekle
              </button>
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
                      {product.fabric && (
                        <div style={styles.productFabricType}>
                          Kumaş Türü: {product.fabric.name}
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

      {/* Müşteri Seçim Modalı */}
      {showCustomerModal && (
        <div style={styles.modalOverlay} onClick={() => setShowCustomerModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Müşteri Seç</h2>
              <button
                type="button"
                onClick={() => setShowCustomerModal(false)}
                style={styles.modalCloseButton}
              >
                ✕
              </button>
            </div>

            <div style={styles.modalSearch}>
              <input
                type="text"
                placeholder="Müşteri adı, telefon veya e-posta ile ara..."
                value={customerSearchQuery}
                onChange={(e) => handleCustomerModalSearch(e.target.value)}
                style={styles.modalSearchInput}
              />
            </div>

            <div style={styles.modalBody}>
              {filteredCustomers.length > 0 ? (
                <div style={styles.customerList}>
                  {filteredCustomers.map(customer => (
                    <div
                      key={customer.id}
                      style={styles.customerItem}
                      onClick={() => handleCustomerSelect(customer)}
                    >
                      <div style={styles.customerName}>{customer.name}</div>
                      <div style={styles.customerDetails}>
                        {customer.phone || "-"} {customer.email ? `• ${customer.email}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={styles.noResults}>Müşteri bulunamadı</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Renk Seçim Modalı */}
      {showColorModal && (
        <div style={styles.modalOverlay} onClick={() => setShowColorModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Renk Seç</h2>
              <button
                type="button"
                onClick={() => setShowColorModal(false)}
                style={styles.modalCloseButton}
              >
                ✕
              </button>
            </div>

            <div style={styles.modalSearch}>
              <input
                type="text"
                placeholder="Renk ara..."
                value={colorSearchQuery}
                onChange={(e) => {
                  setColorSearchQuery(e.target.value);
                  if (e.target.value.length > 0) {
                    const filtered = colorOptions.filter(color =>
                      color.toLowerCase().includes(e.target.value.toLowerCase())
                    );
                    setFilteredColorOptions(filtered);
                  } else {
                    setFilteredColorOptions(colorOptions);
                  }
                }}
                style={styles.modalSearchInput}
              />
            </div>

            <div style={styles.modalBody}>
              {filteredColorOptions.length > 0 ? (
                <div style={styles.colorList}>
                  {filteredColorOptions.map(color => (
                    <div
                      key={color}
                      style={styles.colorItem}
                      onClick={() => {
                        handleAddColor(color);
                        setShowColorModal(false);
                      }}
                    >
                      {color}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={styles.noResults}>Renk bulunamadı</div>
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
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
    flexWrap: 'wrap' as const,
    gap: '1rem'
  },
  exportButtons: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap' as const
  },
  exportButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '600',
    transition: 'background-color 0.3s'
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
  reportNumberHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  autoButton: {
    padding: '0.3rem 0.6rem',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    transition: 'background-color 0.3s'
  },
  autoButtonActive: {
    padding: '0.3rem 0.6rem',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    transition: 'background-color 0.3s'
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
  },

  // Customer modal styles
  customerList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem'
  },
  customerItem: {
    padding: '1rem',
    border: '1px solid #eee',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    backgroundColor: '#f8f9fa'
  },
  customerName: {
    fontWeight: 'bold',
    color: '#2c3e50',
    fontSize: '1rem'
  },
  customerDetails: {
    color: '#6c757d',
    fontSize: '0.9rem',
    marginTop: '0.25rem'
  },

  // Customer selection styles
  customerSelection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem'
  },
  selectedCustomers: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.5rem',
    minHeight: '40px',
    padding: '0.5rem',
    border: '1px solid #ddd',
    borderRadius: '6px',
    backgroundColor: 'white'
  },
  customerTag: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.25rem 0.5rem',
    backgroundColor: '#e9ecef',
    borderRadius: '4px',
    fontSize: '0.9rem'
  },
  addCustomerButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    transition: 'background-color 0.3s'
  },

  // Color selection styles
  colorSelection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem'
  },
  selectedColors: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.5rem',
    minHeight: '40px',
    padding: '0.5rem',
    border: '1px solid #ddd',
    borderRadius: '6px',
    backgroundColor: 'white'
  },
  colorTag: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.25rem 0.5rem',
    backgroundColor: '#e9ecef',
    borderRadius: '4px',
    fontSize: '0.9rem'
  },
  addColorButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    transition: 'background-color 0.3s'
  },

  // Remove button
  removeButton: {
    background: 'none',
    border: 'none',
    color: '#dc3545',
    cursor: 'pointer',
    fontSize: '1.2rem',
    padding: '0',
    lineHeight: '1'
  },

  // Color modal styles
  colorList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem'
  },
  colorItem: {
    padding: '1rem',
    border: '1px solid #eee',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    backgroundColor: '#f8f9fa'
  }
};
