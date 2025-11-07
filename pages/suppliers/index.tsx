import { useState, useEffect } from "react";
import axios from "axios";
import ExportButtons from '../../components/ExportButtons';
import * as XLSX from 'xlsx';

export default function SupplierAddPage() {
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState({ submit: false, list: false });
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [importing, setImporting] = useState(false);

  // Import function
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
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

      const response = await axios.post('/api/suppliers/import', { suppliers: parsedData });
      alert(response.data.message);
      // Refresh the list
      load();
    } catch (error: any) {
      console.error('Import error:', error);
      alert('İçe aktarma sırasında hata oluştu: ' + (error.response?.data?.message || error.message));
    } finally {
      setImporting(false);
      // Reset file input
      event.target.value = '';
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

  const load = async () => {
    try {
      setLoading((s) => ({ ...s, list: true }));
      const { data } = await axios.get("/api/suppliers");
      setList(data);
    } catch (e) {
      setError("Tedarikçi listesi yüklenemedi");
    } finally {
      setLoading((s) => ({ ...s, list: false }));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError("");
      setSuccess("");
      setLoading((s) => ({ ...s, submit: true }));
      await axios.post("/api/suppliers", form);
      setForm({ name: "", phone: "", email: "" });
      setSuccess("Tedarikçi başarıyla eklendi!");
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Kayıt başarısız");
    } finally {
      setLoading((s) => ({ ...s, submit: false }));
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  return (
    <div className="container">
      <h1 className="title">🏭 Tedarikçi Ekle</h1>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <form onSubmit={submit} className="form">
        <div className="input-group">
          <label className="label">Tedarikçi Adı *</label>
          <input
            name="name"
            value={form.name}
            onChange={onChange}
            placeholder="Tedarikçi adı"
            className="input"
            required
          />
        </div>

        <div className="input-group">
          <label className="label">Telefon</label>
          <input
            name="phone"
            value={form.phone}
            onChange={onChange}
            placeholder="Telefon numarası"
            className="input"
          />
        </div>

        <div className="input-group">
          <label className="label">E-posta</label>
          <input
            name="email"
            value={form.email}
            onChange={onChange}
            placeholder="E-posta adresi"
            className="input"
            type="email"
          />
        </div>

        <div className="submit-container">
          <button
            disabled={loading.submit}
            className={loading.submit ? "submit-button loading" : "submit-button"}
          >
            {loading.submit ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </form>

      {/* Import and Export buttons */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <label style={{padding: '0.75rem 2rem', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem', fontWeight: '600', transition: 'background-color 0.3s'}}>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleImport}
            style={{ display: 'none' }}
            disabled={importing}
          />
          {importing ? 'İçe Aktarılıyor...' : 'Tedarikçi İçe Aktar'}
        </label>

        <ExportButtons
          data={list.map((supplier) => ({
            "Tedarikçi Adı": supplier.name,
            "Telefon": supplier.phone || "",
            "E-posta": supplier.email || "",
          }))}
          filename="Tedarikciler_Dokumu"
        />
      </div>

      <h2 className="subtitle">Mevcut Tedarikçiler</h2>

      {loading.list ? (
        <div className="loading-text">Yükleniyor...</div>
      ) : (
        <div className="list">
          {list.map((s) => (
            <div key={s.id} className="list-item">
              <div className="supplier-name">{s.name}</div>
              <div className="supplier-details">
                {s.phone || "-"} {s.email ? `• ${s.email}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .container {
          max-width: 800px;
          margin: 2rem auto;
          padding: 2rem;
          background-color: #f8f9fa;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .title {
          text-align: center;
          color: #2c3e50;
          margin-bottom: 1.5rem;
          font-size: 1.8rem;
        }

        .subtitle {
          color: #2c3e50;
          margin-top: 2rem;
          margin-bottom: 1rem;
          font-size: 1.3rem;
          border-bottom: 2px solid #dee2e6;
          padding-bottom: 0.5rem;
        }

        .form {
          display: flex;
          flex-direction: column;
          gap: 1.2rem;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .label {
          font-weight: 600;
          color: #2c3e50;
          font-size: 0.9rem;
        }

        .input {
          padding: 0.75rem;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 1rem;
          outline: none;
          transition: border-color 0.3s;
        }

        .input:focus {
          border-color: #007bff;
        }

        .submit-button {
          padding: 0.9rem 2rem;
          background-color: #007bff;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 1.1rem;
          font-weight: 600;
          transition: background-color 0.3s;
        }

        .submit-button:hover:not(.loading) {
          background-color: #0056b3;
        }

        .submit-button.loading {
          background-color: #6c757d;
          cursor: not-allowed;
        }

        .submit-container {
          display: flex;
          justify-content: flex-end;
          margin-top: 1rem;
        }

        .error-message {
          background-color: #f8d7da;
          color: #721c24;
          padding: 0.75rem;
          border-radius: 6px;
          margin-bottom: 1.5rem;
          border: 1px solid #f5c6cb;
        }

        .success-message {
          background-color: #d4edda;
          color: #155724;
          padding: 0.75rem;
          border-radius: 6px;
          margin-bottom: 1.5rem;
          border: 1px solid #c3e6cb;
        }

        .list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .list-item {
          background-color: white;
          padding: 1rem;
          border-radius: 6px;
          border: 1px solid #dee2e6;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }

        .supplier-name {
          font-weight: 600;
          color: #2c3e50;
          font-size: 1rem;
          margin-bottom: 0.25rem;
        }

        .supplier-details {
          color: #6c757d;
          font-size: 0.9rem;
        }

        .loading-text {
          text-align: center;
          padding: 2rem;
          color: #6c757d;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
