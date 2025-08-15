import { useEffect, useState } from "react";
import axios from "axios";

export default function ProductAddPage() {
  const [form, setForm] = useState({ modelNo: "", name: "" });
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState({ submit: false, list: false });
  const [error, setError] = useState<string>("");

  const load = async () => {
    try {
      setLoading((s) => ({ ...s, list: true }));
      const { data } = await axios.get("/api/products");
      setList(data);
    } catch {
      setError("Ürün listesi yüklenemedi");
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
      await axios.post("/api/products", form);
      setForm({ modelNo: "", name: "" });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Kayıt başarısız");
    } finally {
      setLoading((s) => ({ ...s, submit: false }));
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Ürün Ekle</h1>

      {error && <div className="mb-4 rounded bg-red-100 text-red-700 p-3">{error}</div>}

      <form onSubmit={submit} className="space-y-4">
        <input
          value={form.modelNo}
          onChange={(e) => setForm((f) => ({ ...f, modelNo: e.target.value }))}
          placeholder="Model No"
          className="w-full border p-2 rounded"
          required
        />
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Ürün Adı"
          className="w-full border p-2 rounded"
          required
        />
        <button disabled={loading.submit} className="bg-blue-600 text-white px-4 py-2 rounded">
          {loading.submit ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </form>

      <h2 className="text-lg font-semibold mt-8 mb-2">Mevcut Ürünler</h2>
      {loading.list ? (
        <div>Yükleniyor...</div>
      ) : (
        <ul className="space-y-2">
          {list.map((p) => (
            <li key={p.id} className="border rounded p-2">
              <div className="font-medium">{p.modelNo}</div>
              <div className="text-sm text-gray-600">{p.name}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
