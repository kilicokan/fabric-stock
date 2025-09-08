// pages/fabrics/index.tsx
import { useState, useEffect } from 'react';
import Layout from '../../components/Layout/Layout';
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
          <table className="min-w-full bg-white border border-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 border-b">ID</th>
                <th className="px-4 py-2 border-b">Model No</th>
                <th className="px-4 py-2 border-b">Adı</th>
              </tr>
            </thead>
            <tbody>
              {fabrics.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-4">Kayıt yok</td>
                </tr>
              ) : (
                fabrics.map((fabric: any) => (
                  <tr key={fabric.id}>
                    <td className="px-4 py-2 border-b">{fabric.id}</td>
                    <td className="px-4 py-2 border-b">{fabric.modelNo}</td>
                    <td className="px-4 py-2 border-b">{fabric.name}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}