import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { buildScaleQueryParams, readScaleSettings, type ScaleReadResponse } from "@/lib/scale";

// Form veri tipi
interface FabricEntryFormData {
  fabricType: string;
  color: string;
  weightKg: string;
  lengthMeter: string;
  supplier: string;
}

interface NamedOption {
  name: string;
}

type ApiErrorLike = {
  response?: {
    status?: number;
    data?: {
      message?: string;
      error?: string;
    };
  };
  message?: string;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === "object" && error !== null) {
    const candidate = error as ApiErrorLike;
    const apiMessage = candidate.response?.data?.message || candidate.response?.data?.error;
    if (typeof apiMessage === "string" && apiMessage.trim()) return apiMessage;
    if (typeof candidate.message === "string" && candidate.message.trim()) return candidate.message;
  }
  return fallback;
};

const getErrorStatus = (error: unknown): number | null => {
  if (typeof error === "object" && error !== null) {
    const candidate = error as ApiErrorLike;
    const status = candidate.response?.status;
    return typeof status === "number" ? status : null;
  }
  return null;
};

const parseLocaleNumber = (value: string): number | null => {
  const normalized = String(value || "").trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function FabricEntry() {
  const [formData, setFormData] = useState<FabricEntryFormData>({
    fabricType: "",
    color: "",
    weightKg: "",
    lengthMeter: "",
    supplier: "",
  });

  const [fabricTypes, setFabricTypes] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [showAddType, setShowAddType] = useState(false);
  const [newType, setNewType] = useState("");
  const [showAddColor, setShowAddColor] = useState(false);
  const [newColor, setNewColor] = useState("");
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState("");
  const [loadingScale, setLoadingScale] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Load types/colors/suppliers on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fabricsRes, colorsRes, suppliersRes] = await Promise.all([
          api.get('/fabrics'),
          api.get('/colors'),
          api.get('/suppliers')
        ]);
        setFabricTypes((fabricsRes.data as NamedOption[]).map((f: NamedOption) => f.name));
        setColors((colorsRes.data as NamedOption[]).map((c: NamedOption) => c.name));
        setSuppliers((suppliersRes.data as NamedOption[]).map((s: NamedOption) => s.name));
      } catch (error) {
        if (getErrorStatus(error) === 401) {
          setErrorMessage("Oturum suresi dolmus. Lutfen tekrar giris yapin.");
        } else {
          console.error('Error fetching data:', error);
        }
        // Fallback to empty or default
        setFabricTypes([]);
        setColors([]);
        setSuppliers([]);
      }
    };
    fetchData();
  }, []);

  // Form input değişiklikleri
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrorMessage(""); // Clear error on input change
  };

  // Form submit
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");

    // Validate form data - lengthMeter artık zorunlu değil
    if (!formData.fabricType || !formData.color || !formData.weightKg || !formData.supplier) {
      setErrorMessage("Lütfen tüm zorunlu alanları doldurun!");
      return;
    }

    const parsedWeight = parseLocaleNumber(formData.weightKg);
    if (parsedWeight === null || parsedWeight <= 0) {
      setErrorMessage("Agirlik (kg) alani icin gecerli bir deger girin.");
      return;
    }

    const parsedLength = parseLocaleNumber(formData.lengthMeter);

    // Prepare data for API (convert numbers if needed)
    const payload = {
      ...formData,
      weightKg: parsedWeight,
      quantityKg: parsedWeight,
      // lengthMeter bossa null olarak gonder
      lengthMeter: parsedLength,
    };

    try {
      console.log("Sending payload:", payload);
      const response = await api.post("/fabric-entry", payload, {
        headers: { "Content-Type": "application/json" },
      });
      console.log("API response:", response.data);
      toast.success(response.data?.message || "Kumaş girişi başarıyla kaydedildi!", {
        duration: 2200,
        style: {
          borderRadius: "14px",
          border: "1px solid #86efac",
          background: "#ecfdf5",
          color: "#14532d",
          fontWeight: 700,
          boxShadow: "0 12px 30px rgba(16, 185, 129, 0.18)",
        },
        iconTheme: {
          primary: "#16a34a",
          secondary: "#ecfdf5",
        },
      });
      setFormData({ fabricType: "", color: "", weightKg: "", lengthMeter: "", supplier: "" });
    } catch (err: unknown) {
      console.error("Submission error:", err);
      setErrorMessage(getErrorMessage(err, "Kayit sirasinda hata olustu!"));
    }
  };

  // Tartıdan veri alma
  const handleScale = async () => {
    setLoadingScale(true);
    setErrorMessage("");
    try {
      const { data } = await api.get<ScaleReadResponse>("/scale", {
        params: buildScaleQueryParams(readScaleSettings()),
      });

      if (data.ok === false) {
        const failure = data as { error?: string };
        setErrorMessage(failure.error || "Tartidan veri alinamadi!");
        return;
      }

      setFormData((prev) => ({ ...prev, weightKg: data.weight }));
    } catch (err: unknown) {
      console.error("Scale error:", err);
      setErrorMessage(getErrorMessage(err, "Tartidan veri alinamadi!"));
    } finally {
      setLoadingScale(false);
    }
  };

  // Yeni kumaş türü ekleme
  const handleAddType = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newType.trim()) {
      setErrorMessage("Yeni kumaş türü boş olamaz!");
      return;
    }
    try {
      await api.post('/fabric-types', { name: newType });
      setFabricTypes((prev) => [...prev, newType]);
      setFormData((prev) => ({ ...prev, fabricType: newType }));
      setNewType("");
      setShowAddType(false);
    } catch (error) {
      console.error('Error adding fabric type:', error);
      setErrorMessage('Kumaş türü eklenemedi');
    }
  };

  // Yeni renk ekleme
  const handleAddColor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newColor.trim()) {
      setErrorMessage("Yeni renk boş olamaz!");
      return;
    }
    try {
      await api.post('/colors', { name: newColor });
      setColors((prev) => [...prev, newColor]);
      setFormData((prev) => ({ ...prev, color: newColor }));
      setNewColor("");
      setShowAddColor(false);
    } catch (error) {
      console.error('Error adding color:', error);
      setErrorMessage('Renk eklenemedi');
    }
  };

  // Yeni tedarikçi ekleme
  const handleAddSupplier = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newSupplier.trim()) {
      setErrorMessage("Yeni tedarikçi boş olamaz!");
      return;
    }
    try {
      await api.post('/suppliers', { name: newSupplier });
      setSuppliers((prev) => [...prev, newSupplier]);
      setFormData((prev) => ({ ...prev, supplier: newSupplier }));
      setNewSupplier("");
      setShowAddSupplier(false);
    } catch (error) {
      console.error('Error adding supplier:', error);
      setErrorMessage('Tedarikçi eklenemedi');
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>📥 Kumaş Girişi</h1>
      {errorMessage && (
        <div style={{ color: "red", marginBottom: "1rem", textAlign: "center" }}>
          {errorMessage}
        </div>
      )}
      
      <form onSubmit={handleSubmit} style={styles.form}>
        {/* Supplier Dropdown + Add */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Tedarikçi *</label>
          <div style={styles.selectWithButton}>
            <select 
              name="supplier" 
              value={formData.supplier} 
              onChange={handleChange} 
              style={styles.select}
              required
            >
              <option value="">Seçiniz</option>
              {suppliers.map((supplier) => (
                <option key={supplier} value={supplier}>{supplier}</option>
              ))}
            </select>
            <button 
              type="button" 
              onClick={() => setShowAddSupplier((v) => !v)} 
              style={styles.addButton}
              title="Yeni tedarikçi ekle"
            >
              +
            </button>
          </div>
        </div>
        
        {showAddSupplier && (
          <form onSubmit={handleAddSupplier} style={styles.addForm}>
            <input 
              type="text" 
              value={newSupplier} 
              onChange={e => setNewSupplier(e.target.value)} 
              placeholder="Yeni tedarikçi" 
              style={styles.textInput}
              required 
            />
            <button type="submit" style={styles.smallButton}>Ekle</button>
          </form>
        )}

        {/* Fabric Type Dropdown + Add */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Kumaş Türü *</label>
          <div style={styles.selectWithButton}>
            <select 
              name="fabricType" 
              value={formData.fabricType} 
              onChange={handleChange} 
              style={styles.select}
              required
            >
              <option value="">Seçiniz</option>
              {fabricTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <button 
              type="button" 
              onClick={() => setShowAddType((v) => !v)} 
              style={styles.addButton}
              title="Yeni kumaş türü ekle"
            >
              +
            </button>
          </div>
        </div>
        
        {showAddType && (
          <form onSubmit={handleAddType} style={styles.addForm}>
            <input 
              type="text" 
              value={newType} 
              onChange={e => setNewType(e.target.value)} 
              placeholder="Yeni kumaş türü" 
              style={styles.textInput}
              required 
            />
            <button type="submit" style={styles.smallButton}>Ekle</button>
          </form>
        )}

        {/* Color Dropdown + Add */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Renk *</label>
          <div style={styles.selectWithButton}>
            <select 
              name="color" 
              value={formData.color} 
              onChange={handleChange} 
              style={styles.select}
              required
            >
              <option value="">Seçiniz</option>
              {colors.map((color) => (
                <option key={color} value={color}>{color}</option>
              ))}
            </select>
            <button 
              type="button" 
              onClick={() => setShowAddColor((v) => !v)} 
              style={styles.addButton}
              title="Yeni renk ekle"
            >
              +
            </button>
          </div>
        </div>
        
        {showAddColor && (
          <form onSubmit={handleAddColor} style={styles.addForm}>
            <input 
              type="text" 
              value={newColor} 
              onChange={e => setNewColor(e.target.value)} 
              placeholder="Yeni renk" 
              style={styles.textInput}
              required 
            />
            <button type="submit" style={styles.smallButton}>Ekle</button>
          </form>
        )}

        {/* Weight with scale button */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Ağırlık (Kg) *</label>
          <div style={styles.inputWithButton}>
            <input 
              type="number" 
              name="weightKg" 
              placeholder="0.00" 
              value={formData.weightKg} 
              onChange={handleChange} 
              style={styles.input}
              step="0.01"
              min="0"
              required 
            />
            <button 
              type="button" 
              onClick={handleScale} 
              disabled={loadingScale}
              style={loadingScale ? { ...styles.scaleButton, ...styles.scaleButtonLoading } : styles.scaleButton}
            >
              {loadingScale ? '⏳' : '⚖️ Tartıdan Al'}
            </button>
          </div>
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Uzunluk (Metre)</label>
          <input 
            type="number" 
            name="lengthMeter" 
            placeholder="0.00" 
            value={formData.lengthMeter} 
            onChange={handleChange} 
            style={styles.input}
            step="0.01"
            min="0"
          />
        </div>

        <button type="submit" style={styles.submitButton}>Kaydet</button>
      </form>
    </div>
  );
}

// Stiller aynı kalıyor
const styles = {
  container: {
    width: "100%",
    maxWidth: "100%",
    minHeight: "100vh",
    margin: "0",
    padding: "2rem",
    backgroundColor: "#f8f9fa",
    borderRadius: "0",
    boxShadow: "none",
    boxSizing: "border-box",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
  },
  title: {
    textAlign: "center",
    color: "#2c3e50",
    marginBottom: "1.5rem",
    fontSize: "1.8rem"
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1.2rem",
    width: "100%",
    maxWidth: "100%"
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem"
  },
  label: {
    fontWeight: "600",
    color: "#2c3e50",
    fontSize: "0.9rem"
  },
  selectWithButton: {
    display: "flex",
    gap: "0.5rem"
  },
  inputWithButton: {
    display: "flex",
    gap: "0.5rem"
  },
  select: {
    flex: 1,
    padding: "0.75rem",
    border: "1px solid #ddd",
    borderRadius: "6px",
    fontSize: "1rem",
    backgroundColor: "white",
    outline: "none",
    transition: "border-color 0.3s",
  },
  input: {
    padding: "0.75rem",
    border: "1px solid #ddd",
    borderRadius: "6px",
    fontSize: "1rem",
    outline: "none",
    transition: "border-color 0.3s",
  },
  textInput: {
    padding: "0.75rem",
    border: "1px solid #ddd",
    borderRadius: "6px",
    fontSize: "1rem",
    outline: "none",
    transition: "border-color 0.3s",
    flex: 1
  },
  addButton: {
    padding: "0.5rem 0.8rem",
    backgroundColor: "#6c757d",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "1.2rem",
    transition: "background-color 0.3s"
  },
  scaleButton: {
    padding: "0.75rem 1rem",
    backgroundColor: "#17a2b8",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "background-color 0.3s"
  },
  scaleButtonLoading: {
    backgroundColor: "#6c757d",
    cursor: "not-allowed"
  },
  smallButton: {
    padding: "0.75rem 1rem",
    backgroundColor: "#28a745",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    whiteSpace: "nowrap"
  },
  submitButton: {
    padding: "0.9rem",
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "1.1rem",
    fontWeight: "600",
    marginTop: "1rem",
    transition: "background-color 0.3s"
  },
  addForm: {
    display: "flex",
    gap: "0.5rem",
    alignItems: "center",
    backgroundColor: "#e9ecef",
    padding: "0.8rem",
    borderRadius: "6px"
  }
} as const;



