import { useState, useEffect } from 'react';
import axios from 'axios';

interface MaterialType {
  id: number;
  name: string;
}

type ApiErrorLike = {
  response?: {
    data?: {
      error?: string;
    };
  };
  message?: string;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as ApiErrorLike;
    const apiMessage = candidate.response?.data?.error;
    if (typeof apiMessage === 'string' && apiMessage.trim()) return apiMessage;
    if (typeof candidate.message === 'string' && candidate.message.trim()) return candidate.message;
  }
  return fallback;
};
export default function MaterialTypesPage() {
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [newMaterialTypeName, setNewMaterialTypeName] = useState<string>('');
  const [editingMaterialType, setEditingMaterialType] = useState<MaterialType | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Malzeme türlerini yükle
  useEffect(() => {
    fetchMaterialTypes();
  }, []);

  const fetchMaterialTypes = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/material-types');
      setMaterialTypes(response.data);
    } catch (err) {
      setError('Malzeme türleri yüklenemedi');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMaterialType = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!newMaterialTypeName.trim()) {
      setError('Malzeme türü adı girilmelidir.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await axios.post('/api/material-types', { name: newMaterialTypeName.trim() });
      setNewMaterialTypeName('');
      fetchMaterialTypes(); // Listeyi yenile
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Malzeme turu eklenemedi'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditMaterialType = (materialType: MaterialType) => {
    setEditingMaterialType(materialType);
    setEditName(materialType.name);
  };

  const handleUpdateMaterialType = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!editName.trim() || !editingMaterialType) {
      setError('Malzeme türü adı girilmelidir.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await axios.put(`/api/material-types/${editingMaterialType.id}`, { name: editName.trim() });
      setEditingMaterialType(null);
      setEditName('');
      fetchMaterialTypes(); // Listeyi yenile
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Malzeme turu eklenemedi'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMaterialType = async (materialTypeId: number) => {
    if (!confirm('Bu malzeme türünü silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      await axios.delete(`/api/material-types/${materialTypeId}`);
      fetchMaterialTypes(); // Listeyi yenile
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Malzeme turu eklenemedi'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    setEditingMaterialType(null);
    setEditName('');
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}> Malzeme Türü Yönetimi</h1>

      {error && <div style={styles.error}>{error}</div>}

      {/* Yeni malzeme türü ekleme formu */}
      <div style={styles.addForm}>
        <h2 style={styles.subtitle}>Yeni Malzeme Türü Ekle</h2>
        <form onSubmit={handleAddMaterialType} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Malzeme Türü Adı</label>
            <input
              type="text"
              value={newMaterialTypeName}
              onChange={(e) => setNewMaterialTypeName(e.target.value)}
              style={styles.input}
              placeholder="Örn: Kumaş, Deri, İplik"
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
      {editingMaterialType && (
        <div style={styles.editForm}>
          <h2 style={styles.subtitle}>Malzeme Türü Düzenle</h2>
          <form onSubmit={handleUpdateMaterialType} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Malzeme Türü Adı</label>
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

      {/* Mevcut malzeme türleri listesi */}
      <div style={styles.listSection}>
        <h2 style={styles.subtitle}>Mevcut Malzeme Türleri</h2>
        {loading && materialTypes.length === 0 ? (
          <div style={styles.loading}>Yükleniyor...</div>
        ) : materialTypes.length === 0 ? (
          <div style={styles.noMaterialTypes}>Henüz malzeme türü eklenmemiş.</div>
        ) : (
          <div style={styles.materialTypeGrid}>
            {materialTypes.map((materialType) => (
              <div key={materialType.id} style={styles.materialTypeCard}>
                <div style={styles.materialTypeName}>{materialType.name}</div>
                <div style={styles.materialTypeActions}>
                  <button
                    onClick={() => handleEditMaterialType(materialType)}
                    style={styles.editButton}
                    title="Düzenle"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteMaterialType(materialType.id)}
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

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    maxWidth: '100%',
    minHeight: '100vh',
    margin: '0',
    padding: '2rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '0',
    boxShadow: 'none',
    boxSizing: 'border-box',
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
    flexWrap: 'wrap' as const,
    width: '100%',
    maxWidth: '100%'
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
  noMaterialTypes: {
    textAlign: 'center' as const,
    color: '#6c757d',
    padding: '2rem',
    fontSize: '1rem',
    fontStyle: 'italic'
  },
  materialTypeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '1rem'
  },
  materialTypeCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    backgroundColor: '#f8f9fa',
    border: '1px solid #eee',
    borderRadius: '6px',
    transition: 'background-color 0.2s'
  },
  materialTypeName: {
    fontWeight: '600',
    color: '#2c3e50',
    fontSize: '1rem'
  },
  materialTypeActions: {
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
