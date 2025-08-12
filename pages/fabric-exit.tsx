import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';

export default function FabricExit() {
  const [formData, setFormData] = useState({
    modelNo: '',
    orderNo: '',
    customerId: '',
    layerCount: '',
    grammage: '',
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

      <form onSubmit={handleSubmit}>
        {/* YATAY MENÜ TASARIMI */}
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          {/* SOL TARAF - Model Bilgileri */}
          <div className="flex-1 space-y-4">
            {/* Sistem Model No */}
            <div>
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
              {loading.products && <p className="text-sm text-gray-500 mt-1">Yükleniyor...</p>}
            </div>

            {/* Dış Sistem Model No */}
            <div>
              <label className="block mb-2 font-medium">Model No (Dış Sistem)</label>
              <div className="flex gap-2">
                <select
                  name="externalProductId"
                  value={formData.externalProductId}
                  onChange={handleChange}
                  className="flex-1 p-2 border rounded"
                  disabled={externalProducts.length === 0 || loading.external}
                >
                  <option value="">{externalProducts.length ? 'Seçiniz' : 'Ürünleri yükleyin'}</option>
                  {externalProducts.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.code} - {product.description}
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

          {/* SAĞ TARAF - Diğer Bilgiler */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sipariş No */}
            <div>
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

            {/* Müşteri ID */}
            <div>
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

            {/* Kat Sayısı */}
            <div>
              <label className="block mb-2 font-medium">Kat Sayısı</label>
              <input
                type="number"
                name="layerCount"
                value={formData.layerCount}
                onChange={handleChange}
                className="w-full p-2 border rounded"
                required
                min="1"
              />
            </div>

            {/* Gramaj */}
            <div>
              <label className="block mb-2 font-medium">Gramaj (g/m²)</label>
              <input
                type="number"
                name="grammage"
                value={formData.grammage}
                onChange={handleChange}
                className="w-full p-2 border rounded"
                required
                min="0"
                step="0.01"
              />
            </div>
          </div>
        </div>

        {/* Kaydet Butonu */}
        <div className="flex justify-end mt-6">
          <button
            type="submit"
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:bg-green-300 min-w-[150px]"
            disabled={loading.submit}
          >
            {loading.submit ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Kaydediliyor
              </span>
            ) : 'Kaydet'}
          </button>
        </div>
      </form>
    </div>
  );
}