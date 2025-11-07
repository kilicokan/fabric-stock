import { useState, useEffect } from 'react';
import axios from 'axios';

interface TaxRate {
  id: number;
  name: string;
}

export default function TaxRatesPage() {
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [newTaxRateName, setNewTaxRateName] = useState<string>('');
  const [editingTaxRate, setEditingTaxRate] = useState<TaxRate | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Vergi oranlarını yükle
  useEffect(() => {
    fetchTaxRates();
  }, []);

  const fetchTaxRates = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/tax-rates');
      setTaxRates(response.data);
    } catch (err) {
      setError('Vergi oranları yüklenemedi');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTaxRate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!newTaxRateName.trim()) {
      setError('Vergi oranı adı girilmelidir.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await axios.post('/api/tax-rates', { name: newTaxRateName.trim() });
      setNewTaxRateName('');
      fetchTaxRates(); // Listeyi yenile
    } catch (err: any) {
      setError(err.response?.data?.error || 'Vergi oranı eklenemedi');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditTaxRate = (taxRate: TaxRate) => {
    setEditingTaxRate(taxRate);
    setEditName(taxRate.name);
  };

  const handleUpdateTaxRate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!editName.trim() || !editingTaxRate) {
      setError('Vergi oranı adı girilmelidir.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await axios.put(`/api/tax-rates/${editingTaxRate.id}`, { name: editName.trim() });
      setEditingTaxRate(null);
      setEditName('');
      fetchTaxRates(); // Listeyi yenile
    } catch (err: any) {
      setError(err.response?.data?.error || 'Vergi oranı güncellenemedi');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTaxRate = async (taxRateId: number) => {
    if (!confirm('Bu vergi oranını silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      await axios.delete(`/api/tax-rates/${taxRateId}`);
      fetchTaxRates(); // Listeyi yenile
    } catch (err: any) {
      setError(err.response?.data?.error || 'Vergi oranı silinemedi');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    setEditingTaxRate(null);
    setEditName('');
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>💰 Vergi Oranları Yönetimi</h1>

      {error && <div style={styles.error}>{error}</div>}

      {/* Yeni vergi oranı ekleme formu */}
      <div style={styles.addForm}>
        <h2 style={styles.subtitle}>Yeni Vergi Oranı Ekle</h2>
        <form onSubmit={handleAddTaxRate} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Vergi Oranı Adı</label>
            <input
              type="text"
              value={newTaxRateName}
              onChange={(e) => setNewTaxRateName(e.target.value)}
              style={styles.input}
              placeholder="Örn: %0, %1, %8, %20"
              required
            />
          </div>
          <button
            type="submit"
            style={loading ? {...styles.submitButton, ...styles.submitButtonLoading} : styles.submitButton}
            disabled={loading}
          >
            {loading ? 'Ekleniyor...' : 'Ekle'}
          </button>
        </form>
      </div>

      {/* Düzenleme formu */}
      {editingTaxRate && (
        <div style={styles.editForm}>
          <h2 style={styles.subtitle}>Vergi Oranı Düzenle</h2>
          <form onSubmit={handleUpdateTaxRate} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Vergi Oranı Adı</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={styles.input}
                required
              />
            </div>
            <div style={styles.buttonGroup}>
              <button
                type="submit"
                style={loading ? {...styles.updateButton, ...styles.submitButtonLoading} : styles.updateButton}
                disabled={loading}
              >
                {loading ? 'Güncelleniyor...' : 'Güncelle'}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                style={styles.cancelButton}
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mevcut vergi oranları listesi */}
      <div style={styles.listSection}>
        <h2 style={styles.subtitle}>Mevcut Vergi Oranları</h2>
        {loading && taxRates.length === 0 ? (
          <div style={styles.loading}>Yükleniyor...</div>
        ) : taxRates.length === 0 ? (
          <div style={styles.noTaxRates}>Henüz vergi oranı eklenmemiş.</div>
        ) : (
          <div style={styles.taxRateGrid}>
            {taxRates.map((taxRate) => (
              <div key={taxRate.id} style={styles.taxRateCard}>
                <div style={styles.taxRateName}>{taxRate.name}</div>
                <div style={styles.taxRateActions}>
                  <button
                    onClick={() => handleEditTaxRate(taxRate)}
                    style={styles.editButton}
                    title="Düzenle"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteTaxRate(taxRate.id)}
                    style={styles.deleteButton}
                    title="Sil"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1000px',
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
    marginBottom: '2rem',
    fontSize: '1.8rem'
  },
  subtitle: {
    color: '#2c3e50',
    marginBottom: '1rem',
    fontSize: '1.4rem',
    borderBottom: '2px solid #3498db',
    paddingBottom: '0.5rem'
  },
  error: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    padding: '0.75rem',
    borderRadius: '6px',
    marginBottom: '1.5rem',
    border: '1px solid #f5c6cb'
  },
  addForm: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '8px',
    marginBottom: '2rem',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
  },
  editForm: {
    backgroundColor: '#fff3cd',
    padding: '1.5rem',
    borderRadius: '8px',
    marginBottom: '2rem',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    border: '1px solid #ffeaa7'
  },
  form: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'flex-end',
    flexWrap: 'wrap' as const
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
    flex: 1,
    minWidth: '200px'
  },
  label: {
    fontWeight: '600',
    color: '#2c3e50',
    fontSize: '0.9rem'
  },
  input: {
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.3s'
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
  updateButton: {
    padding: '0.75rem 2rem',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '600',
    transition: 'background-color 0.3s'
  },
  cancelButton: {
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
  submitButtonLoading: {
    backgroundColor: '#6c757d',
    cursor: 'not-allowed'
  },
  buttonGroup: {
    display: 'flex',
    gap: '0.5rem'
  },
  listSection: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
  },
  loading: {
    textAlign: 'center' as const,
    color: '#6c757d',
    padding: '2rem',
    fontSize: '1rem'
  },
  noTaxRates: {
    textAlign: 'center' as const,
    color: '#6c757d',
    padding: '2rem',
    fontSize: '1rem',
    fontStyle: 'italic'
  },
  taxRateGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '1rem'
  },
  taxRateCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    backgroundColor: '#f8f9fa',
    border: '1px solid #eee',
    borderRadius: '6px',
    transition: 'background-color 0.2s'
  },
  taxRateName: {
    fontWeight: '600',
    color: '#2c3e50',
    fontSize: '1rem'
  },
  taxRateActions: {
    display: 'flex',
    gap: '0.5rem'
  },
  editButton: {
    padding: '0.5rem',
    backgroundColor: '#ffc107',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
    transition: 'background-color 0.2s'
  },
  deleteButton: {
    padding: '0.5rem',
    backgroundColor: '#dc3545',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
    transition: 'background-color 0.2s'
  }
};
