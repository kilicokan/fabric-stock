import { useState } from "react";
import axios from "axios";

export default function FabricEntry() {
  const [formData, setFormData] = useState({
    fabricType: "",
    color: "",
    weightKg: "",
    lengthMeter: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  return (
    <div>
      <h1>📥 Kumaş Girişi Sayfası</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="fabricType"
          placeholder="Kumaş Türü"
          value={formData.fabricType}
          onChange={handleChange}
          required
        />
        <input
          type="text"
          name="color"
          placeholder="Renk"
          value={formData.color}
          onChange={handleChange}
          required
        />
        <input
          type="number"
          name="weightKg"
          placeholder="Ağırlık (Kg)"
          value={formData.weightKg}
          onChange={handleChange}
        />
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