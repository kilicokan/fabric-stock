import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  LinearProgress,
  TextField,
  InputAdornment,
  MenuItem,
  Tooltip,
  IconButton,
  Chip
} from '@mui/material';
import { useAuth } from '../../components/AuthContext';
import axios from 'axios';
import {
  Search,
  Filter,
  Download,
  MapPin,
  Clock,
  AlertTriangle,
  RefreshCw,
  Grid3X3,
  List,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  PlayCircle,
  Home,
  BarChart3,
  Settings,
  Bell,
  Truck,
  Package,
  Users,
  Calendar
} from 'lucide-react';

// Helper functions
const getStatusColor = (status: string) => {
  const colors: { [key: string]: string } = {
    'KESIM': 'warning',
    'DIKIM': 'primary',
    'BASKI_NAKIS': 'secondary',
    'UTU': 'info',
    'TESLIM_EDILDI': 'success',
    'SORUN_VAR': 'error',
    'IPTAL': 'default',
    'BEKLIYOR': 'warning',
    'ALINDI': 'primary',
    'ATÖLYEDE': 'secondary',
    'HAZIR': 'info'
  };
  return colors[status] || 'default';
};

interface WorkOrder {
  id: number;
  orderNo: string;
  productCode: string;
  productName?: string;
  quantity: number;
  customerName?: string;
  status: string;
  deliveryDate?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  fasonTrackings: FasonTracking[];
}

interface FasonTracking {
  id: number;
  processType: string;
  status: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  problemNotes?: string;
  workshop?: {
    name: string;
    specialization: string;
  };
  user: {
    name?: string;
    email: string;
  };
}

const FasonDashboard: React.FC = () => {
  const { user } = useAuth();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    delayed: 0
  });

  // Inline CSS styles for consistent coloring
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
      KESIM: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
      DIKIM: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
      BASKI_NAKIS: 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)',
      UTU: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
    },
    priorityColors: {
      LOW: '#10B981',
      MEDIUM: '#F59E0B',
      HIGH: '#EF4444',
      URGENT: '#DC2626'
    }
  };

  useEffect(() => {
    fetchWorkOrders();
  }, [searchTerm, statusFilter]);

  const fetchWorkOrders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);

      const response = await axios.get(`/api/fason/work-orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const workOrdersData = response.data.workOrders || [];
      setWorkOrders(workOrdersData);
      calculateStats(workOrdersData);
    } catch (error) {
      console.error('İş emirleri yüklenirken hata:', error);
      setWorkOrders([]);
      setStats({ total: 0, completed: 0, inProgress: 0, delayed: 0 });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (orders: WorkOrder[]) => {
    const total = orders.length;
    const completed = orders.filter(order => order.status === 'TESLIM_EDILDI').length;
    const inProgress = orders.filter(order => 
      !['TESLIM_EDILDI', 'IPTAL'].includes(order.status)
    ).length;
    const delayed = orders.filter(order => {
      if (!order.deliveryDate) return false;
      return new Date(order.deliveryDate) < new Date() && order.status !== 'TESLIM_EDILDI';
    }).length;

    setStats({ total, completed, inProgress, delayed });
  };

  const exportToExcel = () => {
    alert('Excel raporu indiriliyor...');
  };

  const getPriorityColor = (priority?: string) => {
    const priorityKey = (priority as keyof typeof styles.priorityColors) || 'LOW';
    return styles.priorityColors[priorityKey] || '#6b7280';
  };

  const getStatusStyle = (status: string) => {
    const styleMap: { [key: string]: React.CSSProperties } = {
      'ALINDI': { background: styles.statusColors.ALINDI, color: 'white' },
      'ATÖLYEDE': { background: styles.statusColors.ATÖLYEDE, color: 'white' },
      'HAZIR': { background: styles.statusColors.HAZIR, color: 'white' },
      'TESLIM_EDILDI': { background: styles.statusColors.TESLIM_EDILDI, color: 'white' },
      'SORUN_VAR': { background: styles.statusColors.SORUN_VAR, color: 'white' },
      'KESIM': { background: styles.statusColors.KESIM, color: 'white' },
      'DIKIM': { background: styles.statusColors.DIKIM, color: 'white' },
      'BASKI_NAKIS': { background: styles.statusColors.BASKI_NAKIS, color: 'white' },
      'UTU': { background: styles.statusColors.UTU, color: 'white' }
    };
    return styleMap[status] || { backgroundColor: '#6B7280', color: 'white' };
  };

  if (loading) {
    return (
      <div style={{ 
        padding: '32px', 
        maxWidth: '100%', 
        background: 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)',
        minHeight: '100vh'
      }}>
        <LinearProgress />
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <p style={{ color: '#6B7280' }}>Fason takip verileri yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      background: 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={styles.primaryGradient}>
        <div style={{ padding: '24px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: 'white', margin: '0 0 8px 0' }}>
                miraApp
              </h1>
              <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '16px', margin: 0 }}>
                Dış Üretim Takip Dashboard
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Tooltip title="Yenile">
                <IconButton 
                  onClick={fetchWorkOrders}
                  style={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.2)', 
                    color: 'white',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  <RefreshCw size={20} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Bildirimler">
                <IconButton 
                  style={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.2)', 
                    color: 'white',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  <Bell size={20} />
                </IconButton>
              </Tooltip>
            </div>
          </div>

          
          {/* İstatistik Kartları */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '16px' }}>
            {/* Toplam İş Emri */}
            <Card style={{ 
              background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '16px',
              color: 'white'
            }}>
              <CardContent style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px', fontWeight: '500', margin: '0 0 8px 0' }}>Toplam İş Emri</p>
                    <h3 style={{ fontSize: '32px', fontWeight: 'bold', margin: 0 }}>{stats.total}</h3>
                  </div>
                  <div style={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.3)', 
                    borderRadius: '50%', 
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <TrendingUp size={32} color="white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tamamlanan */}
            <Card style={{ 
              backgroundColor: 'white',
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
              <CardContent style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ color: '#6B7280', fontSize: '14px', fontWeight: '500', margin: '0 0 8px 0' }}>Tamamlanan</p>
                    <h3 style={{ fontSize: '32px', fontWeight: 'bold', color: '#10B981', margin: 0 }}>{stats.completed}</h3>
                  </div>
                  <div style={{ 
                    backgroundColor: '#D1FAE5', 
                    borderRadius: '50%', 
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <CheckCircle size={32} color="#10B981" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Devam Eden */}
            <Card style={{ 
              backgroundColor: 'white',
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
              <CardContent style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ color: '#6B7280', fontSize: '14px', fontWeight: '500', margin: '0 0 8px 0' }}>Devam Eden</p>
                    <h3 style={{ fontSize: '32px', fontWeight: 'bold', color: '#3B82F6', margin: 0 }}>{stats.inProgress}</h3>
                  </div>
                  <div style={{ 
                    backgroundColor: '#DBEAFE', 
                    borderRadius: '50%', 
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <PlayCircle size={32} color="#3B82F6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Geciken */}
            <Card style={{ 
              backgroundColor: 'white',
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
              <CardContent style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ color: '#6B7280', fontSize: '14px', fontWeight: '500', margin: '0 0 8px 0' }}>Geciken</p>
                    <h3 style={{ fontSize: '32px', fontWeight: 'bold', color: '#EF4444', margin: 0 }}>{stats.delayed}</h3>
                  </div>
                  <div style={{ 
                    backgroundColor: '#FEE2E2', 
                    borderRadius: '50%', 
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <AlertCircle size={32} color="#EF4444" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ padding: '24px 32px' }}>
        {/* Filtreler */}
        <Card style={{ 
          borderRadius: '16px', 
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          marginBottom: '24px'
        }}>
          <CardContent style={{ padding: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
              <TextField
                placeholder="İş emri, ürün kodu veya müşteri ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={20} color="#6B7280" />
                    </InputAdornment>
                  ),
                  style: { borderRadius: '12px' }
                }}
                fullWidth
                size="small"
                style={{ backgroundColor: 'white' }}
              />

              <TextField
                select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Filter size={20} color="#6B7280" />
                    </InputAdornment>
                  ),
                  style: { borderRadius: '12px' }
                }}
                SelectProps={{
                  displayEmpty: true,
                }}
                fullWidth
                size="small"
                style={{ backgroundColor: 'white' }}
              >
                <MenuItem value="">Tüm Durumlar</MenuItem>
                <MenuItem value="KESIM">Kesim</MenuItem>
                <MenuItem value="DIKIM">Dikim</MenuItem>
                <MenuItem value="BASKI_NAKIS">Baskı/Nakış</MenuItem>
                <MenuItem value="UTU">Ütü</MenuItem>
                <MenuItem value="TESLIM_EDILDI">Teslim Edildi</MenuItem>
                <MenuItem value="SORUN_VAR">Sorun Var</MenuItem>
              </TextField>

              <div style={{ display: 'flex', gap: '8px', gridColumn: 'span 2' }}>
                <button
                  onClick={exportToExcel}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                  }}
                >
                  <Download size={20} style={{ marginRight: '8px' }} />
                  Excel Raporu İndir
                </button>

                <div style={{ display: 'flex', gap: '4px' }}>
                  <Tooltip title="Grid Görünümü">
                    <IconButton 
                      onClick={() => setViewMode('grid')}
                      style={{ 
                        backgroundColor: viewMode === 'grid' ? '#3B82F6' : 'white',
                        color: viewMode === 'grid' ? 'white' : '#6B7280',
                        borderRadius: '8px'
                      }}
                    >
                      <Grid3X3 size={20} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Liste Görünümü">
                    <IconButton 
                      onClick={() => setViewMode('list')}
                      style={{ 
                        backgroundColor: viewMode === 'list' ? '#3B82F6' : 'white',
                        color: viewMode === 'list' ? 'white' : '#6B7280',
                        borderRadius: '8px'
                      }}
                    >
                      <List size={20} />
                    </IconButton>
                  </Tooltip>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* İş Emirleri Listesi */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {workOrders.map((order) => (
            <Card key={order.id} style={{ 
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden'
            }}>
              <div style={{
                padding: '20px 24px',
                background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)',
                borderBottom: '1px solid #E2E8F0'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1F2937', margin: 0 }}>
                        İş Emri: {order.orderNo}
                      </h3>
                      {order.priority && (
                        <div 
                          style={{ 
                            width: '12px', 
                            height: '12px', 
                            borderRadius: '50%',
                            backgroundColor: getPriorityColor(order.priority)
                          }}
                        />
                      )}
                    </div>
                    <p style={{ fontSize: '16px', fontWeight: '600', color: '#374151', margin: '0 0 4px 0' }}>
                      {order.productCode} - {order.productName} 
                      <span style={{ marginLeft: '8px', color: '#6B7280', fontWeight: 'normal' }}>
                        ({order.quantity} adet)
                      </span>
                    </p>
                    <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>
                      Müşteri: {order.customerName}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      padding: '6px 16px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: 'white',
                      ...getStatusStyle(order.status)
                    }}>
                      {order.status.replace('_', ' ')}
                    </span>
                    {order.deliveryDate && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: '8px', color: '#6B7280' }}>
                        <Calendar size={16} style={{ marginRight: '4px' }} />
                        <span style={{ fontSize: '14px' }}>
                          {new Date(order.deliveryDate).toLocaleDateString('tr-TR')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <CardContent style={{ padding: '24px' }}>
                {/* Fason Takip Süreçleri */}
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '18px', fontWeight: 'semibold', color: '#1F2937', margin: '0 0 16px 0' }}>
                    Süreç Takibi:
                  </h4>
                  
                  {order.fasonTrackings.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {order.fasonTrackings.map((tracking) => (
                        <div 
                          key={tracking.id} 
                          style={{
                            padding: '20px',
                            background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
                            borderRadius: '12px',
                            borderLeft: '4px solid #3B82F6',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                <span style={{ fontSize: '16px', fontWeight: '600', color: '#1F2937' }}>
                                  {tracking.processType.replace('_', ' ')}
                                </span>
                                <span style={{
                                  padding: '4px 12px',
                                  borderRadius: '16px',
                                  fontSize: '12px',
                                  fontWeight: '500',
                                  color: 'white',
                                  ...getStatusStyle(tracking.status)
                                }}>
                                  {tracking.status.replace('_', ' ')}
                                </span>
                              </div>
                              
                              {tracking.workshop && (
                                <div style={{ display: 'flex', alignItems: 'center', color: '#6B7280', marginBottom: '8px' }}>
                                  <MapPin size={16} style={{ marginRight: '8px' }} />
                                  <span style={{ fontWeight: '500' }}>{tracking.workshop.name}</span>
                                  <span style={{ marginLeft: '8px', fontSize: '14px' }}>
                                    ({tracking.workshop.specialization})
                                  </span>
                                </div>
                              )}
                              
                              <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>
                                <strong>Takipçi:</strong> {tracking.user.name || tracking.user.email}
                              </p>
                            </div>
                            
                            <div style={{ textAlign: 'right', fontSize: '14px', color: '#6B7280', minWidth: '160px' }}>
                              {tracking.startDate && (
                                <p style={{ margin: '0 0 8px 0' }}>
                                  <strong>Başlangıç:</strong><br />
                                  {new Date(tracking.startDate).toLocaleDateString('tr-TR')}
                                </p>
                              )}
                              {tracking.endDate && (
                                <p style={{ margin: 0 }}>
                                  <strong>Bitiş:</strong><br />
                                  {new Date(tracking.endDate).toLocaleDateString('tr-TR')}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          {tracking.notes && (
                            <div style={{ 
                              marginTop: '12px', 
                              padding: '12px', 
                              backgroundColor: '#DBEAFE', 
                              border: '1px solid #BFDBFE',
                              borderRadius: '8px'
                            }}>
                              <p style={{ fontSize: '14px', color: '#1E40AF', margin: 0 }}>
                                <strong>Not:</strong> {tracking.notes}
                              </p>
                            </div>
                          )}
                          
                          {tracking.problemNotes && (
                            <div style={{ 
                              marginTop: '12px', 
                              padding: '12px', 
                              backgroundColor: '#FEE2E2', 
                              border: '1px solid #FECACA',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'flex-start'
                            }}>
                              <AlertTriangle size={16} color="#DC2626" style={{ marginRight: '8px', flexShrink: 0, marginTop: '2px' }} />
                              <p style={{ fontSize: '14px', color: '#DC2626', margin: 0 }}>
                                <strong>Sorun:</strong> {tracking.problemNotes}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '40px 20px', 
                      backgroundColor: '#F8FAFC', 
                      borderRadius: '12px',
                      border: '2px dashed #CBD5E1'
                    }}>
                      <p style={{ color: '#6B7280', fontSize: '16px', fontStyle: 'italic', margin: '0 0 8px 0' }}>
                        Henüz takip kaydı bulunmamaktadır.
                      </p>
                      <p style={{ color: '#9CA3AF', fontSize: '14px', margin: 0 }}>
                        İlk takip kaydını oluşturmak için mobil uygulamayı kullanın.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {workOrders.length === 0 && (
            <Card style={{ 
              textAlign: 'center', 
              padding: '48px 24px',
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
              <CardContent>
                <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                  <div style={{ 
                    backgroundColor: '#F3F4F6', 
                    borderRadius: '50%', 
                    width: '80px', 
                    height: '80px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    margin: '0 auto 16px'
                  }}>
                    <Search size={32} color="#6B7280" />
                  </div>
                  <h3 style={{ fontSize: '20px', fontWeight: 'semibold', color: '#374151', margin: '0 0 8px 0' }}>
                    Hiç iş emri bulunamadı
                  </h3>
                  <p style={{ color: '#6B7280', margin: '0 0 16px 0' }}>
                    Filtrelerinizi kontrol edin veya yeni iş emri ekleyin.
                  </p>
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('');
                    }}
                    style={{
                      backgroundColor: '#3B82F6',
                      color: 'white',
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Filtreleri Temizle
                  </button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default FasonDashboard;