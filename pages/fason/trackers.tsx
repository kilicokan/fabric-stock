import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Card,
  CardContent,
  TextField,
  MenuItem,
  Button,
  IconButton,
  Tooltip,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { useAuth } from '../../components/AuthContext';
import axios from 'axios';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Filter,
  Download,
  Truck,
  Package,
  Calendar,
  User,
  CheckCircle,
  AlertCircle,
  Clock,
  PlayCircle
} from 'lucide-react';

interface WorkOrder {
  id: number;
  orderNo: string;
  productCode: string;
  productName: string;
  quantity: number;
  customerName: string;
  status: string;
  deliveryDate: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assignedToMobile: boolean;
  assignedUserId?: number;
  assignedUser?: {
    id: number;
    name: string;
    email: string;
  };
  createdAt: string;
}

interface FasonTracker {
  id: number;
  name: string;
  email: string;
  phone?: string;
}

const FasonTrackers: React.FC = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [fasonTrackers, setFasonTrackers] = useState<FasonTracker[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [mobileFilter, setMobileFilter] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);
  const [showUserDropdown, setShowUserDropdown] = useState<number | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    orderNo: '',
    productCode: '',
    productName: '',
    quantity: 1,
    customerName: '',
    status: 'BEKLIYOR',
    deliveryDate: '',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  });

  // Inline CSS styles
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
      BEKLIYOR: 'linear-gradient(135deg, #6B7280 0%, #4B5563 100%)',
      ALINDI: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
      ATÖLYEDE: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
      HAZIR: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
      TESLIM_EDILDI: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      SORUN_VAR: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
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
    fetchFasonTrackers();
  }, [searchTerm, statusFilter, priorityFilter, mobileFilter]);

  const fetchFasonTrackers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/fason/users/fason-trackers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFasonTrackers(response.data.fasonTrackers || []);
    } catch (error) {
      console.error('Fason takipçileri yüklenirken hata:', error);
      setFasonTrackers([]);
    }
  };

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
    } catch (error) {
      console.error('İş emirleri yüklenirken hata:', error);
      setWorkOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = () => {
    setEditingOrder(null);
    setFormData({
      orderNo: '',
      productCode: '',
      productName: '',
      quantity: 1,
      customerName: '',
      status: 'BEKLIYOR',
      deliveryDate: '',
      priority: 'MEDIUM'
    });
    setOpenDialog(true);
  };

  const handleEditOrder = (order: WorkOrder) => {
    setEditingOrder(order);
    setFormData({
      orderNo: order.orderNo,
      productCode: order.productCode,
      productName: order.productName,
      quantity: order.quantity,
      customerName: order.customerName,
      status: order.status,
      deliveryDate: order.deliveryDate,
      priority: order.priority
    });
    setOpenDialog(true);
  };

  const handleSaveOrder = async () => {
    try {
      const token = localStorage.getItem('token');

      if (editingOrder) {
        // Update existing order
        await axios.put(`/api/fason/work-orders/${editingOrder.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        // Create new order
        await axios.post('/api/fason/work-orders', formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      // Refresh the list
      fetchWorkOrders();
      setOpenDialog(false);
    } catch (error) {
      console.error('İş emri kaydedilirken hata:', error);
    }
  };

  const handleDeleteOrder = async (id: number) => {
    if (window.confirm('Bu iş emrini silmek istediğinizden emin misiniz?')) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`/api/fason/work-orders/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Refresh the list
        fetchWorkOrders();
      } catch (error) {
        console.error('İş emri silinirken hata:', error);
      }
    }
  };

  const toggleMobileAssignment = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      const order = workOrders.find(o => o.id === id);
      
      if (!order) {
        throw new Error('İş emri bulunamadı');
      }

      await axios.put(
        `/api/fason/work-orders/${id}`, 
        {
          assignedToMobile: !order.assignedToMobile,
          status: order.status
        },
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      await fetchWorkOrders();
    } catch (error) {
      console.error('Mobile atama güncellenirken hata:', error);
      alert('Mobile atama güncellenirken bir hata oluştu');
    }
  };

  const assignUserToOrder = async (orderId: number, userId: number | null) => {
    try {
      const token = localStorage.getItem('token');
      const order = workOrders.find(o => o.id === orderId);

      if (!order) {
        throw new Error('İş emri bulunamadı');
      }

      const response = await axios.put(
        `/api/fason/work-orders/${orderId}`,
        {
          assignedUserId: userId,
          status: order.status
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 200) {
        await fetchWorkOrders();
        setShowUserDropdown(null);
      }
    } catch (error) {
      console.error('Kullanıcı atama hatası:', error);
      alert('Kullanıcı atanırken bir hata oluştu');
    }
  };

  const getStatusStyle = (status: string) => {
    const styleMap: { [key: string]: React.CSSProperties } = {
      'BEKLIYOR': { background: styles.statusColors.BEKLIYOR, color: 'white' },
      'ALINDI': { background: styles.statusColors.ALINDI, color: 'white' },
      'ATÖLYEDE': { background: styles.statusColors.ATÖLYEDE, color: 'white' },
      'HAZIR': { background: styles.statusColors.HAZIR, color: 'white' },
      'TESLIM_EDILDI': { background: styles.statusColors.TESLIM_EDILDI, color: 'white' },
      'SORUN_VAR': { background: styles.statusColors.SORUN_VAR, color: 'white' },
    };
    return styleMap[status] || { backgroundColor: '#6B7280', color: 'white' };
  };

  const getStatusIcon = (status: string) => {
    const icons: { [key: string]: React.ReactNode } = {
      'BEKLIYOR': <Clock size={16} />,
      'ALINDI': <Package size={16} />,
      'ATÖLYEDE': <PlayCircle size={16} />,
      'HAZIR': <CheckCircle size={16} />,
      'TESLIM_EDILDI': <Truck size={16} />,
      'SORUN_VAR': <AlertCircle size={16} />
    };
    return icons[status] || <Clock size={16} />;
  };

  const filteredOrders = workOrders.filter(order =>
    (order.orderNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
     order.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
     order.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
     order.customerName.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (statusFilter === '' || order.status === statusFilter) &&
    (priorityFilter === '' || order.priority === priorityFilter) &&
    (mobileFilter === '' || 
      (mobileFilter === 'assigned' && order.assignedToMobile) ||
      (mobileFilter === 'not_assigned' && !order.assignedToMobile))
  );

  const stats = {
    total: workOrders.length,
    assigned: workOrders.filter(order => order.assignedToMobile).length,
    notAssigned: workOrders.filter(order => !order.assignedToMobile).length,
    completed: workOrders.filter(order => order.status === 'TESLIM_EDILDI').length
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showUserDropdown && !(event.target as Element).closest('.relative')) {
        setShowUserDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserDropdown]);

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
                MIRA STOK
              </h1>
              <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '16px', margin: 0 }}>
                İş Emri Yönetimi
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={() => {/* Export functionality */}}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <Download size={20} />
                Dışa Aktar
              </button>
              <button
                onClick={() => router.push('/fason/create-work-order')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}
              >
                <Plus size={20} />
                Yeni İş Emri
              </button>
            </div>
          </div>

          {/* Statistics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              padding: '20px',
              textAlign: 'center',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: 'white'
            }}>
              <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>{stats.total}</div>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>Toplam İş Emri</div>
            </div>
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              padding: '20px',
              textAlign: 'center',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: 'white'
            }}>
              <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>{stats.assigned}</div>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>Mobile Atanmış</div>
            </div>
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              padding: '20px',
              textAlign: 'center',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: 'white'
            }}>
              <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>{stats.notAssigned}</div>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>Atanmamış</div>
            </div>
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              padding: '20px',
              textAlign: 'center',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: 'white'
            }}>
              <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>{stats.completed}</div>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>Tamamlanan</div>
            </div>
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
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '16px' }}>
              <TextField
                placeholder="İş emri, ürün kodu, ürün adı veya müşteri ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <Search size={20} color="#6B7280" style={{ marginRight: '12px' }} />
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
                    <Filter size={20} color="#6B7280" style={{ marginRight: '12px' }} />
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
                <MenuItem value="BEKLIYOR">Bekliyor</MenuItem>
                <MenuItem value="ALINDI">Alındı</MenuItem>
                <MenuItem value="ATÖLYEDE">Atölyede</MenuItem>
                <MenuItem value="HAZIR">Hazır</MenuItem>
                <MenuItem value="TESLIM_EDILDI">Teslim Edildi</MenuItem>
                <MenuItem value="SORUN_VAR">Sorun Var</MenuItem>
              </TextField>

              <TextField
                select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                fullWidth
                size="small"
                style={{ backgroundColor: 'white', borderRadius: '12px' }}
              >
                <MenuItem value="">Tüm Öncelikler</MenuItem>
                <MenuItem value="LOW">Düşük</MenuItem>
                <MenuItem value="MEDIUM">Orta</MenuItem>
                <MenuItem value="HIGH">Yüksek</MenuItem>
                <MenuItem value="URGENT">Acil</MenuItem>
              </TextField>

              <TextField
                select
                value={mobileFilter}
                onChange={(e) => setMobileFilter(e.target.value)}
                fullWidth
                size="small"
                style={{ backgroundColor: 'white', borderRadius: '12px' }}
              >
                <MenuItem value="">Tüm Atamalar</MenuItem>
                <MenuItem value="assigned">Atanmış</MenuItem>
                <MenuItem value="not_assigned">Atanmamış</MenuItem>
              </TextField>
            </div>
          </CardContent>
        </Card>

        {/* İş Emirleri Listesi */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredOrders.map((order) => (
            <Card key={order.id} style={{ 
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden'
            }}>
              <CardContent style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1F2937', margin: 0 }}>
                        {order.orderNo}
                      </h3>
                      <div style={{ 
                        width: '8px', 
                        height: '8px', 
                        borderRadius: '50%',
                        backgroundColor: styles.priorityColors[order.priority]
                      }} />
                      {order.assignedToMobile && (
                        <Chip 
                          label="Mobile Atanmış"
                          size="small"
                          style={{ 
                            backgroundColor: '#10B981', 
                            color: 'white',
                            fontWeight: '500'
                          }}
                        />
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6B7280' }}>
                        <Package size={16} />
                        <span>{order.productCode} - {order.productName}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6B7280' }}>
                        <User size={16} />
                        <span>{order.customerName}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6B7280' }}>
                        <span>Miktar: {order.quantity} adet</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6B7280' }}>
                        <Calendar size={16} />
                        <span>Teslim: {new Date(order.deliveryDate).toLocaleDateString('tr-TR')}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{
                        padding: '6px 16px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        ...getStatusStyle(order.status)
                      }}>
                        {getStatusIcon(order.status)}
                        {order.status.replace('_', ' ')}
                      </span>
                      <span style={{ 
                        fontSize: '14px', 
                        color: '#6B7280',
                        padding: '4px 12px',
                        backgroundColor: order.priority === 'URGENT' ? '#FEE2E2' : 
                                        order.priority === 'HIGH' ? '#FEF3C7' :
                                        order.priority === 'MEDIUM' ? '#DBEAFE' : '#D1FAE5',
                        borderRadius: '12px',
                        fontWeight: '500'
                      }}>
                        {order.priority === 'LOW' ? 'Düşük' :
                         order.priority === 'MEDIUM' ? 'Orta' :
                         order.priority === 'HIGH' ? 'Yüksek' : 'Acil'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Tooltip title={order.assignedToMobile ? "Mobile atamayı kaldır" : "Mobile ata"}>
                      <IconButton
                        onClick={() => toggleMobileAssignment(order.id)}
                        style={{
                          backgroundColor: order.assignedToMobile ? '#10B981' : '#E5E7EB',
                          color: order.assignedToMobile ? 'white' : '#6B7280'
                        }}
                      >
                        <Truck size={18} />
                      </IconButton>
                    </Tooltip>
                    <div className="relative">
                      <button
                        onClick={() => setShowUserDropdown(order.id)}
                        className="px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
                      >
                        {order.assignedUser ? order.assignedUser.name : 'Kullanıcı Ata'}
                      </button>
                      
                      {showUserDropdown === order.id && (
                        <div className="absolute z-10 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                          <div className="py-1" role="menu">
                            <button
                              onClick={() => assignUserToOrder(order.id, null)}
                              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                            >
                              Atamayı Kaldır
                            </button>
                            {fasonTrackers.map(user => (
                              <button
                                key={user.id}
                                onClick={() => assignUserToOrder(order.id, user.id)}
                                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                              >
                                {user.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <Tooltip title="Düzenle">
                      <IconButton
                        onClick={() => handleEditOrder(order)}
                        style={{ backgroundColor: '#3B82F6', color: 'white' }}
                      >
                        <Edit size={18} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Sil">
                      <IconButton
                        onClick={() => handleDeleteOrder(order.id)}
                        style={{ backgroundColor: '#EF4444', color: 'white' }}
                      >
                        <Trash2 size={18} />
                      </IconButton>
                    </Tooltip>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredOrders.length === 0 && (
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
                    İş emri bulunamadı
                  </h3>
                  <p style={{ color: '#6B7280', margin: '0 0 16px 0' }}>
                    Filtrelerinizi kontrol edin veya yeni iş emri oluşturun.
                  </p>
                  <button
                    onClick={() => router.push('/fason/create-work-order')}
                    style={{
                      backgroundColor: '#3B82F6',
                      color: 'white',
                      padding: '10px 20px',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Yeni İş Emri Oluştur
                  </button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* İş Emri Form Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle style={{ 
          background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)',
          color: 'white',
          fontWeight: 'bold'
        }}>
          {editingOrder ? 'İş Emri Düzenle' : 'Yeni İş Emri'}
        </DialogTitle>
        <DialogContent style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
            <TextField
              label="İş Emri No"
              value={formData.orderNo}
              onChange={(e) => setFormData({ ...formData, orderNo: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Ürün Kodu"
              value={formData.productCode}
              onChange={(e) => setFormData({ ...formData, productCode: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Ürün Adı"
              value={formData.productName}
              onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Miktar"
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
              fullWidth
              required
            />
            <TextField
              label="Müşteri Adı"
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Teslim Tarihi"
              type="date"
              value={formData.deliveryDate}
              onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              select
              label="Durum"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              fullWidth
            >
              <MenuItem value="BEKLIYOR">Bekliyor</MenuItem>
              <MenuItem value="ALINDI">Alındı</MenuItem>
              <MenuItem value="ATÖLYEDE">Atölyede</MenuItem>
              <MenuItem value="HAZIR">Hazır</MenuItem>
              <MenuItem value="TESLIM_EDILDI">Teslim Edildi</MenuItem>
              <MenuItem value="SORUN_VAR">Sorun Var</MenuItem>
            </TextField>
            <TextField
              select
              label="Öncelik"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
              fullWidth
            >
              <MenuItem value="LOW">Düşük</MenuItem>
              <MenuItem value="MEDIUM">Orta</MenuItem>
              <MenuItem value="HIGH">Yüksek</MenuItem>
              <MenuItem value="URGENT">Acil</MenuItem>
            </TextField>
          </div>
        </DialogContent>
        <DialogActions style={{ padding: '16px 24px', gap: '12px' }}>
          <Button 
            onClick={() => setOpenDialog(false)}
            style={{ 
              color: '#6B7280',
              border: '1px solid #D1D5DB',
              padding: '8px 16px',
              borderRadius: '8px'
            }}
          >
            İptal
          </Button>
          <Button 
            onClick={handleSaveOrder}
            style={{ 
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              color: 'white',
              padding: '8px 24px',
              borderRadius: '8px',
              fontWeight: '500'
            }}
          >
            {editingOrder ? 'Güncelle' : 'Oluştur'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default FasonTrackers;