```tsx
import { useState, useEffect } from "react";
import axios from "axios";

// Form veri tipi
interface ProductFormData {
  name: string;
  materialType: string;
  groupNo: string;
  taxRate: string;
  description: string;
}

export default function ProductAdd() {
  const [formData, setFormData] = useState<ProductFormData>({
    name: "",
    materialType: "",
    groupNo: "",
    taxRate: "",
    description: "",
  });

  const [materialTypes, setMaterialTypes] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [taxRates, setTaxRates] = useState<string[]>([]);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [newMaterial, setNewMaterial] = useState("");
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroup, setNewGroup] = useState("");
  const [showAddTaxRate, setShowAddTaxRate] = useState(false);
  const [newTaxRate, setNewTaxRate] = useState("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Load material types, groups, and tax rates on mount (simulate settings API)
  useEffect(() => {
    setMaterialTypes(["Kumaş", "Deri"]);
    setGroups(["Dokuma Kumaş", "Örme Kumaş"]);
    setTaxRates(["%0", "%1", "%8", "%20"]);
  }, []);

  // Form input değişiklikleri
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrorMessage("");
  };

  // Form submit
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");

    // Validate form data
    if (!formData.name || !formData.materialType || !formData.groupNo || !formData.taxRate) {
      setErrorMessage("Lütfen tüm zorunlu alanları doldurun!");
      return;
    }

    try {
      console.log("Sending payload:", formData);
      await axios.post("/api/products", formData, {
        headers: { "Content-Type": "application/json" },
      });
      alert("Ürün başarıyla eklendi!");
      setFormData({ name: "", materialType: "", groupNo: "", taxRate: "", description: "" });
    } catch (err: any) {
      console.error("Submission error:", err.response || err.message || err);
      const errorMsg = err.response?.data?.message || err.message || "Ürün eklenirken hata oluştu!";
      setErrorMessage(errorMsg);
    }
  };

  // Yeni malzeme türü ekleme
  const handleAddMaterial = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newMaterial.trim()) {
      setErrorMessage("Yeni malzeme türü boş olamaz!");
      return;
    }
    setMaterialTypes((prev) => [...prev, newMaterial]);
    setFormData((prev) => ({ ...prev, materialType: newMaterial }));
    setNewMaterial("");
    setShowAddMaterial(false);
  };

  // Yeni grup ekleme
  const handleAddGroup = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newGroup.trim()) {
      setErrorMessage("Yeni grup boş olamaz!");
      return;
    }
    setGroups((prev) => [...prev, newGroup]);
    setFormData((prev) => ({ ...prev, groupNo: newGroup }));
    setNewGroup("");
    setShowAddGroup(false);
  };

  // Yeni vergi oranı ekleme
  const handleAddTaxRate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newTaxRate.trim()) {
      setErrorMessage("Yeni vergi oranı boş olamaz!");
      return;
    }
    setTaxRates((prev) => [...prev, newTaxRate]);
    setFormData((prev) => ({ ...prev, taxRate: newTaxRate }));
    setNewTaxRate("");
    setShowAddTaxRate(false);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>📦 Ürün Ekle</h1>
      {errorMessage && (
        <div style={{ color: "red", marginBottom: "1rem", textAlign: "center" }}>
          {errorMessage}
        </div>
      )}
      
      <form onSubmit={handleSubmit} style={styles.form}>
        {/* Adı */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Adı</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Ürün adı"
            style={styles.input}
            required
          />
        </div>

        {/* Malzeme Türü Dropdown + Add */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Malzeme Türü</label>
          <div style={styles.selectWithButton}>
            <select
              name="materialType"
              value={formData.materialType}
              onChange={handleChange}
              style={styles.select}
              required
            >
              <option value="">Seçiniz</option>
              {materialTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowAddMaterial((v) => !v)}
              style={styles.addButton}
              title="Yeni malzeme türü ekle"
            >
              +
            </button>
          </div>
        </div>

        {showAddMaterial && (
          <form onSubmit={handleAddMaterial} style={styles.addForm}>
            <input
              type="text"
              value={newMaterial}
              onChange={(e) => setNewMaterial(e.target.value)}
              placeholder="Yeni malzeme türü"
              style={styles.textInput}
              required
            />
            <button type="submit" style={styles.smallButton}>Ekle</button>
          </form>
        )}

        {/* Grup No Dropdown + Add */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Grup No</label>
          <div style={styles.selectWithButton}>
            <select
              name="groupNo"
              value={formData.groupNo}
              onChange={handleChange}
              style={styles.select}
              required
            >
              <option value="">Seçiniz</option>
              {groups.map((group) => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowAddGroup((v) => !v)}
              style={styles.addButton}
              title="Yeni grup ekle"
            >
              +
            </button>
          </div>
        </div>

        {showAddGroup && (
          <form onSubmit={handleAddGroup} style={styles.addForm}>
            <input
              type="text"
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              placeholder="Yeni grup"
              style={styles.textInput}
              required
            />
            <button type="submit" style={styles.smallButton}>Ekle</button>
          </form>
        )}

        {/* KDV Vergi Oranları Dropdown + Add */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>KDV Vergi Oranı</label>
          <div style={styles.selectWithButton}>
            <select
              name="taxRate"
              value={formData.taxRate}
              onChange={handleChange}
              style={styles.select}
              required
            >
              <option value="">Seçiniz</option>
              {taxRates.map((rate) => (
                <option key={rate} value={rate}>{rate}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowAddTaxRate((v) => !v)}
              style={styles.addButton}
              title="Yeni vergi oranı ekle"
            >
              +
            </button>
          </div>
        </div>

        {showAddTaxRate && (
          <form onSubmit={handleAddTaxRate} style={styles.addForm}>
            <input
              type="text"
              value={newTaxRate}
              onChange={(e) => setNewTaxRate(e.target.value)}
              placeholder="Yeni vergi oranı (örn. %10)"
              style={styles.textInput}
              required
            />
            <button type="submit" style={styles.smallButton}>Ekle</button>
          </form>
        )}

        {/* Açıklama */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Açıklama</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Ürün açıklaması"
            style={{ ...styles.input, minHeight: "100px", resize: "vertical" }}
          />
        </div>

        <button type="submit" style={styles.submitButton}>Kaydet</button>
      </form>
    </div>
  );
}

// FabricEntry ile uyumlu stiller
const styles = {
  container: {
    maxWidth: "500px",
    margin: "2rem auto",
    padding: "2rem",
    backgroundColor: "#f8f9fa",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  title: {
    textAlign: "center" as const,
    color: "#2c3e50",
    marginBottom: "1.5rem",
    fontSize: "1.8rem",
  },
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1.2rem",
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
  selectWithButton: {
    display: "flex",
    gap: "0.5rem",
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
    flex: 1,
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
    transition: "background-color 0.3s",
  },
  smallButton: {
    padding: "0.75rem 1rem",
    backgroundColor: "#28a745",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
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
    transition: "background-color 0.3s",
  },
  addForm: {
    display: "flex",
    gap: "0.5rem",
    alignItems: "center",
    backgroundColor: "#e9ecef",
    padding: "0.8rem",
    borderRadius: "6px",
  },
};
```