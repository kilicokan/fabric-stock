import { useState, useEffect } from 'react';
import axios from 'axios';
import ExportButtons from '../../components/ExportButtons';
import * as XLSX from 'xlsx';

interface Color {
  id: number;
  code?: string;
  name: string;
  description?: string;
}

export default function ColorCardsPage() {
  const [colors, setColors] = useState<Color[]>([]);
  const [newColorName, setNewColorName] = useState<string>('');
  const [newColorCode, setNewColorCode] = useState<string>('');
  const [newColorDescription, setNewColorDescription] = useState<string>('');
  const [editingColor, setEditingColor] = useState<Color | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editCode, setEditCode] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Renkleri yükle
  useEffect(() => {
    fetchColors();
  }, []);

  const fetchColors = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/colors');
      setColors(response.data);
    } catch (err) {
      setError('Renkler yüklenemedi');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddColor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!newColorName.trim()) {
      setError('Renk adı girilmelidir.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await axios.post('/api/colors', {
        name: newColorName.trim(),
        code: newColorCode.trim() || undefined,
        description: newColorDescription.trim() || undefined
      });
      setNewColorName('');
      setNewColorCode('');
      setNewColorDescription('');
      fetchColors(); // Listeyi yenile
    } catch (err: any) {
      setError(err.response?.data?.error || 'Renk eklenemedi');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditColor = (color: Color) => {
    setEditingColor(color);
    setEditName(color.name);
    setEditCode(color.code || '');
    setEditDescription(color.description || '');
  };

  const handleUpdateColor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!editName.trim() || !editingColor) {
      setError('Renk adı girilmelidir.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await axios.put(`/api/colors/${editingColor.id}`, {
        name: editName.trim(),
        code: editCode.trim() || undefined,
        description: editDescription.trim() || undefined
      });
      setEditingColor(null);
      setEditName('');
      setEditCode('');
      setEditDescription('');
      fetchColors(); // Listeyi yenile
    } catch (err: any) {
      setError(err.response?.data?.error || 'Renk güncellenemedi');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteColor = async (colorId: number) => {
    if (!confirm('Bu rengi silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      await axios.delete(`/api/colors/${colorId}`);
      fetchColors(); // Listeyi yenile
    } catch (err: any) {
      setError(err.response?.data?.error || 'Renk silinemedi');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    setEditingColor(null);
    setEditName('');
    setEditCode('');
    setEditDescription('');
  };

  // Import function
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      let parsedData: any[] = [];

      if (fileExtension === 'csv') {
        const text = await file.text();
        parsedData = parseCSV(text);
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        parsedData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      } else {
        alert('Desteklenmeyen dosya formatı. Lütfen CSV veya Excel dosyası yükleyin.');
        return;
      }

      // Transform data to match API expectations
      const colorsToImport = parsedData.map(row => ({
        name: row['Renk Adı'] || row['name'] || row['Name'] || row['renk'] || row['Renk'],
        code: row['Renk Kodu'] || row['code'] || row['Code'] || row['kod'] || row['Kod'] || undefined,
        description: row['Açıklama'] || row['description'] || row['Description'] || row['aciklama'] || row['Aciklama'] || undefined
      }));

      const response = await axios.post('/api/colors/import', { colors: colorsToImport });
      alert(response.data.message);
      // Refresh the list
      fetchColors();
    } catch (error: any) {
      console.error('Import error:', error);
      alert('İçe aktarma sırasında hata oluştu: ' + (error.response?.data?.message || error.message));
    }
  };

  // Helper function to parse CSV with proper quote handling
  const parseCSV = (csvContent: string): any[] => {
    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]);
    const rows = lines.slice(1);

    return rows.map(row => {
      const values = parseCSVLine(row);
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      return obj;
    });
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}> Renk Kartları Yönetimi</h1>

      {error && <div style={styles.error}>{error}</div>}

      {/* Yeni renk ekleme formu */}
      <div style={styles.addForm}>
        <h2 style={styles.subtitle}>Yeni Renk Ekle</h2>
        <form onSubmit={handleAddColor} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Renk Kodu</label>
            <input
              type="text"
              value={newColorCode}
              onChange={(e) => setNewColorCode(e.target.value)}
              style={styles.input}
              placeholder="Örn: R001, M002"
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Renk Adı</label>
            <input
              type="text"
              value={newColorName}
              onChange={(e) => setNewColorName(e.target.value)}
              style={styles.input}
              placeholder="Örn: Kırmızı, Mavi, Yeşil"
              required
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Açıklama</label>
            <input
              type="text"
              value={newColorDescription}
              onChange={(e) => setNewColorDescription(e.target.value)}
              style={styles.input}
              placeholder="Örn: Parlak kırmızı renk"
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
      {editingColor && (
        <div style={styles.editForm}>
          <h2 style={styles.subtitle}>Renk Düzenle</h2>
          <form onSubmit={handleUpdateColor} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Renk Kodu</label>
              <input
                type="text"
                value={editCode}
                onChange={(e) => setEditCode(e.target.value)}
                style={styles.input}
                placeholder="Örn: R001, M002"
              />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Renk Adı</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={styles.input}
                required
              />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Açıklama</label>
              <input
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                style={styles.input}
                placeholder="Örn: Parlak kırmızı renk"
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

      {/* Import and Export buttons */}
      <div style={{ marginBottom: "1rem", display: "flex", gap: "1rem", alignItems: "center" }}>
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleImport}
          style={{ display: "none" }}
          id="import-file"
        />
        <label htmlFor="import-file">
          <button style={styles.importButton}>
            İçe Aktar
          </button>
        </label>
        <ExportButtons
          data={colors.map((color) => ({
            "Renk Kodu": color.code || '',
            "Renk Adı": color.name,
            "Açıklama": color.description || '',
          }))}
          filename="Renkler_Dokumu"
        />
      </div>

      {/* Mevcut renkler listesi */}
      <div style={styles.listSection}>
        <h2 style={styles.subtitle}>Mevcut Renkler</h2>
        {loading && colors.length === 0 ? (
          <div style={styles.loading}>Yükleniyor...</div>
        ) : colors.length === 0 ? (
          <div style={styles.noColors}>Henüz renk eklenmemiş.</div>
        ) : (
          <div style={styles.colorGrid}>
            {colors.map((color) => (
              <div key={color.id} style={styles.colorCard}>
                <div style={styles.colorInfo}>
                  <div style={styles.colorName}>{color.name}</div>
                  {color.code && <div style={styles.colorCode}>Kod: {color.code}</div>}
                  {color.description && <div style={styles.colorDescription}>{color.description}</div>}
                </div>
                <div style={styles.colorActions}>
                  <button
                    onClick={() => handleEditColor(color)}
                    style={styles.editButton}
                    title="Düzenle"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteColor(color.id)}
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
  noColors: {
    textAlign: 'center' as const,
    color: '#6c757d',
    padding: '2rem',
    fontSize: '1rem',
    fontStyle: 'italic'
  },
  colorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '1rem'
  },
  colorCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    backgroundColor: '#f8f9fa',
    border: '1px solid #eee',
    borderRadius: '6px',
    transition: 'background-color 0.2s'
  },
  colorInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem'
  },
  colorName: {
    fontWeight: '600',
    color: '#2c3e50',
    fontSize: '1rem'
  },
  colorCode: {
    fontSize: '0.85rem',
    color: '#6c757d'
  },
  colorDescription: {
    fontSize: '0.85rem',
    color: '#495057',
    fontStyle: 'italic'
  },
  colorActions: {
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
  },
  importButton: {
    padding: '0.75rem 2rem',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '600',
    transition: 'background-color 0.3s'
  }
};
