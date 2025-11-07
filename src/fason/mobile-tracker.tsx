import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@mui/material';
import { useAuth } from '../../components/AuthContext';
import axios from 'axios';
import {
  MapPin,
  Clock,
  Save,
  AlertCircle,
  CheckCircle,
  Truck,
  Package,
  ArrowLeft,
  Search,
  User,
  Bell,
  Home,
  BarChart3,
  Settings,
  Star,
  Calendar
} from 'lucide-react';

interface WorkOrder {
  id: number;
  orderNo: string;
  productCode: string;
  productName?: string;
  quantity: number;
  customerName?: string;
  status: string;
  priority?: string;
  assignedToMobile: boolean; // ✅ Added missing property
}

interface FasonWorkshop {
  id: number;
  name: string;
  specialization: string;
}

const MobileTracker: React.FC = () => {
  const { user } = useAuth();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [workshops, setWorkshops] = useState<FasonWorkshop[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('Tümü');

  const [formData, setFormData] = useState({
    processType: 'DIKIM',
    status: 'ALINDI',
    workshopId: '',
    notes: '',
    problemNotes: ''
  });

  // Inline CSS as backup
  const styles = {
    primaryGradient: {
      background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
    },
    purpleGradient: {
      background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
    },
    blueGradient: {
      background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
    },
    greenGradient: {
      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    },
    redGradient: {
      background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
    },
    yellowGradient: {
      background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    },
    statusColors: {
      ALINDI: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
      ATÖLYEDE: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
      HAZIR: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
      TESLIM_EDILDI: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      SORUN_VAR: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
    },
    priorityColors: {
      YÜKSEK: '#EF4444',
      ORTA: '#F59E0B',
      DÜŞÜK: '#10B981'
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Fetch work orders
      const workOrdersResponse = await axios.get('/api/fason/work-orders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWorkOrders(workOrdersResponse.data.workOrders || []);

      // Fetch workshops
      const workshopsResponse = await axios.get('/api/fason/workshops', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWorkshops(workshopsResponse.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setWorkOrders([]);
      setWorkshops([]);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = () => {
    setLocation({ lat: 41.0082, lng: 28.9784 }); // Mock location
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      const trackingData = {
        workOrderId: selectedOrder.id,
        workshopId: formData.workshopId || null,
        processType: formData.processType,
        status: formData.status,
        notes: formData.notes,
        problemNotes: formData.problemNotes,
        latitude: location?.lat,
        longitude: location?.lng
      };

      await axios.post('/api/fason/tracking', trackingData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert('Takip kaydı başarıyla oluşturuldu!');
      setFormData({
        processType: 'DIKIM',
        status: 'ALINDI',
        workshopId: '',
        notes: '',
        problemNotes: ''
      });
      setSelectedOrder(null);
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error creating tracking:', error);
      alert('Kayıt sırasında hata oluştu!');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    const icons: { [key: string]: React.ReactNode } = {
      'ALINDI': <Package className="w-5 h-5" style={{ color: 'white' }} />,
      'ATÖLYEDE': <Clock className="w-5 h-5" style={{ color: 'white' }} />,
      'HAZIR': <CheckCircle className="w-5 h-5" style={{ color: 'white' }} />,
      'TESLIM_EDILDI': <Truck className="w-5 h-5" style={{ color: 'white' }} />,
      'SORUN_VAR': <AlertCircle className="w-5 h-5" style={{ color: 'white' }} />
    };
    return icons[status] || <Clock className="w-5 h-5" style={{ color: 'white' }} />;
  };

  const getStatusStyle = (status: string) => {
    const styleMap: { [key: string]: React.CSSProperties } = {
      'ALINDI': { background: styles.statusColors.ALINDI, color: 'white' },
      'ATÖLYEDE': { background: styles.statusColors.ATÖLYEDE, color: 'white' },
      'HAZIR': { background: styles.statusColors.HAZIR, color: 'white' },
      'TESLIM_EDILDI': { background: styles.statusColors.TESLIM_EDILDI, color: 'white' },
      'SORUN_VAR': { background: styles.statusColors.SORUN_VAR, color: 'white' }
    };
    return styleMap[status] || { backgroundColor: '#6B7280', color: 'white' };
  };

  const getPriorityStyle = (priority?: string) => {
    const styleMap: { [key: string]: React.CSSProperties } = {
      'YÜKSEK': { backgroundColor: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' },
      'ORTA': { backgroundColor: '#FEF3C7', color: '#D97706', border: '1px solid #FDE68A' },
      'DÜŞÜK': { backgroundColor: '#D1FAE5', color: '#059669', border: '1px solid #A7F3D0' }
    };
    return styleMap[priority || ''] || { backgroundColor: '#F3F4F6', color: '#374151' };
  };

  const filteredOrders = workOrders.filter(order =>
    order.assignedToMobile && // Only show orders assigned to mobile
    (order.orderNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customerName?.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (activeFilter === 'Tümü' || order.status === activeFilter)
  );

  const statusFilters = [
    { value: 'Tümü', style: styles.purpleGradient },
    { value: 'ALINDI', style: styles.blueGradient },
    { value: 'ATÖLYEDE', style: styles.yellowGradient },
    { value: 'HAZIR', style: styles.greenGradient },
    { value: 'TESLIM_EDILDI', style: { background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' } },
    { value: 'SORUN_VAR', style: styles.redGradient }
  ];

  const getFilterStyle = (filterValue: string) => {
    const filter = statusFilters.find(f => f.value === filterValue);
    return filter ? filter.style : { backgroundColor: '#9CA3AF' };
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)',
      paddingBottom: '100px'
    }}>
      {/* Header */}
      <div style={styles.primaryGradient}>
        <div style={{ padding: '16px', paddingTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {selectedOrder ? (
                <button 
                  onClick={() => setSelectedOrder(null)}
                  style={{
                    padding: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                >
                  <ArrowLeft size={20} />
                </button>
              ) : (
                <div style={{
                  width: '48px',
                  height: '48px',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(10px)'
                }}>
                  <Truck size={28} color="white" />
                </div>
              )}
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', margin: 0 }}>
                  MIRA STOK
                </h1>
                <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px', margin: 0 }}>
                  {selectedOrder ? 'İş Emri Detayı' : 'Fason Takip'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {location && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: 'white',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  <MapPin size={16} />
                  <span>Konum Aktif</span>
                </div>
              )}
              <button style={{
                padding: '8px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                color: 'white',
                cursor: 'pointer'
              }}>
                <Bell size={20} />
              </button>
            </div>
          </div>

          {/* Fabric Types */}
          {!selectedOrder && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {['Kumaş Gingi', 'Kumaş Çalışı', 'Rapalar'].map((fabric, index) => (
                <span key={index} style={{
                  padding: '6px 12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '500',
                  backdropFilter: 'blur(10px)'
                }}>
                  {fabric}
                </span>
              ))}
            </div>
          )}

          {/* Statistics */}
          {!selectedOrder && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)',
                borderRadius: '12px',
                padding: '12px',
                textAlign: 'center',
                border: '1px solid rgba(255, 255, 255, 0.3)'
              }}>
                <div style={{ color: 'white', fontWeight: 'bold', fontSize: '18px' }}>{workOrders.length}</div>
                <div style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '12px' }}>Toplam Sipariş</div>
              </div>
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)',
                borderRadius: '12px',
                padding: '12px',
                textAlign: 'center',
                border: '1px solid rgba(255, 255, 255, 0.3)'
              }}>
                <div style={{ color: 'white', fontWeight: 'bold', fontSize: '18px' }}>
                  {workOrders.filter(o => o.status === 'ATÖLYEDE').length}
                </div>
                <div style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '12px' }}>Devam Eden</div>
              </div>
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)',
                borderRadius: '12px',
                padding: '12px',
                textAlign: 'center',
                border: '1px solid rgba(255, 255, 255, 0.3)'
              }}>
                <div style={{ color: 'white', fontWeight: 'bold', fontSize: '18px' }}>
                  {workOrders.filter(o => o.status === 'SORUN_VAR').length}
                </div>
                <div style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '12px' }}>Sorunlu</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '16px', marginTop: '-8px' }}>
        {!selectedOrder ? (
          <>
            {/* Arama Çubuğu */}
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <Search style={{ 
                position: 'absolute', 
                left: '16px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: '#9CA3AF',
                width: '20px',
                height: '20px'
              }} />
              <input
                type="text"
                placeholder="Sipariş no, ürün kodu veya müşteri ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  paddingLeft: '48px',
                  paddingRight: '16px',
                  paddingTop: '16px',
                  paddingBottom: '16px',
                  backgroundColor: 'white',
                  border: '1px solid #D1D5DB',
                  borderRadius: '16px',
                  fontSize: '16px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
            </div>

            {/* Filtreler */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '16px' }}>
              {statusFilters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setActiveFilter(filter.value)}
                  style={{
                    flexShrink: 0,
                    padding: '12px 16px',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    ...getFilterStyle(filter.value),
                    boxShadow: activeFilter === filter.value ? '0 4px 6px -1px rgba(0, 0, 0, 0.3)' : '0 2px 4px -1px rgba(0, 0, 0, 0.1)',
                    transform: activeFilter === filter.value ? 'scale(1.05)' : 'scale(1)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {filter.value}
                </button>
              ))}
            </div>

            {/* İş Emirleri Listesi */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1F2937', margin: 0 }}>
                  İş Emirleri
                </h2>
                <span style={{
                  fontSize: '14px',
                  color: '#4B5563',
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  border: '1px solid #E5E7EB'
                }}>
                  {filteredOrders.length} adet
                </span>
              </div>

              {filteredOrders.map((order) => (
                <div 
                  key={order.id}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    padding: '16px',
                    marginBottom: '12px',
                    cursor: 'pointer',
                    border: '1px solid #E5E7EB',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                    transition: 'all 0.3s ease'
                  }}
                  onClick={() => setSelectedOrder(order)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                          {order.orderNo}
                        </h3>
                        {order.priority && (
                          <span style={{
                            fontSize: '12px',
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontWeight: '600',
                            ...getPriorityStyle(order.priority)
                          }}>
                            {order.priority}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '16px', fontWeight: '600', color: '#374151', margin: '0 0 4px 0' }}>
                        {order.productCode}
                      </p>
                      {order.productName && (
                        <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 8px 0' }}>
                          {order.productName}
                        </p>
                      )}
                    </div>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      ...getStatusStyle(order.status),
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
                    }}>
                      {getStatusIcon(order.status)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '14px', color: '#6B7280' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={16} />
                        <span style={{ fontWeight: '500' }}>{order.customerName}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Package size={16} />
                        <span>{order.quantity} adet</span>
                      </div>
                    </div>
                    <div style={{
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: 'white',
                      ...getStatusStyle(order.status)
                    }}>
                      {order.status.replace('_', ' ')}
                    </div>
                  </div>
                </div>
              ))}

              {filteredOrders.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 16px' }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    background: 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    border: '1px solid #E5E7EB'
                  }}>
                    <Search size={32} color="#6B7280" />
                  </div>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#374151', margin: '0 0 8px 0' }}>
                    Sonuç bulunamadı
                  </p>
                  <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>
                    Arama kriterlerinize uygun iş emri bulunamadı.
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ marginTop: '16px' }}>
            {/* Seçili İş Emri Bilgisi */}
            <div style={{
              background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)',
              borderRadius: '16px',
              padding: '16px',
              color: 'white',
              marginBottom: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
                    {selectedOrder.orderNo}
                  </h2>
                  <p style={{ fontWeight: '600', opacity: 0.9, margin: '0 0 4px 0' }}>
                    {selectedOrder.productCode}
                  </p>
                  {selectedOrder.productName && (
                    <p style={{ fontSize: '14px', opacity: 0.8, margin: 0 }}>
                      {selectedOrder.productName}
                    </p>
                  )}
                </div>
                <div style={{
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '600',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(10px)'
                }}>
                  {selectedOrder.status.replace('_', ' ')}
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.9 }}>
                  <User size={16} />
                  <span>{selectedOrder.customerName}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.9 }}>
                  <Package size={16} />
                  <span>{selectedOrder.quantity} adet</span>
                </div>
              </div>
            </div>

            {/* Takip Formu */}
            <form onSubmit={handleSubmit}>
              <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '16px',
                marginBottom: '16px',
                border: '1px solid #E5E7EB',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>
                    Süreç Tipi
                  </label>
                  <select
                    value={formData.processType}
                    onChange={(e) => setFormData({ ...formData, processType: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '16px',
                      backgroundColor: '#F9FAFB',
                      border: '1px solid #D1D5DB',
                      borderRadius: '12px',
                      fontSize: '16px'
                    }}
                    required
                  >
                    <option value="DIKIM">Dikim</option>
                    <option value="BASKI_NAKIS">Baskı/Nakış</option>
                    <option value="UTU">Ütü</option>
                  </select>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#374151', marginBottom: '12px' }}>
                    Durum
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {[
                      { value: 'ALINDI', label: 'Alındı', style: styles.blueGradient },
                      { value: 'ATÖLYEDE', label: 'Atölyede', style: styles.yellowGradient },
                      { value: 'HAZIR', label: 'Hazır', style: styles.greenGradient },
                      { value: 'TESLIM_EDILDI', label: 'Teslim Edildi', style: { background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' } },
                      { value: 'SORUN_VAR', label: 'Sorun Var', style: styles.redGradient, colSpan: 'span 2' }
                    ].map((status) => (
                      <button
                        key={status.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, status: status.value })}
                        style={{
                          padding: '16px',
                          borderRadius: '12px',
                          fontSize: '14px',
                          fontWeight: '500',
                          color: 'white',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '8px',
                          ...status.style,
                          gridColumn: status.colSpan || 'auto',
                          boxShadow: formData.status === status.value ? '0 4px 6px -1px rgba(0, 0, 0, 0.3)' : '0 2px 4px -1px rgba(0, 0, 0, 0.1)',
                          transform: formData.status === status.value ? 'scale(1.02)' : 'scale(1)',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {getStatusIcon(status.value)}
                        <span>{status.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>
                    Atölye (Opsiyonel)
                  </label>
                  <select
                    value={formData.workshopId}
                    onChange={(e) => setFormData({ ...formData, workshopId: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '16px',
                      backgroundColor: '#F9FAFB',
                      border: '1px solid #D1D5DB',
                      borderRadius: '12px',
                      fontSize: '16px'
                    }}
                  >
                    <option value="">Atölye seçin</option>
                    {workshops.map((workshop) => (
                      <option key={workshop.id} value={workshop.id}>
                        {workshop.name} ({workshop.specialization})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>
                    Notlar
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '16px',
                      backgroundColor: '#F9FAFB',
                      border: '1px solid #D1D5DB',
                      borderRadius: '12px',
                      fontSize: '16px',
                      resize: 'vertical'
                    }}
                    placeholder="Genel notlarınızı buraya yazın..."
                  />
                </div>

                {formData.status === 'SORUN_VAR' && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#DC2626', marginBottom: '8px' }}>
                      Sorun Açıklaması
                    </label>
                    <textarea
                      value={formData.problemNotes}
                      onChange={(e) => setFormData({ ...formData, problemNotes: e.target.value })}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '16px',
                        backgroundColor: '#FEF2F2',
                        border: '1px solid #FECACA',
                        borderRadius: '12px',
                        fontSize: '16px',
                        resize: 'vertical'
                      }}
                      placeholder="Yaşanan sorunu detaylandırın..."
                      required
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)',
                  color: 'white',
                  padding: '16px',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 6px -1px rgba(139, 92, 246, 0.3)',
                  transition: 'all 0.2s ease'
                }}
              >
                {loading ? (
                  <div style={{
                    width: '24px',
                    height: '24px',
                    border: '2px solid transparent',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                ) : (
                  <>
                    <Save size={20} />
                    <span>Takip Kaydını Kaydet</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      {!selectedOrder && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'white',
          borderTop: '1px solid #E5E7EB',
          padding: '12px 16px',
          boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
            <button style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: '#8B5CF6', border: 'none', background: 'none', cursor: 'pointer' }}>
              <Home size={24} />
              <span style={{ fontSize: '12px', fontWeight: '500' }}>Ana Sayfa</span>
            </button>
            <button style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: '#9CA3AF', border: 'none', background: 'none', cursor: 'pointer' }}>
              <BarChart3 size={24} />
              <span style={{ fontSize: '12px' }}>İstatistik</span>
            </button>
            <button style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: '#9CA3AF', border: 'none', background: 'none', cursor: 'pointer' }}>
              <Bell size={24} />
              <span style={{ fontSize: '12px' }}>Bildirim</span>
            </button>
            <button style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: '#9CA3AF', border: 'none', background: 'none', cursor: 'pointer' }}>
              <Settings size={24} />
              <span style={{ fontSize: '12px' }}>Ayarlar</span>
            </button>
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default MobileTracker; 