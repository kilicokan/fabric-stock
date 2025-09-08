import { useState, useEffect } from "react";
import axios from "axios";

interface Product {
  id: number;
  modelNo: string;
  name: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [modelNo, setModelNo] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchProducts = async () => {
    try {
      const { data } = await axios.get("/api/products");
      setProducts(data);
    } catch (err) {
      console.error("Fetch Products Error:", err);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelNo || !name) return alert("Model No ve Ürün adı gerekli");

    try {
      setLoading(true);
      await axios.post("/api/products", { modelNo, name });
      setModelNo("");
      setName("");
      fetchProducts();
    } catch (err) {
      console.error("Add Product Error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Ürün Ekle</h1>

      <form onSubmit={handleAdd} className="mb-6 space-y-2">
        <input
          type="text"
          placeholder="Model No"
          value={modelNo}
          onChange={(e) => setModelNo(e.target.value)}
          className="w-full p-2 border rounded"
          required
        />
        <input
          type="text"
          placeholder="Ürün Adı"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-2 border rounded"
          required
        />
        <button
          type="submit"
          className="bg-purple-600 text-white px-4 py-2 rounded"
          disabled={loading}
        >
          {loading ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </form>

      <div>
        <h2 className="text-xl font-semibold mb-2">Mevcut Ürünler</h2>
        {products.map((p) => (
          <div key={p.id} className="border p-2 mb-1 rounded">
            {p.modelNo} - {p.name}
          </div>
        ))}
      </div>
    </div>
  );
}
