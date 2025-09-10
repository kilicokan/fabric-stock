
import { useState, useEffect } from "react";
import axios from "axios";

export default function FabricEntry() {
  const [formData, setFormData] = useState({
    fabricType: "",
    color: "",
    weightKg: "",
    lengthMeter: "",
  });
  const [fabricTypes, setFabricTypes] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [showAddType, setShowAddType] = useState(false);
  const [newType, setNewType] = useState("");
  const [showAddColor, setShowAddColor] = useState(false);
  const [newColor, setNewColor] = useState("");
  const [loadingScale, setLoadingScale] = useState(false);

  // Load types/colors on mount (simulate API)
  useEffect(() => {
    // Replace with API calls if available
    setFabricTypes(["Pamuk", "Polyester"]);
    setColors(["Beyaz", "Mavi"]);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post("/api/fabric-entry", formData);
      alert("Kumaş girişi başarıyla kaydedildi!");
      setFormData({ fabricType: "", color: "", weightKg: "", lengthMeter: "" });
    } catch (err) {
      console.error(err);
      alert("Kayıt sırasında hata oluştu!");
    }
  };

  // Scale integration
  const handleScale = async () => {
    setLoadingScale(true);
    try {
      const { data } = await axios.get("/api/scale");
      setFormData((prev) => ({ ...prev, weightKg: data.weight.toString() }));
    } catch {
      alert("Tartıdan veri alınamadı!");
    } finally {
      setLoadingScale(false);
    }
  };

  // Add new fabric type
  const handleAddType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newType.trim()) return;
    setFabricTypes((prev) => [...prev, newType]);
    setFormData((prev) => ({ ...prev, fabricType: newType }));
    setNewType("");
    setShowAddType(false);
  };

  // Add new color
  const handleAddColor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColor.trim()) return;
    setColors((prev) => [...prev, newColor]);
    setFormData((prev) => ({ ...prev, color: newColor }));
    setNewColor("");
    setShowAddColor(false);
  };

  return (
    <div>
      <h1>📥 Kumaş Girişi Sayfası</h1>
      <form onSubmit={handleSubmit}>
        {/* Fabric Type Dropdown + Add */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            name="fabricType"
            value={formData.fabricType}
            onChange={handleChange}
            required
          >
            <option value="">Kumaş Türü Seçiniz</option>
            {fabricTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <button type="button" onClick={() => setShowAddType((v) => !v)} style={{ fontWeight: 'bold' }}>+</button>
        </div>
        {showAddType && (
          <form onSubmit={handleAddType} style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
            <input
              type="text"
              value={newType}
              onChange={e => setNewType(e.target.value)}
              placeholder="Yeni tür"
              required
            />
            <button type="submit">Ekle</button>
          </form>
        )}

        {/* Color Dropdown + Add */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            name="color"
            value={formData.color}
            onChange={handleChange}
            required
          >
            <option value="">Renk Seçiniz</option>
            {colors.map((color) => (
              <option key={color} value={color}>{color}</option>
            ))}
          </select>
          <button type="button" onClick={() => setShowAddColor((v) => !v)} style={{ fontWeight: 'bold' }}>+</button>
        </div>
        {showAddColor && (
          <form onSubmit={handleAddColor} style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
            <input
              type="text"
              value={newColor}
              onChange={e => setNewColor(e.target.value)}
              placeholder="Yeni renk"
              required
            />
            <button type="submit">Ekle</button>
          </form>
        )}

        {/* Weight with scale button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="number"
            name="weightKg"
            placeholder="Ağırlık (Kg)"
            value={formData.weightKg}
            onChange={handleChange}
            required
          />
          <button type="button" onClick={handleScale} disabled={loadingScale}>
            {loadingScale ? 'Tartılıyor...' : 'Tartıdan Al'}
          </button>
        </div>

        <input
          type="number"
          name="lengthMeter"
          placeholder="Uzunluk (Metre)"
          value={formData.lengthMeter}
          onChange={handleChange}
        />
        <button type="submit">Kaydet</button>
      </form>
    </div>
  );
}