import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ChevronLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '@/components/AuthContext';

type User = {
  id: number;
  name?: string;
  email?: string;
};

export default function AddVehiclePage() {
  const router = useRouter();
  const { authenticated } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    licensePlate: '',
    model: '',
    color: '',
    capacity: '',
    assignedUserId: '',
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && authenticated) {
      fetchUsers();
    }
  }, [authenticated]);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const response = await api.get('/users', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUsers(response.data || []);
    } catch (err) {
      console.error('Kullanıcılar yüklenirken hata:', err);
    }
  };

  const handleSubmit = async () => {
    if (!formData.licensePlate.trim()) {
      setError('Plaka adı gereklidir');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      await api.post('/vehicles', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      router.push('/vehicles');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Araç eklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setError('');
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/vehicles')}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Geri Dön
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Yeni Araç Ekle</h1>
            <p className="text-muted-foreground mt-2">
              Araç bilgilerini girerek yeni bir araç kaydı oluşturunuz
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {/* Form Card */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100">
            <CardTitle className="text-xl">Araç Bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            {/* Plaka - Required */}
            <div>
              <label className="block text-sm font-medium mb-3">
                Plaka <span className="text-red-600">*</span>
              </label>
              <Input
                placeholder="Örn: 35 XXX XXX"
                value={formData.licensePlate}
                onChange={(e) => handleInputChange('licensePlate', e.target.value)}
                disabled={loading}
                className="text-base"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Araç plakasını tam olarak yazınız (Örn: 35 ABC 1234)
              </p>
            </div>

            {/* Model */}
            <div>
              <label className="block text-sm font-medium mb-3">Model</label>
              <Input
                placeholder="Örn: Mercedes Sprinter 310"
                value={formData.model}
                onChange={(e) => handleInputChange('model', e.target.value)}
                disabled={loading}
                className="text-base"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Araç modeli ve tipi yazınız
              </p>
            </div>

            {/* Renk */}
            <div>
              <label className="block text-sm font-medium mb-3">Renk</label>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Input
                    placeholder="Örn: Beyaz, Siyah, Gri..."
                    value={formData.color}
                    onChange={(e) => handleInputChange('color', e.target.value)}
                    disabled={loading}
                    className="text-base"
                  />
                </div>
                {formData.color && (
                  <div className="flex items-center gap-2">
                    <div
                      className="w-12 h-12 rounded border-2 border-gray-300"
                      style={{
                        backgroundColor: formData.color.toLowerCase(),
                      }}
                    />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Renk adını yazınız (preview görselle)
              </p>
            </div>

            {/* Kapasite */}
            <div>
              <label className="block text-sm font-medium mb-3">Kapasite (kg)</label>
              <Input
                type="number"
                placeholder="Örn: 1000"
                value={formData.capacity}
                onChange={(e) => handleInputChange('capacity', e.target.value)}
                disabled={loading}
                className="text-base"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Araç taşıyabildiği maksimum ağırlığı kilogram cinsinden yazınız
              </p>
            </div>

            {/* Sorumlu Kişi */}
            <div>
              <label className="block text-sm font-medium mb-3">Sorumlu Kişi</label>
              <select
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm disabled:opacity-50"
                value={formData.assignedUserId}
                onChange={(e) => handleInputChange('assignedUserId', e.target.value)}
                disabled={loading}
              >
                <option value="">-- Sorumlu Kişi Seçiniz --</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Bu araçtan sorumlu kullanıcıyı seçiniz (opsiyonel)
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => router.push('/vehicles')}
                disabled={loading}
                className="flex-1"
              >
                İptal
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 gap-2"
              >
                {loading ? 'Ekleniyor...' : 'Araç Ekle'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Info Box */}
        <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">Ipuçları</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Plaka benzersiz olmalı ve aynı plaka ile başka araç kaydı olamaz</li>
            <li>Sorumlu kişi atarsanız, sadece o kişi bu araçın konumunu güncelleyebilir</li>
            <li>Tüm alanlar doldurmasanız da araç eklenebilir (sadece plaka zorunlu)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
