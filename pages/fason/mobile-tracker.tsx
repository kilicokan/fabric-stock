import React from 'react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { trackingAPI, workOrdersAPI, workshopsAPI } from '../../src/shared/api';
import { colors, gradients, statusColors } from '../../src/shared/theme';
import {
  Package,
  Clock,
  CheckCircle,
  Truck,
  AlertCircle,
  ArrowLeft,
  MapPin,
  Search,
  ChevronDown,
  User,
  Save,
  RotateCcw,
} from 'lucide-react';

const MobileTracker = () => {
  const router = useRouter();
  const [workOrders, setWorkOrders] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [location, setLocation] = useState(null);
  const [activeFilter, setActiveFilter] = useState('Tümü');

  const [formData, setFormData] = useState({
    processType: 'DIKIM',
    status: 'ALINDI',
    workshopId: '',
    notes: '',
    problemNotes: '',
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchWorkOrders(), fetchWorkshops()]);
      await getCurrentLocation();
    } catch (error) {
      alert('Hata: Veriler yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkOrders = async () => {
    try {
      const response = await workOrdersAPI.getAll();
      // Sadece assignedToMobile true olan iş emirlerini al
      const mobileAssignedOrders = (response.data.workOrders || []).filter(
        (order: any) => order.assignedToMobile === true
      );
      setWorkOrders(mobileAssignedOrders);
    } catch (error) {
      console.error('İş emirleri yüklenirken hata:', error);
      alert('Hata: İş emirleri yüklenemedi');
    }
  };

  const fetchWorkshops = async () => {
    try {
      const response = await workshopsAPI.getAll();
      setWorkshops(response.data || []);
    } catch (error) {
      console.error('Atölyeler yüklenirken hata:', error);
    }
  };

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      alert('Uyarı: Konum servisi desteklenmiyor.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.error('Konum hatası:', error);
        alert('Uyarı: Konum bilgisi alınamadı.');
      }
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInitialData();
    setRefreshing(false);
  };

  const handleSubmit = async () => {
    if (!selectedOrder) return;

    setLoading(true);
    try {
      const trackingData = {
        workOrderId: selectedOrder.id,
        workshopId: formData.workshopId || null,
        processType: formData.processType,
        status: formData.status,
        pickupDate: formData.status === 'ALINDI' ? new Date().toISOString() : null,
        deliveryDate: formData.status === 'TESLIM_EDILDI' ? new Date().toISOString() : null,
        notes: formData.notes,
        problemNotes: formData.problemNotes,
        latitude: location?.lat,
        longitude: location?.lng,
      };

      console.log('Gönderilen veri:', trackingData); // Debug için

      const response = await trackingAPI.create(trackingData);

      console.log('API yanıtı:', response); // Debug için

      alert('Başarılı: Takip kaydı başarıyla oluşturuldu!');

      // Formu sıfırla
      setFormData({
        processType: 'DIKIM',
        status: 'ALINDI',
        workshopId: '',
        notes: '',
        problemNotes: '',
      });
      setSelectedOrder(null);
      await fetchWorkOrders();
    } catch (error) {
      console.error('Kayıt hatası:', error);

      // Daha detaylı hata mesajı göster
      let errorMessage = 'Hata: Kayıt sırasında hata oluştu!';
      if (error.response?.data?.error) {
        errorMessage = `Hata: ${error.response.data.error}`;
      } else if (error.message) {
        errorMessage = `Hata: ${error.message}`;
      }

      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, any> = {
      ALINDI: Package,
      ATÖLYEDE: Clock,
      HAZIR: CheckCircle,
      TESLIM_EDILDI: Truck,
      SORUN_VAR: AlertCircle,
    };
    return icons[status] || Clock;
  };

  const getStatusColor = (status: string) => {
    return (statusColors as any)[status]?.background || colors.textLight;
  };

  const getStatusGradient = (status: string) => {
    const gradientsMap: Record<string, string[]> = {
      ALINDI: ['#3B82F6', '#1D4ED8'],
      ATÖLYEDE: ['#F59E0B', '#D97706'],
      HAZIR: ['#10B981', '#059669'],
      TESLIM_EDILDI: ['#059669', '#047857'],
      SORUN_VAR: ['#EF4444', '#DC2626'],
    };
    return gradientsMap[status] || ['#6B7280', '#4B5563'];
  };

  const getPriorityStyle = (priority: string) => {
    const stylesMap: Record<string, { backgroundColor: string; color: string }> = {
      YÜKSEK: { backgroundColor: '#FEE2E2', color: '#DC2626' },
      ORTA: { backgroundColor: '#FEF3C7', color: '#D97706' },
      DÜŞÜK: { backgroundColor: '#D1FAE5', color: '#059669' },
    };
    return stylesMap[priority] || { backgroundColor: '#F3F4F6', color: '#374151' };
  };

  // Filtrelenmiş iş emirleri - sadece assignedToMobile true olanlar ve arama/seçim kriterlerine uyanlar
  const filteredOrders = workOrders.filter(order =>
    (order.orderNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customerName?.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (activeFilter === 'Tümü' || order.status === activeFilter)
  );

  const statusFilters = ['Tümü', 'ALINDI', 'ATÖLYEDE', 'HAZIR', 'TESLIM_EDILDI', 'SORUN_VAR'];

  if (loading && !refreshing) {
    return (
      <div className="flex-1 justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-gray-600 text-lg">Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-700 p-6 pb-5">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <button
              className="p-2 mr-2"
              onClick={() => router.back()}
            >
              <ArrowLeft size={24} color="#FFFFFF" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">MIRA STOK</h1>
              <p className="text-sm text-white/90 mt-1">
                {selectedOrder ? 'İş Emri Detayı' : 'Mobil Takip'}
              </p>
            </div>
          </div>
          {location && (
            <div className="flex items-center bg-white/20 px-3 py-1.5 rounded-full">
              <MapPin size={16} color="#10B981" />
              <span className="text-xs font-medium text-green-400 ml-1">Konum Aktif</span>
            </div>
          )}
        </div>

        {/* İstatistikler */}
        {!selectedOrder && (
          <div className="flex justify-between bg-white/20 rounded-xl p-4">
            <div className="text-center flex-1">
              <p className="text-xl font-bold text-white mb-1">{workOrders.length}</p>
              <p className="text-xs text-white/90">Toplam Sipariş</p>
            </div>
            <div className="text-center flex-1">
              <p className="text-xl font-bold text-white mb-1">
                {workOrders.filter((o: any) => o.status === 'ATÖLYEDE').length}
              </p>
              <p className="text-xs text-white/90">Devam Eden</p>
            </div>
            <div className="text-center flex-1">
              <p className="text-xl font-bold text-white mb-1">
                {workOrders.filter((o: any) => o.status === 'SORUN_VAR').length}
              </p>
              <p className="text-xs text-white/90">Sorunlu</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!selectedOrder ? (
          // İş Emri Listesi
          <div className="p-4">
            {/* Arama Çubuğu */}
            <div className="relative mb-4">
              <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Sipariş no, ürün kodu veya müşteri ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Durum Filtreleri */}
            <div className="flex gap-2 mb-4 overflow-x-auto">
              {statusFilters.map((filter) => (
                <button
                  key={filter}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                    activeFilter === filter
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                  onClick={() => setActiveFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* İş Emri Listesi Başlığı */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Atanmış İş Emirleri</h2>
              <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm">
                {filteredOrders.length} adet
              </span>
            </div>

            {/* İş Emirleri */}
            <div className="space-y-3">
              {filteredOrders.map((order: any) => (
                <div
                  key={order.id}
                  className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedOrder(order)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <span className="font-bold text-lg text-gray-900 mr-2">{order.orderNo}</span>
                        {order.priority && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            order.priority === 'YÜKSEK' ? 'bg-red-100 text-red-700' :
                            order.priority === 'ORTA' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {order.priority}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700 font-medium mb-1">{order.productCode}</p>
                      {order.productName && (
                        <p className="text-gray-600 text-sm mb-2">{order.productName}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center">
                          <User size={14} className="mr-1" />
                          {order.customerName}
                        </div>
                        <div className="flex items-center">
                          <Package size={14} className="mr-1" />
                          {order.quantity} adet
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="bg-blue-500 p-2 rounded-lg mb-2">
                        {React.createElement(getStatusIcon(order.status), { size: 20, color: "#FFFFFF" })}
                      </div>
                      <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium">
                        {order.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredOrders.length === 0 && (
              <div className="text-center py-12">
                <Package size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 text-lg font-medium mb-2">
                  {searchTerm ? 'Sonuç bulunamadı' : 'Atanmış iş emri bulunamadı'}
                </p>
                <p className="text-gray-400 text-sm">
                  {searchTerm
                    ? 'Arama kriterlerinize uygun iş emri bulunamadı.'
                    : 'Web panelinden size atanmış iş emri bulunmuyor.'
                  }
                </p>
              </div>
            )}
          </div>
        ) : (
          // Takip Formu
          <div className="p-4">
            {/* Seçili İş Emri Bilgisi */}
            <div className="bg-gradient-to-r from-purple-500 to-purple-700 rounded-xl p-6 mb-6 text-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Seçili İş Emri</h3>
                <button
                  className="text-white underline"
                  onClick={() => setSelectedOrder(null)}
                >
                  Değiştir
                </button>
              </div>
              <h4 className="text-2xl font-bold mb-2">{selectedOrder.orderNo}</h4>
              <p className="text-purple-100 font-medium mb-1">{selectedOrder.productCode}</p>
              {selectedOrder.productName && (
                <p className="text-purple-200 text-sm mb-3">{selectedOrder.productName}</p>
              )}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center">
                  <User size={16} className="mr-2" />
                  {selectedOrder.customerName}
                </div>
                <div className="flex items-center">
                  <Package size={16} className="mr-2" />
                  {selectedOrder.quantity} adet
                </div>
              </div>
            </div>

            {/* Takip Formu */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              {/* Süreç Tipi */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Süreç Tipi</label>
                <div className="flex justify-between items-center bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                  <span className="text-gray-900">
                    {formData.processType === 'DIKIM' && 'Dikim'}
                    {formData.processType === 'BASKI_NAKIS' && 'Baskı/Nakış'}
                    {formData.processType === 'UTU' && 'Ütü'}
                  </span>
                  <ChevronDown size={20} className="text-gray-400" />
                </div>
              </div>

              {/* Durum Seçimi */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">Durum</label>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {[
                    { value: 'ALINDI', label: 'Alındı', icon: Package },
                    { value: 'ATÖLYEDE', label: 'Atölyede', icon: Clock },
                    { value: 'HAZIR', label: 'Hazır', icon: CheckCircle },
                    { value: 'TESLIM_EDILDI', label: 'Teslim Edildi', icon: Truck },
                    { value: 'SORUN_VAR', label: 'Sorun Var', icon: AlertCircle },
                  ].map((status) => (
                    <button
                      key={status.value}
                      className={`flex items-center px-4 py-3 rounded-lg font-medium whitespace-nowrap ${
                        formData.status === status.value
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                      onClick={() => setFormData({ ...formData, status: status.value })}
                    >
                      <status.icon size={20} className="mr-2" />
                      {status.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Atölye Seçimi */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Atölye (Opsiyonel)</label>
                <div className="flex justify-between items-center bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                  <span className="text-gray-900">
                    {formData.workshopId
                      ? workshops.find((w: any) => w.id === formData.workshopId)?.name || 'Atölye seçin'
                      : 'Atölye seçin'
                    }
                  </span>
                  <ChevronDown size={20} className="text-gray-400" />
                </div>
              </div>

              {/* Notlar */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Notlar</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Genel notlar..."
                />
              </div>

              {/* Sorun Notları */}
              {formData.status === 'SORUN_VAR' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-red-600 mb-2">Sorun Açıklaması</label>
                  <textarea
                    className="w-full px-3 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 h-24 resize-none"
                    value={formData.problemNotes}
                    onChange={(e) => setFormData({ ...formData, problemNotes: e.target.value })}
                    placeholder="Yaşanan sorunu detaylandırın..."
                  />
                </div>
              )}

              {/* Kaydet Butonu */}
              <button
                className={`w-full py-4 px-6 rounded-lg font-semibold text-white flex items-center justify-center ${
                  loading ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'
                }`}
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                ) : (
                  <>
                    <Save size={20} className="mr-3" />
                    Takip Kaydını Kaydet
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileTracker;
