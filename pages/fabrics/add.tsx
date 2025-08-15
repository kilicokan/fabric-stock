import { useEffect, useState } from "react";
import axios from "axios";

export default function FabricsAddPage() {
  const [typeName, setTypeName] = useState("");
  const [colorName, setColorName] = useState("");
  const [types, setTypes] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [loading, setLoading] = useState({ tList: false, cList: false, tSubmit: false, cSubmit: false });
  const [error, setError] = useState<string>("");

  const loadTypes = async () => {
    try {
      setLoading((s) => ({ ...s, tList: true }));
      const { data } = await axios.get("/api/fabric-types");
      setTypes(data);
    } catch {
      setError("Kumaş türleri yüklenemedi");
    } finally {
      setLoading((s) => ({ ...s, tList: false }));
    }
  };

  const loadColors = async () => {
    try {
      setLoading((s) => ({ ...s, cList: true }));
      const { data } = await axios.get("/api/colors");
      setColors(data);
    } catch {
      setError("Renkler yüklenemedi");
    } finally {
      setLoading((s) => ({ ...s, cList: false }));
    }
  };

  useEffect(() => {
    loadTypes();
    loadColors();
  }, []);

  const addType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError("");
      setLoading((s) => ({ ...s, tSubmit: true }));
      await axios.post("/api/fabric-types", { name: typeName });
      setTypeName("");
      loadTypes();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Kumaş türü eklenemedi");
    } finally {
      setLoading((s) => ({ ...s, tSubmit: false }));
    }
  };

  const addColor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError("");
      setLoading((s) => ({ ...s, cSubmit: true }));
      await axios.post("/api/colors", { name: colorName });
      setColorName("");
      loadColors();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Renk eklenemedi");
    } finally {
      setLoading((s) => ({ ...s, cSubmit: false }));
    }
  };

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Kumaş Ekle</h1>

      {error && <div className="mb-4 rounded bg-red-100 text-red-700 p-3">{error}</div>}

      <div className="grid md:grid-cols-2 gap-8">
        {/* Kumaş Türü Ekle */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Kumaş Türü</h2>
          <form onSubmit={addType} className="space-y-3">
            <input
              value={typeName}
              onChange={(e) => setTypeName(e.target.value)}
              placeholder="Örn: Penye, Ribana..."
              className="w-full border p-2 rounded"
              required
            />
            <button disabled={loading.tSubmit} className="bg-blue-600 text-white px-4 py-2 rounded">
              {loading.tSubmit ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </form>

          <h3 className="font-semibold mt-6 mb-2">Mevcut Kumaş Türleri</h3>
          {loading.tList ? (
            <div>Yükleniyor...</div>
          ) : (
            <ul className="space-y-2">
              {types.map((t) => (
                <li key={t.id} className="border rounded p-2">{t.name}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Renk Ekle */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Renk</h2>
          <form onSubmit={addColor} className="space-y-3">
            <input
              value={colorName}
              onChange={(e) => setColorName(e.target.value)}
              placeholder="Örn: Siyah, Lacivert..."
              className="w-full border p-2 rounded"
              required
            />
            <button disabled={loading.cSubmit} className="bg-blue-600 text-white px-4 py-2 rounded">
              {loading.cSubmit ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </form>

          <h3 className="font-semibold mt-6 mb-2">Mevcut Renkler</h3>
          {loading.cList ? (
            <div>Yükleniyor...</div>
          ) : (
            <ul className="space-y-2">
              {colors.map((c) => (
                <li key={c.id} className="border rounded p-2">{c.name}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
