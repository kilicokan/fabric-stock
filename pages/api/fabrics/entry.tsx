
import { useState, useEffect } from "react";
import axios from "axios";
import Layout from "../../../components/Layout/Layout";

const FabricEntryPage = () => {
  const [fabricTypes, setFabricTypes] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [selectedType, setSelectedType] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [weight, setWeight] = useState("0");
  const [manualWeight, setManualWeight] = useState("");
  const [useManualWeight, setUseManualWeight] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  // For adding new fabric type/color
  const [showAddType, setShowAddType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [showAddColor, setShowAddColor] = useState(false);
  const [newColorName, setNewColorName] = useState("");

  // Kumaş türlerini yükle
  const loadTypes = async () => {
    try {
      const { data } = await axios.get("/api/fabric-types");
      setFabricTypes(data);
    } catch {
      setError("Kumaş türleri yüklenemedi");
    }
  };

  // Renkleri yükle
  const loadColors = async () => {
    try {
      const { data } = await axios.get("/api/colors");
      setColors(data);
    } catch {
      setError("Renkler yüklenemedi");
    }
  };

  // Dummy scale API’den ağırlık oku
  const loadWeight = async () => {
    try {
      const { data } = await axios.get("/api/scale");
      setWeight(data.weight);
    } catch (error: any) {
      console.error("Tartı okunamadı:", error.response?.data?.error || error.message);
      setWeight("Tartı bağlı değil");
    }
  };

  useEffect(() => {
    loadTypes();
    loadColors();

    // her 2 saniyede bir tartıdan ağırlık oku
    const interval = setInterval(loadWeight, 2000);
    return () => clearInterval(interval);
  }, []);

  // Form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await axios.post("/api/fabric-entries", {
        fabricTypeId: Number(selectedType),
        colorId: Number(selectedColor),
        quantityKg: parseFloat(useManualWeight ? manualWeight : weight),
      });

      setSuccess("Kayıt başarıyla eklendi ✅");
      setSelectedType("");
      setSelectedColor("");
      setWeight("0");
      setManualWeight("");
    } catch (e: any) {
      setError(e?.response?.data?.error || "Kayıt eklenemedi");
    } finally {
      setLoading(false);
    }
  };

  // Add new fabric type
  const handleAddType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName.trim()) return;
    try {
      const { data } = await axios.post("/api/fabric-types", { name: newTypeName });
      setFabricTypes((prev) => [...prev, data]);
      setNewTypeName("");
      setShowAddType(false);
    } catch {
      setError("Kumaş türü eklenemedi");
    }
  };

  // Add new color
  const handleAddColor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColorName.trim()) return;
    try {
      const { data } = await axios.post("/api/colors", { name: newColorName });
      setColors((prev) => [...prev, data]);
      setNewColorName("");
      setShowAddColor(false);
    } catch {
      setError("Renk eklenemedi");
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Kumaş Girişi</h1>

        {error && <div className="bg-red-100 text-red-700 p-2 mb-4">{error}</div>}
        {success && <div className="bg-green-100 text-green-700 p-2 mb-4">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Kumaş Türü */}
          <div>
            <label className="block mb-1 font-medium">Kumaş Türü</label>
            <div className="flex gap-2">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                required
                className="w-full border rounded p-2"
              >
                <option value="">Seçiniz</option>
                {fabricTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button type="button" className="bg-green-500 text-white px-2 rounded" onClick={() => setShowAddType((v) => !v)}>
                +
              </button>
            </div>
            {showAddType && (
              <form onSubmit={handleAddType} className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  placeholder="Yeni tür adı"
                  className="border rounded p-2 flex-1"
                  required
                />
                <button type="submit" className="bg-blue-600 text-white px-3 rounded">Ekle</button>
              </form>
            )}
          </div>

          {/* Renk */}
          <div>
            <label className="block mb-1 font-medium">Renk</label>
            <div className="flex gap-2">
              <select
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                required
                className="w-full border rounded p-2"
              >
                <option value="">Seçiniz</option>
                {colors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button type="button" className="bg-green-500 text-white px-2 rounded" onClick={() => setShowAddColor((v) => !v)}>
                +
              </button>
            </div>
            {showAddColor && (
              <form onSubmit={handleAddColor} className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newColorName}
                  onChange={(e) => setNewColorName(e.target.value)}
                  placeholder="Yeni renk adı"
                  className="border rounded p-2 flex-1"
                  required
                />
                <button type="submit" className="bg-blue-600 text-white px-3 rounded">Ekle</button>
              </form>
            )}
          </div>

          {/* Tartıdan gelen kg veya manuel giriş */}
          <div>
            <label className="block mb-1 font-medium">Ağırlık (kg)</label>
            <div className="flex items-center gap-4">
              <input
                type="text"
                value={useManualWeight ? manualWeight : weight}
                onChange={(e) => useManualWeight ? setManualWeight(e.target.value) : undefined}
                className={`w-full border rounded p-2 ${useManualWeight ? '' : 'bg-gray-100'}`}
                readOnly={!useManualWeight}
                placeholder="Ağırlık (kg)"
              />
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={useManualWeight}
                  onChange={() => setUseManualWeight((v) => !v)}
                />
                Manuel
              </label>
            </div>
            <p className="text-sm text-gray-500">
              {useManualWeight ? "Manuel giriş aktif" : "Tartıdan otomatik okunuyor (dummy)"}
            </p>
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
};

export default FabricEntryPage;
