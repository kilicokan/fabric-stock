import { useState, useEffect } from 'react';
import axios from 'axios';

interface Group {
  id: number;
  name: string;
}

export default function GroupCardsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Grupları yükle
  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/groups');
      setGroups(response.data);
    } catch (err) {
      setError('Gruplar yüklenemedi');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddGroup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!newGroupName.trim()) {
      setError('Grup adı girilmelidir.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await axios.post('/api/groups', { name: newGroupName.trim() });
      setNewGroupName('');
      fetchGroups(); // Listeyi yenile
    } catch (err: any) {
      setError(err.response?.data?.error || 'Grup eklenemedi');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditGroup = (group: Group) => {
    setEditingGroup(group);
    setEditName(group.name);
  };

  const handleUpdateGroup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!editName.trim() || !editingGroup) {
      setError('Grup adı girilmelidir.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await axios.put(`/api/groups/${editingGroup.id}`, { name: editName.trim() });
      setEditingGroup(null);
      setEditName('');
      fetchGroups(); // Listeyi yenile
    } catch (err: any) {
      setError(err.response?.data?.error || 'Grup güncellenemedi');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm('Bu grubu silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      await axios.delete(`/api/groups/${groupId}`);
      fetchGroups(); // Listeyi yenile
    } catch (err: any) {
      setError(err.response?.data?.error || 'Grup silinemedi');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    setEditingGroup(null);
    setEditName('');
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>🏷️ Grup Kartları Yönetimi</h1>

      {error && <div style={styles.error}>{error}</div>}

      {/* Yeni grup ekleme formu */}
      <div style={styles.addForm}>
        <h2 style={styles.subtitle}>Yeni Grup Ekle</h2>
        <form onSubmit={handleAddGroup} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Grup Adı</label>
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              style={styles.input}
              placeholder="Örn: Dokuma Kumaş, Örme Kumaş"
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
      {editingGroup && (
        <div style={styles.editForm}>
          <h2 style={styles.subtitle}>Grup Düzenle</h2>
          <form onSubmit={handleUpdateGroup} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Grup Adı</label>
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

      {/* Mevcut gruplar listesi */}
      <div style={styles.listSection}>
        <h2 style={styles.subtitle}>Mevcut Gruplar</h2>
        {loading && groups.length === 0 ? (
          <div style={styles.loading}>Yükleniyor...</div>
        ) : groups.length === 0 ? (
          <div style={styles.noGroups}>Henüz grup eklenmemiş.</div>
        ) : (
          <div style={styles.groupGrid}>
            {groups.map((group) => (
              <div key={group.id} style={styles.groupCard}>
                <div style={styles.groupName}>{group.name}</div>
                <div style={styles.groupActions}>
                  <button
                    onClick={() => handleEditGroup(group)}
                    style={styles.editButton}
                    title="Düzenle"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteGroup(group.id)}
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
  noGroups: {
    textAlign: 'center' as const,
    color: '#6c757d',
    padding: '2rem',
    fontSize: '1rem',
    fontStyle: 'italic'
  },
  groupGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '1rem'
  },
  groupCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    backgroundColor: '#f8f9fa',
    border: '1px solid #eee',
    borderRadius: '6px',
    transition: 'background-color 0.2s'
  },
  groupName: {
    fontWeight: '600',
    color: '#2c3e50',
    fontSize: '1rem'
  },
  groupActions: {
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
