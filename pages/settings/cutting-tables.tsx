import { useState, useEffect } from 'react';
import axios from 'axios';

interface CuttingTable {
  id: number;
  name: string;
}

export default function CuttingTablesPage() {
  const [cuttingTables, setCuttingTables] = useState<CuttingTable[]>([]);
  const [newTableName, setNewTableName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Kesim masalarını yükle
  useEffect(() => {
    fetchCuttingTables();
  }, []);

  const fetchCuttingTables = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/cutting-tables');
      setCuttingTables(response.data.data);
    } catch (err) {
      setError('Kesim masaları yüklenemedi');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTable = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!newTableName.trim()) {
      setError('Kesim masası adı girilmelidir.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await axios.post('/api/cutting-tables', { name: newTableName.trim() });
      setNewTableName('');
      fetchCuttingTables(); // Listeyi yenile
    } catch (err: any) {
      setError(err.response?.data?.error || 'Kesim masası eklenemedi');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>🔪 Kesim Masaları Yönetimi</h1>

      {error && <div style={styles.error}>{error}</div>}

      {/* Yeni kesim masası ekleme formu */}
      <div style={styles.addForm}>
        <h2 style={styles.subtitle}>Yeni Kesim Masası Ekle</h2>
        <form onSubmit={handleAddTable} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Kesim Masası Adı</label>
            <input
              type="text"
              value={newTableName}
              onChange={(e) => setNewTableName(e.target.value)}
              style={styles.input}
              placeholder="Örn: Masa 1, Ana Kesim Masası"
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

      {/* Mevcut kesim masaları listesi */}
      <div style={styles.listSection}>
        <h2 style={styles.subtitle}>Mevcut Kesim Masaları</h2>
        {loading && cuttingTables.length === 0 ? (
          <div style={styles.loading}>Yükleniyor...</div>
        ) : cuttingTables.length === 0 ? (
          <div style={styles.noTables}>Henüz kesim masası eklenmemiş.</div>
        ) : (
          <div style={styles.tableList}>
            {cuttingTables.map((table) => (
              <div key={table.id} style={styles.tableItem}>
                <span style={styles.tableName}>{table.name}</span>
                <span style={styles.tableId}>ID: {table.id}</span>
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
    maxWidth: '800px',
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
  submitButtonLoading: {
    backgroundColor: '#6c757d',
    cursor: 'not-allowed'
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
  noTables: {
    textAlign: 'center' as const,
    color: '#6c757d',
    padding: '2rem',
    fontSize: '1rem',
    fontStyle: 'italic'
  },
  tableList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem'
  },
  tableItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    backgroundColor: '#f8f9fa',
    border: '1px solid #eee',
    borderRadius: '6px',
    transition: 'background-color 0.2s'
  },
  tableName: {
    fontWeight: '600',
    color: '#2c3e50',
    fontSize: '1rem'
  },
  tableId: {
    color: '#6c757d',
    fontSize: '0.8rem'
  }
};
