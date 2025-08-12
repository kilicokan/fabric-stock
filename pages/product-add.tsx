import { useState } from "react";

export default function ProductAdd() {
  const [form, setForm] = useState({ modelNo: "", name: "", description: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    alert("Ürün eklendi!");
    setForm({ modelNo: "", name: "", description: "" });
  };

  return (
    <div style={{ maxWidth: 400, margin: "auto" }}>
      <h2>Ürün Ekle</h2>
      <form onSubmit={handleSubmit}>
        <label>Model No</label>
        <input
          type="text"
          value={form.modelNo}
          onChange={(e) => setForm({ ...form, modelNo: e.target.value })}
          required
        />

        <label>Ürün Adı</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />

        <label>Açıklama</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <button type="submit" style={{ marginTop: "15px" }}>Kaydet</button>
      </form>
    </div>
  );
}
