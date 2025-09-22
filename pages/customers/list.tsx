import { useEffect, useState } from "react";
import axios from "axios";

export default function CustomerListPage() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get("/api/customers");
        setList(data);
      } catch (e) {
        setError("Müşteri listesi yüklenemedi");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="container">
      <h1 className="title">👥 Müşteri Listesi</h1>
      {error && <div className="error-message">{error}</div>}
      {loading ? (
        <div className="loading-text">Yükleniyor...</div>
      ) : (
        <div className="list">
          {list.length === 0 ? (
            <div className="loading-text">Kayıt bulunamadı.</div>
          ) : (
            list.map((c) => (
              <div key={c.id} className="list-item">
                <div className="customer-name">{c.name}</div>
                <div className="customer-details">
                  {c.contact || "-"} {c.address ? `• ${c.address}` : ""}
                </div>
              </div>
            ))
          )}
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
        .error-message {
          background-color: #f8d7da;
          color: #721c24;
          padding: 0.75rem;
          border-radius: 6px;
          margin-bottom: 1.5rem;
          border: 1px solid #f5c6cb;
        }
      `}</style>
    </div>
  );
}