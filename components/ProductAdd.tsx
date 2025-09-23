import { useState, useEffect } from 'react';
import axios from 'axios';

interface ProductFormData {
  modelNo: string;
  name: string;
  materialTypeId: string;
  groupId: string;
  taxRateId: string;
  description: string;
  image?: string;
}

interface DropdownItem {
  id: number;
  name: string;
}

export default function ProductAdd({ onProductAdded }: { onProductAdded?: () => void }) {
  const [formData, setFormData] = useState<ProductFormData>({
    modelNo: '',
    name: '',
    materialTypeId: '',
    groupId: '',
    taxRateId: '',
    description: '',
    image: '',
  });
  const [materialTypes, setMaterialTypes] = useState<DropdownItem[]>([]);
  const [groups, setGroups] = useState<DropdownItem[]>([]);
  const [taxRates, setTaxRates] = useState<DropdownItem[]>([]);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [newMaterial, setNewMaterial] = useState('');
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroup, setNewGroup] = useState('');
  const [showAddTaxRate, setShowAddTaxRate] = useState(false);
  const [newTaxRate, setNewTaxRate] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [imagePreview, setImagePreview] = useState<string>('');

  // Dropdown verilerini yükle
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const materialResponse = await axios.get<DropdownItem[]>('/api/settings/material-types');
        const groupResponse = await axios.get<DropdownItem[]>('/api/settings/groups');
        const taxRateResponse = await axios.get<DropdownItem[]>('/api/settings/tax-rates');
        setMaterialTypes(materialResponse.data || []);
        setGroups(groupResponse.data || []);
        setTaxRates(taxRateResponse.data || []);
      } catch (err) {
        console.error('Settings fetch error:', err);
        setErrorMessage('Ayarlar yüklenemedi, varsayılan değerler kullanılıyor.');
        setMaterialTypes([{ id: 1, name: 'Kumaş' }, { id: 2, name: 'Deri' }]);
        setGroups([{ id: 1, name: 'Dokuma Kumaş' }, { id: 2, name: 'Örme Kumaş' }]);
        setTaxRates([{ id: 1, name: '%0' }, { id: 2, name: '%1' }, { id: 3, name: '%8' }, { id: 4, name: '%20' }]);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  // Otomatik ürün kodu oluştur
  const generateProductCode = async () => {
    let newCode: string;
    let isUnique = false;
    try {
      setLoading(true);
      while (!isUnique) {
        const randomNum = Math.floor(1000 + Math.random() * 9000); // 1000-9999 arası rastgele sayı
        newCode = `PRD-${randomNum}`;
        const response = await axios.get(`/api/products/check-code?code=${newCode}`);
        if (response.data.isAvailable) {
          isUnique = true;
        }
      }
      setFormData((prev) => ({ ...prev, modelNo: newCode }));
      setErrorMessage('');
    } catch (err) {
      console.error('Code generation error:', err);
      setErrorMessage('Ürün kodu oluşturulamadı, lütfen manuel girin.');
    } finally {
      setLoading(false);
    }
  };

  // Form input değişiklikleri
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrorMessage('');
  };

  // Görsel yükleme
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setFormData((prev) => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Form submit
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formData.modelNo || !formData.name) {
      setErrorMessage('Ürün Kodu ve Ürün Adı zorunludur!');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        modelNo: formData.modelNo,
        name: formData.name,
        materialTypeId: formData.materialTypeId ? parseInt(formData.materialTypeId) : null,
        groupId: formData.groupId ? parseInt(formData.groupId) : null,
        taxRateId: formData.taxRateId ? parseInt(formData.taxRateId) : null,
        description: formData.description || null,
        image: formData.image || null,
      };
      console.log('Sending product payload:', payload);
      const response = await axios.post('/api/products', payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      console.log('Product add response:', response.data);
      alert('Ürün başarıyla eklendi!');
      setFormData({ modelNo: '', name: '', materialTypeId: '', groupId: '', taxRateId: '', description: '', image: '' });
      setImagePreview('');
      if (onProductAdded) onProductAdded();
      window.dispatchEvent(new Event('productAdded'));
    } catch (err: any) {
      console.error('Product add error:', err.response || err.message || err);
      const errorMsg = err.response?.data?.message || 'Ürün eklenirken hata oluştu!';
      setErrorMessage(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Yeni malzeme türü ekleme
  const handleAddMaterial = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newMaterial.trim()) {
      setErrorMessage('Yeni malzeme türü boş olamaz!');
      return;
    }
    try {
      setLoading(true);
      const response = await axios.post('/api/settings/material-types', { name: newMaterial });
      const newItem = response.data;
      setMaterialTypes((prev) => [...prev, newItem]);
      setFormData((prev) => ({ ...prev, materialTypeId: newItem.id.toString() }));
      setNewMaterial('');
      setShowAddMaterial(false);
    } catch (err: any) {
      console.error('Add material error:', err);
      setErrorMessage(err.response?.data?.message || 'Malzeme türü eklenemedi!');
    } finally {
      setLoading(false);
    }
  };

  // Yeni grup ekleme
  const handleAddGroup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newGroup.trim()) {
      setErrorMessage('Yeni grup boş olamaz!');
      return;
    }
    try {
      setLoading(true);
      const response = await axios.post('/api/settings/groups', { name: newGroup });
      const newItem = response.data;
      setGroups((prev) => [...prev, newItem]);
      setFormData((prev) => ({ ...prev, groupId: newItem.id.toString() }));
      setNewGroup('');
      setShowAddGroup(false);
    } catch (err: any) {
      console.error('Add group error:', err);
      setErrorMessage(err.response?.data?.message || 'Grup eklenemedi!');
    } finally {
      setLoading(false);
    }
  };

  // Yeni vergi oranı ekleme
  const handleAddTaxRate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newTaxRate.trim()) {
      setErrorMessage('Yeni vergi oranı boş olamaz!');
      return;
    }
    try {
      setLoading(true);
      const response = await axios.post('/api/settings/tax-rates', { name: newTaxRate });
      const newItem = response.data;
      setTaxRates((prev) => [...prev, newItem]);
      setFormData((prev) => ({ ...prev, taxRateId: newItem.id.toString() }));
      setNewTaxRate('');
      setShowAddTaxRate(false);
    } catch (err: any) {
      console.error('Add tax rate error:', err);
      setErrorMessage(err.response?.data?.message || 'Vergi oranı eklenemedi!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>📦 Ürün Ekle</h1>
      {errorMessage && (
        <div style={styles.error}>{errorMessage}</div>
      )}
      
      <form onSubmit={handleSubmit} style={styles.form}>
        {/* Ürün Kodu */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Ürün Kodu</label>
          <div style={styles.inputWithButton}>
            <input
              type="text"
              name="modelNo"
              value={formData.modelNo}
              onChange={handleChange}
              placeholder="Ürün kodu (örn. PRD-1001)"
              style={styles.input}
              required
            />
            <button
              type="button"
              onClick={generateProductCode}
              style={loading ? { ...styles.generateButton, ...styles.disabled } : styles.generateButton}
              disabled={loading}
            >
              Otomatik Oluştur
            </button>
          </div>
        </div>

        {/* Ürün Adı */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Ürün Adı</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Ürün adı"
            style={styles.input}
            required
          />
        </div>

        {/* Ürün Görseli */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Ürün Görseli (Opsiyonel)</label>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={styles.imagePreview}>
              {imagePreview ? (
                <img src={imagePreview} alt="Ürün önizleme" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ color: '#6c757d', fontSize: '0.8rem', textAlign: 'center' }}>
                  Görsel yok
                </span>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <input type="file" accept="image/*" onChange={handleImageChange} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
          </div>
        </div>

        {/* Malzeme Türü */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Malzeme Türü</label>
          <div style={styles.selectWithButton}>
            <select
              name="materialTypeId"
              value={formData.materialTypeId}
              onChange={handleChange}
              style={loading ? { ...styles.select, ...styles.disabled } : styles.select}
              disabled={loading}
            >
              <option value="">Seçiniz</option>
              {materialTypes.map((type) => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowAddMaterial((v) => !v)}
              style={styles.addButton}
              title="Yeni malzeme türü ekle"
              disabled={loading}
            >
              +
            </button>
          </div>
        </div>
        {showAddMaterial && (
          <form onSubmit={handleAddMaterial} style={styles.addForm}>
            <input
              type="text"
              value={newMaterial}
              onChange={(e) => setNewMaterial(e.target.value)}
              placeholder="Yeni malzeme türü"
              style={styles.textInput}
              required
            />
            <button type="submit" style={styles.smallButton}>Ekle</button>
          </form>
        )}

        {/* Grup No */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Grup No</label>
          <div style={styles.selectWithButton}>
            <select
              name="groupId"
              value={formData.groupId}
              onChange={handleChange}
              style={loading ? { ...styles.select, ...styles.disabled } : styles.select}
              disabled={loading}
            >
              <option value="">Seçiniz</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowAddGroup((v) => !v)}
              style={styles.addButton}
              title="Yeni grup ekle"
              disabled={loading}
            >
              +
            </button>
          </div>
        </div>
        {showAddGroup && (
          <form onSubmit={handleAddGroup} style={styles.addForm}>
            <input
              type="text"
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              placeholder="Yeni grup"
              style={styles.textInput}
              required
            />
            <button type="submit" style={styles.smallButton}>Ekle</button>
          </form>
        )}

        {/* KDV Vergi Oranı */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>KDV Vergi Oranı</label>
          <div style={styles.selectWithButton}>
            <select
              name="taxRateId"
              value={formData.taxRateId}
              onChange={handleChange}
              style={loading ? { ...styles.select, ...styles.disabled } : styles.select}
              disabled={loading}
            >
              <option value="">Seçiniz</option>
              {taxRates.map((rate) => (
                <option key={rate.id} value={rate.id}>{rate.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowAddTaxRate((v) => !v)}
              style={styles.addButton}
              title="Yeni vergi oranı ekle"
              disabled={loading}
            >
              +
            </button>
          </div>
        </div>
        {showAddTaxRate && (
          <form onSubmit={handleAddTaxRate} style={styles.addForm}>
            <input
              type="text"
              value={newTaxRate}
              onChange={(e) => setNewTaxRate(e.target.value)}
              placeholder="Yeni vergi oranı (örn. %10)"
              style={styles.textInput}
              required
            />
            <button type="submit" style={styles.smallButton}>Ekle</button>
          </form>
        )}

        {/* Açıklama */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Açıklama</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Ürün açıklaması"
            style={{ ...styles.input, minHeight: '100px', resize: 'vertical' }}
          />
        </div>

        <button type="submit" style={loading ? { ...styles.submitButton, ...styles.disabled } : styles.submitButton} disabled={loading}>
          {loading ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '500px',
    margin: '2rem auto',
    padding: '2rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  title: {
    textAlign: 'center' as const,
    color: '#2c3e50',
    marginBottom: '1.5rem',
    fontSize: '1.8rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.2rem',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  label: {
    fontWeight: '600',
    color: '#2c3e50',
    fontSize: '0.9rem',
  },
  inputWithButton: {
    display: 'flex',
    gap: '0.5rem',
  },
  selectWithButton: {
    display: 'flex',
    gap: '0.5rem',
  },
  select: {
    flex: 1,
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '1rem',
    backgroundColor: 'white',
    outline: 'none',
    transition: 'border-color 0.3s',
  },
  input: {
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.3s',
  },
  textInput: {
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.3s',
    flex: 1,
  },
  addButton: {
    padding: '0.5rem 0.8rem',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '1.2rem',
    transition: 'background-color 0.3s',
  },
  generateButton: {
    padding: '0.75rem 1rem',
    backgroundColor: '#17a2b8',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '600',
    whiteSpace: 'nowrap' as const,
  },
  smallButton: {
    padding: '0.75rem 1rem',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  submitButton: {
    padding: '0.9rem',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '1.1rem',
    fontWeight: '600',
    marginTop: '1rem',
    transition: 'background-color 0.3s',
  },
  addForm: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
    backgroundColor: '#e9ecef',
    padding: '0.8rem',
    borderRadius: '6px',
  },
  imagePreview: {
    width: '100px',
    height: '100px',
    border: '1px dashed #ddd',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  error: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    padding: '0.75rem',
    borderRadius: '6px',
    marginBottom: '1.5rem',
    border: '1px solid #f5c6cb',
    textAlign: 'center' as const,
  },
  disabled: {
    backgroundColor: '#6c757d',
    cursor: 'not-allowed',
  },
};