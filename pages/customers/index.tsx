import { useState, useEffect } from "react";
import axios from "axios";

export default function CustomerAddPage() {
  const [form, setForm] = useState({ name: "", contact: "", address: "" });
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState({ submit: false, list: false });
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const load = async () => {
    try {
      setLoading((s) => ({ ...s, list: true }));
      const { data } = await axios.get("/api/customers");
      setList(data);
    } catch (e) {
      setError("Müşteri listesi yüklenemedi");
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
      await axios.post("/api/customers", form);
      setForm({ name: "", contact: "", address: "" });
      setSuccess("Müşteri başarıyla eklendi!");
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
      <h1 className="title">👥 Müşteri Ekle</h1>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <form onSubmit={submit} className="form">
        <div className="input-group">
          <label className="label">Müşteri Adı *</label>
          <input 
            name="name" 
            value={form.name} 
            onChange={onChange} 
            placeholder="Müşteri adı" 
            className="input" 
            required 
          />
        </div>
        
        <div className="input-group">
          <label className="label">İletişim</label>
          <input 
            name="contact" 
            value={form.contact} 
            onChange={onChange} 
            placeholder="Telefon veya e-posta" 
            className="input" 
          />
        </div>
        
        <div className="input-group">
          <label className="label">Adres</label>
          <input 
            name="address" 
            value={form.address} 
            onChange={onChange} 
            placeholder="Adres" 
            className="input" 
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

      <h2 className="subtitle">Mevcut Müşteriler</h2>
      
      {loading.list ? (
        <div className="loading-text">Yükleniyor...</div>
      ) : (
        <div className="list">
          {list.map((c) => (
            <div key={c.id} className="list-item">
              <div className="customer-name">{c.name}</div>
              <div className="customer-details">
                {c.contact || "-"} {c.address ? `• ${c.address}` : ""}
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
        
        .customer-name {
          font-weight: 600;
          color: #2c3e50;
          font-size: 1rem;
          margin-bottom: 0.25rem;
        }
        
        .customer-details {
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