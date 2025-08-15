// components/FabricExitForm.tsx
import { useState, useEffect } from "react";
import axios from "axios";

export default function FabricExitForm() {
  const [form, setForm] = useState({
    modelNo: "",
    orderNo: "",
    customerId: "",
    layerCount: 1,
    productWeight: 0,
    cuttingTableId: "",
    fabricEntryId: "",
  });

  const [cuttingTables, setCuttingTables] = useState([]);
  const [fabricEntries, setFabricEntries] = useState([]);

  useEffect(() => {
    axios
      .get("/api/cutting-tables")
      .then((res) => setCuttingTables(res.data))
      .catch((err) => console.error("Kesim masaları yüklenemedi:", err));

    axios
      .get("/api/fabric-entries")
      .then((res) => setFabricEntries(res.data))
      .catch((err) => console.error("Kumaş girişleri yüklenemedi:", err));
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post("/api/fabric-exit", form);
      alert("Kumaş çıkışı başarıyla kaydedildi");
      setForm({
        modelNo: "",
        orderNo: "",
        customerId: "",
        layerCount: 1,
        productWeight: 0,
        cuttingTableId: "",
        fabricEntryId: "",
      });
    } catch (err) {
      console.error(err);
      alert("Kayıt hatası");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      {/* 1. Satır: Model No & Sipariş No */}
      <div className="flex gap-4">
        <input
          name="modelNo"
          placeholder="Model No"
          value={form.modelNo}
          onChange={handleChange}
          className="border p-2 rounded flex-1"
          required
        />
        <input
          name="orderNo"
          placeholder="Sipariş No"
          value={form.orderNo}
          onChange={handleChange}
          className="border p-2 rounded flex-1"
          required
        />
      </div>

      {/* 2. Satır: Müşteri & Kat Sayısı */}
      <div className="flex gap-4">
        <input
          name="customerId"
          placeholder="Müşteri"
          value={form.customerId}
          onChange={handleChange}
          className="border p-2 rounded flex-1"
          required
        />
        <input
          type="number"
          name="layerCount"
          placeholder="Kat Sayısı"
          value={form.layerCount}
          onChange={handleChange}
          className="border p-2 rounded flex-1"
        />
      </div>

      {/* 3. Satır: Ürün Ağırlığı & Kesim Masası */}
      <div className="flex gap-4">
        <input
          type="number"
          name="productWeight"
          placeholder="Ürün Ağırlığı (kg)"
          value={form.productWeight}
          onChange={handleChange}
          className="border p-2 rounded flex-1"
        />
        <select
          name="cuttingTableId"
          onChange={handleChange}
          value={form.cuttingTableId}
          className="border p-2 rounded flex-1"
          required
        >
          <option value="">Kesim Masası Seç</option>
          {cuttingTables.map((table) => (
            <option key={table.id} value={table.id}>
              {table.name}
            </option>
          ))}
        </select>
      </div>

      {/* 4. Satır: Kumaş Girişi & Kaydet */}
      <div className="flex gap-4">
        <select
          name="fabricEntryId"
          onChange={handleChange}
          value={form.fabricEntryId}
          className="border p-2 rounded flex-1"
          required
        >
          <option value="">Kumaş Girişi Seç</option>
          {fabricEntries.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.fabricType.name} - {entry.color.name} ({entry.quantity} kg)
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="bg-blue-500 text-white p-2 rounded flex-1"
        >
          Kaydet
        </button>
      </div>
    </form>
  );
}
