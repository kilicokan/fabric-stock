import { useEffect, useState } from "react";
import axios from "axios";

const DebugPage = () => {
  const [info, setInfo] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSystem = async () => {
      const debugInfo: any = {};
      
      // Check localStorage
      if (typeof window !== 'undefined') {
        debugInfo.hasToken = !!localStorage.getItem('token');
        debugInfo.token = localStorage.getItem('token');
      }

      // Check API
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const response = await axios.get('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          debugInfo.apiResponse = response.data;
          debugInfo.apiStatus = 'success';
        } else {
          debugInfo.apiStatus = 'no token';
        }
      } catch (error: any) {
        debugInfo.apiStatus = 'error';
        debugInfo.apiError = error.message;
        debugInfo.apiErrorDetails = error.response?.data;
      }

      setInfo(debugInfo);
      setLoading(false);
    };

    checkSystem();
  }, []);

  if (loading) {
    return <div className="p-4">Sistem kontrol ediliyor...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">🔍 Sistem Debug Bilgileri</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Token Durumu</h2>
          <p><strong>Token var mı:</strong> {info.hasToken ? '✅ Evet' : '❌ Hayır'}</p>
          <p><strong>Token:</strong> {info.token ? `${info.token.substring(0, 50)}...` : 'Yok'}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">API Durumu</h2>
          <p><strong>API Status:</strong> {info.apiStatus}</p>
          {info.apiResponse && (
            <>
              <p><strong>Kullanıcı:</strong> {JSON.stringify(info.apiResponse.user, null, 2)}</p>
            </>
          )}
          {info.apiError && (
            <>
              <p><strong>API Error:</strong> {info.apiError}</p>
              <pre className="bg-red-50 p-4 rounded mt-2 text-sm overflow-auto">
                {JSON.stringify(info.apiErrorDetails, null, 2)}
              </pre>
            </>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Test Butonları</h2>
          <div className="space-y-2">
            <button 
              onClick={() => window.location.href = '/login'}
              className="bg-blue-600 text-white px-4 py-2 rounded mr-2"
            >
              Login Sayfasına Git
            </button>
            <button 
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="bg-red-600 text-white px-4 py-2 rounded mr-2"
            >
              Cache Temizle
            </button>
            <button 
              onClick={() => window.location.href = '/'}
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              Ana Sayfaya Git
            </button>
          </div>
        </div>

        <div className="mt-6 bg-gray-800 text-green-400 p-4 rounded">
          <pre className="text-xs overflow-auto">
{JSON.stringify(info, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default DebugPage;
