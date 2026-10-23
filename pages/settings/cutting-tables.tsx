import { useState, useEffect } from 'react';
import axios from 'axios';

interface CuttingTable {
  id: number;
  name: string;
  assignedUserId: number | null;
  assignedUser: { id: number; name: string | null; email: string } | null;
}

interface FasonTracker {
  id: number;
  name: string | null;
  email: string;
}

interface SpreadingMachine {
  id: number;
  code: string;
  name: string;
  layerSource: 'PLC' | 'MANUAL';
  cuttingTable: { name: string };
}

type ApiErrorLike = {
  response?: {
    data?: {
      error?: string;
      message?: string;
    };
  };
  message?: string;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as ApiErrorLike;
    const apiMessage = candidate.response?.data?.message || candidate.response?.data?.error;
    if (typeof apiMessage === 'string' && apiMessage.trim()) return apiMessage;
    if (typeof candidate.message === 'string' && candidate.message.trim()) return candidate.message;
  }
  return fallback;
};
export default function CuttingTablesPage() {
  const [cuttingTables, setCuttingTables] = useState<CuttingTable[]>([]);
  const [newTableName, setNewTableName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [machines, setMachines] = useState<SpreadingMachine[]>([]);
  const [machineForm, setMachineForm] = useState({
    code: '',
    name: '',
    cuttingTableId: '',
    layerSource: 'MANUAL' as 'PLC' | 'MANUAL',
  });
  const [fasonTrackers, setFasonTrackers] = useState<FasonTracker[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Record<number, string>>({});
  const [savingTableId, setSavingTableId] = useState<number | null>(null);
  const [savingMachineId, setSavingMachineId] = useState<number | null>(null);

  // Kesim masalarını yükle
  useEffect(() => {
    fetchCuttingTables();
    fetchMachines();
    fetchFasonTrackers();
  }, []);

  const fetchCuttingTables = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/cutting-tables');
      setCuttingTables(response.data.data);
      setSelectedUserIds(Object.fromEntries(
        response.data.data.map((table: CuttingTable) => [table.id, table.assignedUserId ? String(table.assignedUserId) : ''])
      ));
    } catch (err) {
      setError('Kesim masaları yüklenemedi');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFasonTrackers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/fason/users/fason-trackers', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const rawUsers = response.data?.data?.data ?? response.data?.data ?? [];
      setFasonTrackers(Array.isArray(rawUsers) ? rawUsers : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Kesim kullanıcıları yüklenemedi.'));
      console.error(err);
    }
  };

  const handleSaveTableUser = async (tableId: number) => {
    try {
      setSavingTableId(tableId);
      setError('');
      const token = localStorage.getItem('token');
      await axios.patch(
        `/api/cutting-tables/${tableId}`,
        { assignedUserId: selectedUserIds[tableId] ? Number(selectedUserIds[tableId]) : null },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      await fetchCuttingTables();
    } catch (err) {
      setError(getErrorMessage(err, 'Kesim masası kullanıcısı kaydedilemedi.'));
      console.error(err);
    } finally {
      setSavingTableId(null);
    }
  };

  const fetchMachines = async () => {
    try {
      const response = await axios.get('/api/spreading-machines');
      setMachines(response.data.data || []);
    } catch (err) {
      console.error(err);
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
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Kesim masasi eklenemedi'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMachine = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!machineForm.code.trim() || !machineForm.name.trim() || !machineForm.cuttingTableId) {
      setError('Makine kodu, adı ve kesim masası zorunludur.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      await axios.post('/api/spreading-machines', {
        ...machineForm,
        cuttingTableId: Number(machineForm.cuttingTableId),
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setMachineForm({ code: '', name: '', cuttingTableId: '', layerSource: 'MANUAL' });
      await fetchMachines();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Serim makinesi eklenemedi'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMachineSource = async (machineId: number, layerSource: 'PLC' | 'MANUAL') => {
    try {
      setSavingMachineId(machineId);
      setError('');
      const token = localStorage.getItem('token');
      await axios.patch(
        '/api/spreading-machines',
        { id: machineId, layerSource },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      await fetchMachines();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Makinenin kat kaynağı kaydedilemedi.'));
      console.error(err);
    } finally {
      setSavingMachineId(null);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}> Kesim Masaları Yönetimi</h1>

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
                <div style={styles.tableAssignment}>
                  <div>
                    <div style={styles.tableName}>{table.name}</div>
                    <div style={styles.tableId}>ID: {table.id}</div>
                  </div>
                  <select
                    aria-label={`${table.name} kullanıcısı`}
                    value={selectedUserIds[table.id] ?? ''}
                    onChange={(event) => setSelectedUserIds((current) => ({ ...current, [table.id]: event.target.value }))}
                    style={styles.input}
                  >
                    <option value="">Kullanıcı seçin</option>
                    {fasonTrackers.map((tracker) => (
                      <option key={tracker.id} value={tracker.id}>
                        {tracker.name || tracker.email}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    style={savingTableId === table.id ? { ...styles.submitButton, ...styles.submitButtonLoading } : styles.submitButton}
                    onClick={() => void handleSaveTableUser(table.id)}
                    disabled={savingTableId === table.id}
                  >
                    {savingTableId === table.id ? 'Kaydediliyor...' : 'Eşleştir'}
                  </button>
                </div>
              </div>

            ))}
          </div>
        )}
      </div>
      <div style={styles.addForm}>
        <h2 style={styles.subtitle}>Serim Makinesi Tanımla</h2>
        <form onSubmit={handleAddMachine} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Makine kodu</label>
            <input value={machineForm.code} onChange={e => setMachineForm({ ...machineForm, code: e.target.value })} style={styles.input} placeholder="MTK-01" />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Makine adı</label>
            <input value={machineForm.name} onChange={e => setMachineForm({ ...machineForm, name: e.target.value })} style={styles.input} placeholder="Serim Makinesi 01" />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Bağlı kesim masası</label>
            <select value={machineForm.cuttingTableId} onChange={e => setMachineForm({ ...machineForm, cuttingTableId: e.target.value })} style={styles.input}>
              <option value="">Masa seçin</option>
              {cuttingTables.map(table => <option key={table.id} value={table.id}>{table.name}</option>)}
            </select>
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Kat sayım kaynağı</label>
            <select
              value={machineForm.layerSource}
              onChange={e => setMachineForm({ ...machineForm, layerSource: e.target.value as 'PLC' | 'MANUAL' })}
              style={styles.input}
            >
              <option value="MANUAL">Manuel sayaç + tartı önerisi</option>
              <option value="PLC">PLC / Gateway</option>
            </select>
          </div>
          <button type="submit" style={styles.submitButton} disabled={loading}>Makine ekle</button>
        </form>
        <div style={styles.tableList}>
          {machines.map(machine => (
            <div key={machine.id} style={styles.tableItem}>
              <span style={styles.tableName}>{machine.code} · {machine.name}</span>
              <span style={styles.tableId}>{machine.cuttingTable.name}</span>
              <select
                aria-label={`${machine.name} kat sayım kaynağı`}
                value={machine.layerSource || 'MANUAL'}
                onChange={e => void handleSaveMachineSource(machine.id, e.target.value as 'PLC' | 'MANUAL')}
                disabled={savingMachineId === machine.id}
                style={styles.input}
              >
                <option value="MANUAL">Manuel sayaç + tartı önerisi</option>
                <option value="PLC">PLC / Gateway</option>
              </select>
            </div>
          ))}
        </div>
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
  tableAssignment: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    width: '100%',
    flexWrap: 'wrap' as const
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
