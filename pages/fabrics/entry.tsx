import { useState, useEffect } from "react";
import axios from "axios";
import Layout from "../../components/Layout/Layout";

export default function FabricEntryPage() {
  const [fabricTypes, setFabricTypes] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [fabricTypeId, setFabricTypeId] = useState("");
  const [colorId, setColorId] = useState("");
  const [quantityKg, setQuantityKg] = useState("");
  const [lengthMeter, setLengthMeter] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [typesRes, colorsRes] = await Promise.all([
          axios.get("/api/fabric-types"),
          axios.get("/api/colors"),
        ]);
        setFabricTypes(typesRes.data);
        setColors(colorsRes.data);
      } catch (err) {
        console.error("Tür/Renk yüklenemedi", err);
      }
    };
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      await axios.post("/api/fabric-entry", {
        fabricTypeId,
        colorId,
        quantityKg,
        lengthMeter,
      });
      setMessage("✅ Kumaş girişi başarıyla kaydedildi");
      setFabricTypeId("");
      setColorId("");
      setQuantityKg("");
      setLengthMeter("");
    } catch (err) {
      console.error(err);
      setMessage("❌ Kayıt eklenemedi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-6">Kumaş Girişi</h1>

        {message && <div className="mb-4 p-3 rounded bg-gray-100">{message}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-medium">Kumaş Türü</label>
            <select
              value={fabricTypeId}
              onChange={(e) => setFabricTypeId(e.target.value)}
              className="w-full border rounded p-2"
              required
            >
              <option value="">Seçiniz</option>
              {fabricTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium">Renk</label>
            <select
              value={colorId}
              onChange={(e) => setColorId(e.target.value)}
              className="w-full border rounded p-2"
              required
            >
              <option value="">Seçiniz</option>
              {colors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium">Miktar (kg)</label>
            <input
              type="number"
              step="0.01"
              value={quantityKg}
              onChange={(e) => setQuantityKg(e.target.value)}
              className="w-full border rounded p-2"
              required
            />
          </div>

          <div>
            <label className="block font-medium">Uzunluk (metre)</label>
            <input
              type="number"
              step="0.01"
              value={lengthMeter}
              onChange={(e) => setLengthMeter(e.target.value)}
              className="w-full border rounded p-2"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            {loading ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </form>
      </div>
    </Layout>
  );
}
