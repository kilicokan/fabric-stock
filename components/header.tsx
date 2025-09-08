// pages/fabrics/index.tsx
import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { fabricService } from '../../lib/api';

export default function FabricsPage() {
  const [fabrics, setFabrics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFabrics = async () => {
      try {
        const response = await fabricService.getFabrics();
        setFabrics(response.data);
      } catch (error) {
        console.error('Kumaşlar yüklenirken hata:', error);
      } finally {
        setLoading(false);
      }
    };
    loadFabrics();
  }, []);

  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Kumaş Listesi</h1>
        {loading ? (
          <p>Yükleniyor...</p>
        ) : (
          <table className="min-w-full bg-white">
            {/* Tablo içeriği */}
          </table>
        )}
      </div>
    </Layout>
  );
}