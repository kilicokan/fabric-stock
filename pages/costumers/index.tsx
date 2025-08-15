import { useState } from "react";
import axios from "axios";

export default function CustomerEntry() {
  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    address: ""
  });
  const [message, setMessage] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post("/api/customers", formData);
      setMessage("✅ Müşteri başarıyla eklendi!");
      setFormData({ name: "", contact: "", address: "" });
    } catch (error) {
      setMessage("❌ Müşteri eklenirken hata oluştu!");
    }
  };

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4">Müşteri Ekle</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          name="name"
          placeholder="Müşteri Adı"
          value={formData.name}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />
        <input
          type="text"
          name="contact"
          placeholder="İletişim Bilgisi"
          value={formData.contact}
          onChange={handleChange}
          className="w-full p-2 border rounded"
        />
        <input
          type="text"
          name="address"
          placeholder="Adres"
          value={formData.address}
          onChange={handleChange}
          className="w-full p-2 border rounded"
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Kaydet
        </button>
      </form>
      {message && <p className="mt-4">{message}</p>}
    </div>
  );
}
