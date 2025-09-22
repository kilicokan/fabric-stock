import { useState, useEffect } from "react";
import axios from "axios";

// Form veri tipi
interface FabricEntryFormData {
  fabricType: string;
  color: string;
  weightKg: string;
  lengthMeter: string;
  supplier: string;
}

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

  // Load types/colors/suppliers on mount (simulate API)
  useEffect(() => {
    setFabricTypes(["Pamuk", "Polyester"]);
    setColors(["Beyaz", "Mavi"]);
    setSuppliers(["Tedarikçi A", "Tedarikçi B"]);
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

    // Validate form data
    if (!formData.fabricType || !formData.color || !formData.weightKg || !formData.supplier) {
      setErrorMessage("Lütfen tüm zorunlu alanları doldurun!");
      return;
    }

    // Prepare data for API (convert numbers if needed)
    const payload = {
      ...formData,
      weightKg: parseFloat(formData.weightKg) || 0,
      lengthMeter: formData.lengthMeter ? parseFloat(formData.lengthMeter) : 0,
    };

    try {
      console.log("Sending payload:", payload); // Log payload for debugging
      const response = await axios.post("/api/fabric-entry", payload, {
        headers: { "Content-Type": "application/json" },
      });
      console.log("API response:", response.data); // Log response for debugging
      alert("Kumaş girişi başarıyla kaydedildi!");
      setFormData({ fabricType: "", color: "", weightKg: "", lengthMeter: "", supplier: "" });
    } catch (err: any) {
      console.error("Submission error:", err.response || err.message || err);
      const errorMsg = err.response?.data?.message || err.message || "Kayıt sırasında hata oluştu!";
      setErrorMessage(errorMsg);
    }
  };

  // Tartıdan veri alma
  const handleScale = async () => {
    setLoadingScale(true);
    setErrorMessage("");
    try {
      const { data } = await axios.get<{ weight: number }>("/api/scale");
      setFormData((prev) => ({ ...prev, weightKg: data.weight.toString() }));
    } catch (err: any) {
      console.error("Scale error:", err.response || err.message || err);
      setErrorMessage("Tartıdan veri alınamadı!");
    } finally {
      setLoadingScale(false);
    }
  };

  // Yeni kumaş türü ekleme
  const handleAddType = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newType.trim()) {
      setErrorMessage("Yeni kumaş türü boş olamaz!");
      return;
    }
    setFabricTypes((prev) => [...prev, newType]);
    setFormData((prev) => ({ ...prev, fabricType: newType }));
    setNewType("");
    setShowAddType(false);
  };

  // Yeni renk ekleme
  const handleAddColor = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newColor.trim()) {
      setErrorMessage("Yeni renk boş olamaz!");
      return;
    }
    setColors((prev) => [...prev, newColor]);
    setFormData((prev) => ({ ...prev, color: newColor }));
    setNewColor("");
    setShowAddColor(false);
  };

  // Yeni tedarikçi ekleme
  const handleAddSupplier = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newSupplier.trim()) {
      setErrorMessage("Yeni tedarikçi boş olamaz!");
      return;
    }
    setSuppliers((prev) => [...prev, newSupplier]);
    setFormData((prev) => ({ ...prev, supplier: newSupplier }));
    setNewSupplier("");
    setShowAddSupplier(false);
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
          <label style={styles.label}>Tedarikçi</label>
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
          <label style={styles.label}>Kumaş Türü</label>
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
          <label style={styles.label}>Renk</label>
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
          <label style={styles.label}>Ağırlık (Kg)</label>
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

// Modern tasarım için stiller (değişmedi, kısaltmak için burada tekrar verilmedi)
const styles = {
  container: {
    maxWidth: "500px",
    margin: "2rem auto",
    padding: "2rem",
    backgroundColor: "#f8f9fa",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
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
    gap: "1.2rem"
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
};