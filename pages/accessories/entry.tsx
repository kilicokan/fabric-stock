import { useState, useEffect } from "react";
import axios from "axios";
import Layout from "../../components/Layout";

interface NamedOption {
  id: number | string;
  name: string;
}

export default function FabricEntryPage() {
  const [fabricTypes, setFabricTypes] = useState<NamedOption[]>([]);
  const [colors, setColors] = useState<NamedOption[]>([]);
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
        console.error("TÃ¼r/Renk yÃ¼klenemedi", err);
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
      setMessage("âœ… KumaÅŸ giriÅŸi baÅŸarÄ±yla kaydedildi");
      setFabricTypeId("");
      setColorId("");
      setQuantityKg("");
      setLengthMeter("");
    } catch (err) {
      console.error(err);
      setMessage("âŒ KayÄ±t eklenemedi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 w-full min-h-screen">
        <h1 className="text-2xl font-bold mb-6">KumaÅŸ GiriÅŸi</h1>

        {message && <div className="mb-4 p-3 rounded bg-gray-100">{message}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-medium">KumaÅŸ TÃ¼rÃ¼</label>
            <select
              value={fabricTypeId}
              onChange={(e) => setFabricTypeId(e.target.value)}
              className="w-full border rounded p-2"
              required
            >
              <option value="">SeÃ§iniz</option>
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
              <option value="">SeÃ§iniz</option>
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

