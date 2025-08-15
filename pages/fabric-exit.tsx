// pages/fabric-exit.tsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';

export default function FabricExit() {
  const [formData, setFormData] = useState({
    modelNo: '',
    orderNo: '',
    customerId: '',
    layerCount: 1,
    grammage: 0,
    externalProductId: ''
  });

  const [products, setProducts] = useState([]);
  const [externalProducts, setExternalProducts] = useState([]);
  const [loading, setLoading] = useState({
    products: false,
    external: false,
    submit: false
  });
  const [error, setError] = useState('');

  const router = useRouter();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(prev => ({ ...prev, products: true }));
        const response = await axios.get('/api/products');
        setProducts(response.data);
      } catch (err) {
        setError('Sistem ürünleri yüklenemedi');
        console.error(err);
      } finally {
        setLoading(prev => ({ ...prev, products: false }));
      }
    };
    fetchProducts();
  }, []);

  const fetchExternalProducts = async () => {
    try {
      setLoading(prev => ({ ...prev, external: true }));
      setError('');
      const response = await axios.get('/api/external-products');
      setExternalProducts(response.data);
    } catch (err) {
      setError('Dış sistem ürünleri alınamadı');
      console.error(err);
    } finally {
      setLoading(prev => ({ ...prev, external: false }));
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(prev => ({ ...prev, submit: true }));
      setError('');
      await axios.post('/api/fabric-exits', formData);
      router.push('/success');
    } catch (err) {
      setError(err.response?.data?.error || 'Kayıt işlemi başarısız oldu');
      console.error(err);
    } finally {
      setLoading(prev => ({ ...prev, submit: false }));
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">📤 Kumaş Çıkış Formu</h1>
      
      {error && <div className="bg-red-100 text-red-700 p-3 mb-4 rounded">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Satır: Sistem Model No, Sipariş No, Müşteri */}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block mb-2 font-medium">Model No (Sistem)</label>
            <select
              name="modelNo"
              value={formData.modelNo}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              required
              disabled={loading.products}
            >
              <option value="">Seçiniz</option>
              {products.map(product => (
                <option key={product.id} value={product.modelNo}>
                  {product.modelNo} - {product.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block mb-2 font-medium">Sipariş No</label>
            <input
              type="text"
              name="orderNo"
              value={formData.orderNo}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              required
            />
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block mb-2 font-medium">Müşteri ID</label>
            <input
              type="text"
              name="customerId"
              value={formData.customerId}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              required
            />
          </div>
        </div>

        {/* 2. Satır: Kat Sayısı, Gramaj, Dış Sistem */}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block mb-2 font-medium">Kat Sayısı</label>
            <input
              type="number"
              name="layerCount"
              value={formData.layerCount}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              min="1"
            />
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block mb-2 font-medium">Gramaj (g/m²)</label>
            <input
              type="number"
              name="grammage"
              value={formData.grammage}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              step="0.01"
            />
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block mb-2 font-medium">Model No (Dış Sistem)</label>
            <div className="flex gap-2">
              <select
                name="externalProductId"
                value={formData.externalProductId}
                onChange={handleChange}
                className="flex-1 p-2 border rounded"
              >
                <option value="">Seçiniz</option>
                {externalProducts.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.description}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={fetchExternalProducts}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-blue-300 whitespace-nowrap"
                disabled={loading.external}
              >
                {loading.external ? '...' : 'Getir'}
              </button>
            </div>
          </div>
        </div>

        {/* Kaydet Butonu */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:bg-green-300 min-w-[150px]"
            disabled={loading.submit}
          >
            {loading.submit ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>
    </div>
  );
}
