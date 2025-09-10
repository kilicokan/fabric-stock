// pages/fabrics/index.tsx
import { useState, useEffect } from "react";
import axios from "axios";
import Layout from "../../components/layout/Layout";

export default function FabricsPage() {
  const [form, setForm] = useState({ name: "", type: "", color: "" });
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState({ submit: false, list: false });
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading((s) => ({ ...s, list: true }));
      const { data } = await axios.get("/api/fabrics");
      setList(data);
    } catch {
      setError("Kumaş listesi yüklenemedi");
    } finally {
      setLoading((s) => ({ ...s, list: false }));
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading((s) => ({ ...s, submit: true }));
      await axios.post("/api/fabrics", form);
      setForm({ name: "", type: "", color: "" });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Kayıt başarısız");
    } finally {
      setLoading((s) => ({ ...s, submit: false }));
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">Kumaş Ekle</h1>

        {error && <div className="mb-4 rounded bg-red-100 text-red-700 p-3">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <input name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Kumaş Adı" className="w-full border p-2 rounded" required />
          <input name="type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="Tür" className="w-full border p-2 rounded" />
          <input name="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="Renk" className="w-full border p-2 rounded" />
          <button disabled={loading.submit} className="bg-blue-600 text-white px-4 py-2 rounded">
            {loading.submit ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </form>

        <h2 className="text-lg font-semibold mt-8 mb-2">Mevcut Kumaşlar</h2>
        {loading.list ? <div>Yükleniyor...</div> : (
          <ul className="space-y-2">
            {list.map((f) => (
              <li key={f.id} className="border rounded p-2">
                <div className="font-medium">{f.name}</div>
                <div className="text-sm text-gray-600">{f.type || "-"} {f.color ? `• ${f.color}` : ""}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  );
}
