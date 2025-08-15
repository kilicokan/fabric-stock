import { useState, useEffect } from "react";
import axios from "axios";

export default function CustomerAddPage() {
  const [form, setForm] = useState({ name: "", contact: "", address: "" });
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState({ submit: false, list: false });
  const [error, setError] = useState<string>("");

  const load = async () => {
    try {
      setLoading((s) => ({ ...s, list: true }));
      const { data } = await axios.get("/api/customers");
      setList(data);
    } catch (e) {
      setError("Müşteri listesi yüklenemedi");
    } finally {
      setLoading((s) => ({ ...s, list: false }));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError("");
      setLoading((s) => ({ ...s, submit: true }));
      await axios.post("/api/customers", form);
      setForm({ name: "", contact: "", address: "" });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Kayıt başarısız");
    } finally {
      setLoading((s) => ({ ...s, submit: false }));
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Müşteri Ekle</h1>

      {error && <div className="mb-4 rounded bg-red-100 text-red-700 p-3">{error}</div>}

      <form onSubmit={submit} className="space-y-4">
        <input name="name" value={form.name} onChange={onChange} placeholder="Müşteri Adı" className="w-full border p-2 rounded" required />
        <input name="contact" value={form.contact} onChange={onChange} placeholder="İletişim" className="w-full border p-2 rounded" />
        <input name="address" value={form.address} onChange={onChange} placeholder="Adres" className="w-full border p-2 rounded" />
        <button disabled={loading.submit} className="bg-blue-600 text-white px-4 py-2 rounded">
          {loading.submit ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </form>

      <h2 className="text-lg font-semibold mt-8 mb-2">Mevcut Müşteriler</h2>
      {loading.list ? (
        <div>Yükleniyor...</div>
      ) : (
        <ul className="space-y-2">
          {list.map((c) => (
            <li key={c.id} className="border rounded p-2">
              <div className="font-medium">{c.name}</div>
              <div className="text-sm text-gray-600">{c.contact || "-"} {c.address ? `• ${c.address}` : ""}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
