import { useState, useEffect } from "react";

export default function Reports() {
  const [reports, setReports] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    fabricType: "",
    color: ""
  });

  const fetchReports = async () => {
    try {
      const query = new URLSearchParams(filters).toString();
      const res = await fetch(`/api/reports?${query}`);
      const data = await res.json();
      setReports(data);
    } catch (err) {
      console.error("Raporlar alınamadı:", err);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  return (
    <div>
      <h1 style={{ marginBottom: "20px" }}>📊 Raporlar</h1>

      {/* Filtre Alanı */}
      <div style={{
        background: "white",
        padding: "20px",
        borderRadius: "8px",
        marginBottom: "20px",
        boxShadow: "0 2px 5px rgba(0,0,0,0.1)"
      }}>
        <h3>Filtreler</h3>
        <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
          <input
            type="date"
            name="startDate"
            value={filters.startDate}
            onChange={handleChange}
            style={inputStyle}
          />
          <input
            type="date"
            name="endDate"
            value={filters.endDate}
            onChange={handleChange}
            style={inputStyle}
          />
          <input
            type="text"
            placeholder="Kumaş Türü"
            name="fabricType"
            value={filters.fabricType}
            onChange={handleChange}
            style={inputStyle}
          />
          <input
            type="text"
            placeholder="Renk"
            name="color"
            value={filters.color}
            onChange={handleChange}
            style={inputStyle}
          />
          <button onClick={fetchReports} style={buttonStyle}>
            Filtrele
          </button>
        </div>
      </div>

      {/* Tablo */}
      <div style={{
        background: "white",
        padding: "20px",
        borderRadius: "8px",
        boxShadow: "0 2px 5px rgba(0,0,0,0.1)"
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#f4f4f4" }}>
              <th style={thTdStyle}>Tarih</th>
              <th style={thTdStyle}>Kumaş Türü</th>
              <th style={thTdStyle}>Renk</th>
              <th style={thTdStyle}>Miktar (Kg)</th>
              <th style={thTdStyle}>Miktar (Metre)</th>
            </tr>
          </thead>
          <tbody>
            {reports.length > 0 ? (
              reports.map((r, idx) => (
                <tr key={idx}>
                  <td style={thTdStyle}>{new Date(r.date).toLocaleDateString()}</td>
                  <td style={thTdStyle}>{r.fabricType}</td>
                  <td style={thTdStyle}>{r.color}</td>
                  <td style={thTdStyle}>{r.weightKg || "-"}</td>
                  <td style={thTdStyle}>{r.lengthMeter || "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td style={thTdStyle} colSpan={5}>Kayıt bulunamadı</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const inputStyle = {
  padding: "8px",
  border: "1px solid #ccc",
  borderRadius: "4px",
  minWidth: "150px"
};

const buttonStyle = {
  backgroundColor: "#16213e",
  color: "white",
  padding: "8px 15px",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer"
};

const thTdStyle = {
  border: "1px solid #ddd",
  padding: "8px",
  textAlign: "center" as const
};
