import { useEffect, useState } from "react";
import axios from "axios";
import {
  buildScaleQueryParams,
  readScaleSettings,
  saveScaleSettings,
  type ScaleReadResponse,
  type ScaleSettings,
} from "@/lib/scale";

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
  if (typeof error === "object" && error !== null) {
    const candidate = error as ApiErrorLike;
    const apiError = candidate.response?.data?.error || candidate.response?.data?.message;
    if (typeof apiError === "string" && apiError.trim()) return apiError;
    if (typeof candidate.message === "string" && candidate.message.trim()) return candidate.message;
  }
  return fallback;
};
export default function ScaleIntegrationPage() {
  const [settings, setSettings] = useState<ScaleSettings>({
    port: "",
    baudRate: 19200,
  });
  const [currentWeight, setCurrentWeight] = useState<string>("0.00");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  useEffect(() => {
    setSettings(readScaleSettings());
  }, []);

  // Test scale connection
  const handleTestScale = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await axios.get<ScaleReadResponse>("/api/scale", {
        params: buildScaleQueryParams(settings),
      });
      if (response.data.ok === false) {
        const failure = response.data as { error?: string };
        setError(failure.error || "Tarti baglantisi basarisiz");
        return;
      }

      setCurrentWeight(response.data.weight);
      setSuccess("Tartı bağlantısı başarılı! Mevcut ağırlık: " + response.data.weight + " kg");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Tarti baglantisi basarisiz"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Save settings (for now, just local state - could be saved to database later)
  const handleSaveSettings = () => {
    saveScaleSettings(settings);
    setSuccess("Ayarlar kaydedildi");
    setTimeout(() => setSuccess(""), 3000);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}> Tartı Entegrasyonu</h1>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      {/* Settings Form */}
      <div style={styles.settingsSection}>
        <h2 style={styles.subtitle}>Tartı Ayarları</h2>
        <div style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>COM Port</label>
            <select
              value={settings.port}
              onChange={(e) => setSettings(prev => ({ ...prev, port: e.target.value }))}
              style={styles.select}
            >
              <option value="">Port seçiniz</option>
              <option value="COM1">COM1</option>
              <option value="COM2">COM2</option>
              <option value="COM3">COM3</option>
              <option value="COM4">COM4</option>
              <option value="COM5">COM5</option>
              <option value="COM6">COM6</option>
              <option value="COM7">COM7</option>
              <option value="COM8">COM8</option>
              <option value="COM9">COM9</option>
              <option value="COM10">COM10</option>
            </select>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Baud Rate</label>
            <select
              value={settings.baudRate}
              onChange={(e) => setSettings(prev => ({ ...prev, baudRate: parseInt(e.target.value) }))}
              style={styles.select}
            >
              <option value="9600">9600</option>
              <option value="19200">19200</option>
              <option value="38400">38400</option>
              <option value="57600">57600</option>
              <option value="115200">115200</option>
            </select>
          </div>

          <button
            onClick={handleSaveSettings}
            style={styles.saveButton}
          >
            Ayarları Kaydet
          </button>
        </div>
      </div>

      {/* Test Section */}
      <div style={styles.testSection}>
        <h2 style={styles.subtitle}>Tartı Testi</h2>
        <div style={styles.testContent}>
          <div style={styles.weightDisplay}>
            <span style={styles.weightLabel}>Mevcut Ağırlık:</span>
            <span style={styles.weightValue}>{currentWeight} kg</span>
          </div>

          <button
            onClick={handleTestScale}
            style={loading ? { ...styles.testButton, ...styles.testButtonLoading } : styles.testButton}
            disabled={loading}
          >
            {loading ? "Bağlanıyor..." : "Tartıyı Test Et"}
          </button>
        </div>
      </div>

      {/* Info Section */}
      <div style={styles.infoSection}>
        <h2 style={styles.subtitle}>Bilgi</h2>
        <ul style={styles.infoList}>
          <li>Tartı cihazınızın bağlı olduğu COM portunu seçin</li>
          <li>{"Baud rate genellikle 9600'dur, ancak cihazin dokumantasyonunu kontrol edin"}</li>
          <li>{'Tarti cihazi seri port uzerinden veri gondermelidir (ornek: "W: 0123.45 kg")'}</li>
          <li>Test butonu ile bağlantıyı doğrulayabilirsiniz</li>
          <li>{'Kumas giris formunda "Tartidan Al" butonu bu ayarlari kullanacaktir'}</li>
        </ul>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: "20px",
    maxWidth: "800px",
    margin: "0 auto",
  },
  title: {
    textAlign: "center" as const,
    color: "#2c3e50",
    marginBottom: "2rem",
    fontSize: "1.8rem",
  },
  subtitle: {
    color: "#2c3e50",
    marginBottom: "1rem",
    fontSize: "1.4rem",
    borderBottom: "2px solid #3498db",
    paddingBottom: "0.5rem",
  },
  error: {
    backgroundColor: "#f8d7da",
    color: "#721c24",
    padding: "0.75rem",
    borderRadius: "6px",
    marginBottom: "1.5rem",
    border: "1px solid #f5c6cb",
  },
  success: {
    backgroundColor: "#d4edda",
    color: "#155724",
    padding: "0.75rem",
    borderRadius: "6px",
    marginBottom: "1.5rem",
    border: "1px solid #c3e6cb",
  },
  settingsSection: {
    backgroundColor: "white",
    padding: "1.5rem",
    borderRadius: "8px",
    marginBottom: "2rem",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
  },
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1rem",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
  },
  label: {
    fontWeight: "600",
    color: "#2c3e50",
    fontSize: "0.9rem",
  },
  select: {
    padding: "0.75rem",
    border: "1px solid #ddd",
    borderRadius: "6px",
    fontSize: "1rem",
    backgroundColor: "white",
    outline: "none",
    transition: "border-color 0.3s",
  },
  saveButton: {
    padding: "0.75rem 2rem",
    backgroundColor: "#28a745",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "1rem",
    fontWeight: "600",
    transition: "background-color 0.3s",
    alignSelf: "flex-start" as const,
  },
  testSection: {
    backgroundColor: "white",
    padding: "1.5rem",
    borderRadius: "8px",
    marginBottom: "2rem",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
  },
  testContent: {
    display: "flex",
    alignItems: "center",
    gap: "2rem",
    flexWrap: "wrap" as const,
  },
  weightDisplay: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "0.5rem",
  },
  weightLabel: {
    fontSize: "0.9rem",
    color: "#6c757d",
  },
  weightValue: {
    fontSize: "2rem",
    fontWeight: "bold",
    color: "#2c3e50",
  },
  testButton: {
    padding: "0.75rem 2rem",
    backgroundColor: "#17a2b8",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "1rem",
    fontWeight: "600",
    transition: "background-color 0.3s",
  },
  testButtonLoading: {
    backgroundColor: "#6c757d",
    cursor: "not-allowed",
  },
  infoSection: {
    backgroundColor: "white",
    padding: "1.5rem",
    borderRadius: "8px",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
  },
  infoList: {
    paddingLeft: "1.5rem",
    lineHeight: "1.6",
    color: "#555",
  },
};
