"use client";
import { useState } from "react";

export default function FabricEntryForm() {
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [weightKg, setWeightKg] = useState("");

  const handleSubmit = async (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    await fetch("/api/fabric-entry/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color, weightKg })
    });
    alert("Kayıt başarıyla eklendi");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2 p-4">
      <input placeholder="Kumaş Türü" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="Renk" value={color} onChange={(e) => setColor(e.target.value)} />
      <input type="number" placeholder="Ağırlık (kg)" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
      <button type="submit">Ekle</button>
    </form>
  );
}
