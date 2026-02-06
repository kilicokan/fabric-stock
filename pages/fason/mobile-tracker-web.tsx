import React, { useState, useEffect } from 'react';
import { Truck, RefreshCw, AlertCircle, CheckCircle, Clock, Package } from 'lucide-react';

interface WorkOrder {
  id: number;
  orderNo: string;
  productCode: string;
  productName: string;
  quantity: number;
  customerName: string;
  status: string;
  priority: string;
  dueDate: string;
  unit: string;
  workshopName: string;
  progress: number;
  remainingDays: number | null;
  createdAt: string;
}

const MobileTrackerWeb: React.FC = () => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [filteredStatus, setFilteredStatus] = useState('all');

  const fetchWorkOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/fason/work-orders/mobile');
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      
      const data = await response.json();
      setWorkOrders(data.workOrders || []);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Veriler yüklenirken hata oluştu');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchWorkOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'pending': 'bg-gray-500',
      'in-progress': 'bg-blue-500',
      'completed': 'bg-green-500'
    };
    return colors[status] || 'bg-gray-500';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <AlertCircle className="w-5 h-5" />;
      case 'in-progress':
        return <Clock className="w-5 h-5" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5" />;
      default:
        return <Package className="w-5 h-5" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    const colors: { [key: string]: string } = {
      'normal': 'text-green-600',
      'medium': 'text-yellow-600',
      'high': 'text-red-600'
    };
    return colors[priority] || 'text-gray-600';
  };

  const getProgressColor = (progress: number) => {
    if (progress < 25) return 'bg-red-500';
    if (progress < 50) return 'bg-orange-500';
    if (progress < 75) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const filteredOrders = workOrders.filter(order => {
    if (filteredStatus === 'all') return true;
    return order.status === filteredStatus;
  });

  const statusStats = {
    pending: workOrders.filter(o => o.status === 'pending').length,
    'in-progress': workOrders.filter(o => o.status === 'in-progress').length,
    completed: workOrders.filter(o => o.status === 'completed').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Truck className="w-8 h-8 text-white" />
              <div>
                <h1 className="text-2xl font-bold text-white">Mobil Takip</h1>
                <p className="text-indigo-100 text-sm">
                  {lastUpdate ? `Son güncelleme: ${lastUpdate.toLocaleTimeString('tr-TR')}` : 'Yükleniyor...'}
                </p>
              </div>
            </div>
            <button
              onClick={fetchWorkOrders}
              disabled={loading}
              className="flex items-center gap-2 bg-white text-purple-600 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Yenile
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/10 backdrop-blur border border-white/20 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-white">{statusStats.pending}</div>
            <div className="text-gray-300 text-sm mt-1">Başlama Bekliyor</div>
          </div>
          <div className="bg-white/10 backdrop-blur border border-white/20 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-blue-400">{statusStats['in-progress']}</div>
            <div className="text-gray-300 text-sm mt-1">İşleniyor</div>
          </div>
          <div className="bg-white/10 backdrop-blur border border-white/20 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-green-400">{statusStats.completed}</div>
            <div className="text-gray-300 text-sm mt-1">Tamamlandı</div>
          </div>
        </div>
      </div>

      {/* Status Filter */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'in-progress', 'completed'].map(status => (
            <button
              key={status}
              onClick={() => setFilteredStatus(status)}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                filteredStatus === status
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              {status === 'all' && 'Tümü'}
              {status === 'pending' && 'Beklemede'}
              {status === 'in-progress' && 'İşleniyor'}
              {status === 'completed' && 'Tamamlandı'}
            </button>
          ))}
        </div>
      </div>

      {/* Work Orders Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 pb-8">
        {loading && filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
            <p className="text-gray-300">İş emirleri yükleniyor...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white/10 backdrop-blur border border-white/20 rounded-lg p-8 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-300">Hiç iş emri bulunamadı</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map(order => (
              <div
                key={order.id}
                className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur border border-white/20 rounded-lg p-4 hover:border-white/40 transition group"
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="text-white font-bold text-lg">{order.orderNo}</h3>
                    <p className="text-gray-400 text-sm">{order.productCode}</p>
                  </div>
                  <div className={`flex items-center justify-center w-10 h-10 rounded-lg text-white ${getStatusColor(order.status)}`}>
                    {getStatusIcon(order.status)}
                  </div>
                </div>

                {/* Product Info */}
                <div className="mb-3 pb-3 border-b border-white/10">
                  <p className="text-gray-300 text-sm mb-1">{order.productName || 'Tanımlı ürün yok'}</p>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Müşteri: {order.customerName}</span>
                    <span className={`font-semibold ${getPriorityColor(order.priority)}`}>
                      {order.priority === 'normal' && 'Normal'}
                      {order.priority === 'medium' && 'Orta'}
                      {order.priority === 'high' && 'Yüksek'}
                    </span>
                  </div>
                </div>

                {/* Quantity & Workshop */}
                <div className="mb-3 pb-3 border-b border-white/10">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Miktar: {order.quantity} {order.unit}</span>
                    <span className="text-gray-400">İlerleme: {order.progress}%</span>
                  </div>
                  {order.workshopName && (
                    <p className="text-xs text-indigo-300">Atölye: {order.workshopName}</p>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="mb-3 pb-3 border-b border-white/10">
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all ${getProgressColor(order.progress)}`}
                      style={{ width: `${order.progress}%` }}
                    />
                  </div>
                </div>

                {/* Due Date */}
                {order.remainingDays !== null && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Kalan Gün:</span>
                    <span className={
                      order.remainingDays < 0 ? 'text-red-400 font-bold' :
                      order.remainingDays <= 2 ? 'text-orange-400' :
                      'text-green-400'
                    }>
                      {order.remainingDays < 0 ? `${Math.abs(order.remainingDays)} gün geç` : `${order.remainingDays} gün`}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileTrackerWeb;
