import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, MapPin, Phone, X, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/components/AuthContext';

type Vehicle = {
  id: number;
  licensePlate: string;
  model?: string;
  color?: string;
  capacity?: number;
  isActive: boolean;
  assignedUser?: {
    id: number;
    name?: string;
    email?: string;
  };
  locations?: Array<{
    latitude: number;
    longitude: number;
    address?: string;
    timestamp: string;
  }>;
};

type VehicleLocation = {
  id: number;
  vehicleId: number;
  latitude: number;
  longitude: number;
  address?: string;
  timestamp: string;
};

type User = {
  id: number;
  name?: string;
  email?: string;
};

export default function VehiclesPage() {
  const router = useRouter();
  const { authenticated } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [locations, setLocations] = useState<VehicleLocation[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [formData, setFormData] = useState({
    licensePlate: '',
    model: '',
    color: '',
    capacity: '',
    assignedUserId: '',
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && authenticated) {
      fetchVehicles();
      fetchUsers();
    }
  }, [authenticated]);

  const fetchVehicles = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('🚗 fetchVehicles - Token:', token ? 'Present' : 'Missing');
      
      if (!token) {
        console.error('❌ Token bulunamadı');
        setLoading(false);
        return;
      }
      
      console.log('📡 Fetching vehicles with token...');
      const response = await api.get('/vehicles', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      console.log('✅ Vehicles fetched:', response.data);
      setVehicles(response.data.data || []);
    } catch (error) {
      console.error('❌ Araçlar yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

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
    } catch (error) {
      console.error('Kullanıcılar yüklenirken hata:', error);
    }
  };

  const fetchLocations = async (vehicleId: number) => {
    try {
      setLocationsLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;
      const response = await api.get('/vehicles/location', {
        params: { vehicleId, limit: 50 },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setLocations(response.data?.data || response.data || []);
    } catch (error) {
      console.error('Konumlar yüklenirken hata:', error);
      setLocations([]);
    } finally {
      setLocationsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.licensePlate.trim()) {
      alert('Plaka adı gerekli');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const headers = {
        Authorization: `Bearer ${token}`,
      };
      
      if (editingId) {
        await api.put('/vehicles', { id: editingId, ...formData }, { headers });
      } else {
        await api.post('/vehicles', formData, { headers });
      }
      await fetchVehicles();
      setShowModal(false);
      resetForm();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Hata oluştu');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bu aracı silmek istediğinize emin misiniz?')) return;

    try {
      const token = localStorage.getItem('token');
      await api.delete('/vehicles', {
        data: { id },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      await fetchVehicles();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Silme hatası');
    }
  };

  const handleEdit = (vehicle: Vehicle) => {
    setFormData({
      licensePlate: vehicle.licensePlate,
      model: vehicle.model || '',
      color: vehicle.color || '',
      capacity: vehicle.capacity?.toString() || '',
      assignedUserId: vehicle.assignedUser?.id?.toString() || '',
    });
    setEditingId(vehicle.id);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      licensePlate: '',
      model: '',
      color: '',
      capacity: '',
      assignedUserId: '',
    });
    setEditingId(null);
  };

  const getLastLocation = (vehicle: Vehicle) => {
    if (!vehicle.locations || vehicle.locations.length === 0) {
      return null;
    }
    return vehicle.locations[0];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Araç Yönetimi</h1>
            <p className="text-muted-foreground mt-2">
              {vehicles.length} araç kayıtlı
            </p>
          </div>
          <Button
            onClick={() => router.push('/vehicles/add')}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Yeni Araç
          </Button>
        </div>

        {/* Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((vehicle) => {
            const lastLocation = getLastLocation(vehicle);
            return (
              <Card
                key={vehicle.id}
                className={`transition ${
                  !vehicle.isActive
                    ? 'opacity-60 bg-muted'
                    : 'hover:shadow-lg'
                }`}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div 
                      className="flex-1 cursor-pointer hover:opacity-80"
                      onClick={() => {
                        if (selectedVehicleId === vehicle.id) {
                          setSelectedVehicleId(null);
                        } else {
                          setSelectedVehicleId(vehicle.id);
                          fetchLocations(vehicle.id);
                        }
                      }}
                    >
                      <CardTitle className="text-xl font-bold text-blue-600">
                        {vehicle.licensePlate}
                      </CardTitle>
                      {vehicle.model && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {vehicle.model}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(vehicle)}
                      >
                        Düzenle
                      </Button>
                      <Button
                        variant="error"
                        size="sm"
                        onClick={() => handleDelete(vehicle.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Sorumlı Kişi */}
                  {vehicle.assignedUser && (
                    <div className="flex gap-2 items-start">
                      <Phone className="w-4 h-4 mt-1 text-muted-foreground" />
                      <div className="text-sm">
                        <p className="font-medium">{vehicle.assignedUser.name}</p>
                        <p className="text-muted-foreground">
                          {vehicle.assignedUser.email}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Renk */}
                  {vehicle.color && (
                    <div className="flex gap-2 items-center text-sm">
                      <div
                        className="w-4 h-4 rounded-full border"
                        style={{ backgroundColor: vehicle.color }}
                      />
                      <span>{vehicle.color}</span>
                    </div>
                  )}

                  {/* Kapasite */}
                  {vehicle.capacity && (
                    <p className="text-sm">
                      <span className="font-medium">Kapasite:</span> {vehicle.capacity} kg
                    </p>
                  )}

                  {/* Son Konum */}
                  {lastLocation && (
                    <div className="bg-muted p-3 rounded-lg">
                      <div className="flex gap-2 items-start">
                        <MapPin className="w-4 h-4 mt-1 text-blue-600" />
                        <div className="text-sm flex-1">
                          <p className="font-medium">Son Konum</p>
                          <p className="text-muted-foreground">
                            {lastLocation.latitude.toFixed(4)}, {lastLocation.longitude.toFixed(4)}
                          </p>
                          {lastLocation.address && (
                            <p className="text-xs text-muted-foreground">
                              {lastLocation.address}
                            </p>
                          )}
                          <p className="text-xs mt-1">
                            {new Date(lastLocation.timestamp).toLocaleString('tr-TR')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Durum */}
                  <div className="pt-2 border-t">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                        vehicle.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {vehicle.isActive ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {vehicles.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Henüz araç kaydı yok</p>
            <Button
              className="mt-4"
              onClick={() => router.push('/vehicles/add')}
            >
              İlk Aracı Ekle
            </Button>
          </div>
        )}

        {/* Location History Panel */}
        {selectedVehicleId && (
          <div className="mt-8">
            <Card>
              <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    {vehicles.find(v => v.id === selectedVehicleId)?.licensePlate} - Konum Geçmişi
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedVehicleId(null)}
                  >
                    Kapat
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {locationsLoading ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Konumlar yükleniyor...</p>
                  </div>
                ) : locations.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Bu araç için konum kaydı bulunamadı</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {locations.map((location, index) => (
                      <div
                        key={location.id}
                        className="p-4 border rounded-lg hover:bg-muted transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">
                            {index === 0 ? (
                              <div className="w-3 h-3 bg-green-500 rounded-full" />
                            ) : (
                              <div className="w-3 h-3 bg-gray-300 rounded-full" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                              <span className="font-mono text-sm font-medium text-gray-700">
                                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                              </span>
                            </div>
                            {location.address && (
                              <p className="text-sm text-muted-foreground mb-2 break-words">
                                {location.address}
                              </p>
                            )}
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {new Date(location.timestamp).toLocaleString('tr-TR')}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-lg font-bold">
                {editingId ? 'Araç Düzenle' : 'Yeni Araç Ekle'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Plaka*
                </label>
                <Input
                  placeholder="35 XXX XXX"
                  value={formData.licensePlate}
                  onChange={(e) =>
                    setFormData({ ...formData, licensePlate: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Model</label>
                <Input
                  placeholder="Mercedes Sprinter"
                  value={formData.model}
                  onChange={(e) =>
                    setFormData({ ...formData, model: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Renk</label>
                <Input
                  placeholder="Beyaz"
                  value={formData.color}
                  onChange={(e) =>
                    setFormData({ ...formData, color: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Kapasite (kg)
                </label>
                <Input
                  type="number"
                  placeholder="1000"
                  value={formData.capacity}
                  onChange={(e) =>
                    setFormData({ ...formData, capacity: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Sorumlu Kişi
                </label>
                <select
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                  value={formData.assignedUserId}
                  onChange={(e) =>
                    setFormData({ ...formData, assignedUserId: e.target.value })
                  }
                >
                  <option value="">-- Seçiniz --</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1"
                >
                  İptal
                </Button>
                <Button onClick={handleSubmit} className="flex-1">
                  {editingId ? 'Güncelle' : 'Ekle'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
