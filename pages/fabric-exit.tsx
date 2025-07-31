import { useState } from "react";
import axios from "axios";

export default function FabricExitForm() {
  const [form, setForm] = useState({
    fabricType: "",
    color: "",
    weightKg: "",
    lengthMeter: "",
    cuttingTable: "",
  });

  const handleChange = (e: { target: { name: any; value: any; }; }) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    const payload = {
      ...form,
      weightKg: form.weightKg ? parseFloat(form.weightKg) : null,
      lengthMeter: form.lengthMeter ? parseFloat(form.lengthMeter) : null,
    };

    const res = await axios.post("/api/fabric-exit/add", payload);
    alert("Kayıt başarıyla oluşturuldu");
    setForm({
      fabricType: "",
      color: "",
      weightKg: "",
      lengthMeter: "",
      cuttingTable: "",
    });
  };

  return (
    <div className="max-w-md mx-auto mt-10 px-4">
      <h1 className="text-lg font-bold mb-4">✂️ Kumaş Çıkışı</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input name="fabricType" placeholder="Kumaş Türü" value={form.fabricType} onChange={handleChange} required className="border p-2 w-full" />
        <input name="color" placeholder="Renk" value={form.color} onChange={handleChange} required className="border p-2 w-full" />
        <input name="weightKg" placeholder="Ağırlık (kg)" value={form.weightKg} onChange={handleChange} className="border p-2 w-full" />
        <input name="lengthMeter" placeholder="Uzunluk (metre)" value={form.lengthMeter} onChange={handleChange} className="border p-2 w-full" />
        <input name="cuttingTable" placeholder="Kesim Masası Adı/No" value={form.cuttingTable} onChange={handleChange} required className="border p-2 w-full" />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Kaydet</button>
      </form>
    </div>
  );
}
