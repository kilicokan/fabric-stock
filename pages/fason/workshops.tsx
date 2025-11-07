import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  TextField,
  MenuItem,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Filter,
  DollarSign,
  Building,
  Phone,
  Mail,
  MapPin,
  User,
  TrendingUp,
  TrendingDown,
  CreditCard
} from 'lucide-react';
import axios from 'axios';

interface Workshop {
  id: number;
  name: string;
  specialization: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  balance: number;
  status: string;
  totalEarnings: number;
  totalPayments: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const FasonWorkshops: React.FC = () => {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [specializationFilter, setSpecializationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingWorkshop, setEditingWorkshop] = useState<Workshop | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    specialization: '',
    contactPerson: '',
    phone: '',
    address: '',
    isActive: true
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
    }
  };

  useEffect(() => {
    fetchWorkshops();
  }, [searchTerm, specializationFilter, statusFilter]);

  const fetchWorkshops = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/fason/workshops', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const workshopsWithDefaults = response.data.map((workshop: any) => ({
        ...workshop,
        balance: workshop.balance || 0,
        totalEarnings: workshop.totalEarnings || 0,
        totalPayments: workshop.totalPayments || 0,
        email: workshop.email || '',
        status: workshop.status || 'ACTIVE'
      }));
      setWorkshops(workshopsWithDefaults);
    } catch (error) {
      console.error('Atölyeler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkshop = () => {
    setEditingWorkshop(null);
    setFormData({
      name: '',
      specialization: '',
      contactPerson: '',
      phone: '',
      address: '',
      isActive: true
    });
    setOpenDialog(true);
  };

  const handleEditWorkshop = (workshop: Workshop) => {
    setEditingWorkshop(workshop);
    setFormData({
      name: workshop.name,
      specialization: workshop.specialization,
      contactPerson: workshop.contactPerson,
      phone: workshop.phone,
      address: workshop.address,
      isActive: workshop.isActive
    });
    setOpenDialog(true);
  };

  const handleSaveWorkshop = async () => {
    try {
      const token = localStorage.getItem('token');
      if (editingWorkshop) {
        // Update existing workshop
        const response = await axios.put('/api/fason/workshops', {
          id: editingWorkshop.id,
          ...formData
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setWorkshops(prev => prev.map(workshop =>
          workshop.id === editingWorkshop.id
            ? response.data
            : workshop
        ));
      } else {
        // Create new workshop
        const response = await axios.post('/api/fason/workshops', formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setWorkshops(prev => [...prev, response.data]);
      }
      setOpenDialog(false);
    } catch (error) {
      console.error('Atölye kaydedilirken hata:', error);
    }
  };

  const handleDeleteWorkshop = async (id: number) => {
    if (window.confirm('Bu atölyeyi silmek istediğinizden emin misiniz?')) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`/api/fason/workshops?id=${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setWorkshops(prev => prev.filter(workshop => workshop.id !== id));
      } catch (error) {
        console.error('Atölye silinirken hata:', error);
      }
    }
  };

  const handlePayment = (workshop: Workshop, amount: number) => {
    setWorkshops(prev => prev.map(w => 
      w.id === workshop.id 
        ? { 
            ...w, 
            balance: w.balance - amount,
            totalPayments: w.totalPayments + amount
          }
        : w
    ));
  };

  const getSpecializationLabel = (specialization: string) => {
    const labels: { [key: string]: string } = {
      'DIKIM': 'Dikim',
      'BASKI_NAKIS': 'Baskı/Nakış',
      'KESIM': 'Kesim',
      'UTU': 'Ütü',
      'TUM': 'Tüm İşler'
    };
    return labels[specialization] || specialization;
  };

  const filteredWorkshops = workshops.filter(workshop =>
    (workshop.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     workshop.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
     workshop.email.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (specializationFilter === '' || workshop.specialization === specializationFilter) &&
    (statusFilter === '' || workshop.status === statusFilter)
  );

  const stats = {
    total: workshops.length,
    active: workshops.filter(w => w.status === 'ACTIVE').length,
    totalBalance: workshops.reduce((sum, w) => sum + w.balance, 0),
    totalEarnings: workshops.reduce((sum, w) => sum + w.totalEarnings, 0)
  };

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
                Fason Atölye Yönetimi
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={handleCreateWorkshop}
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
                Yeni Atölye
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
              <div style={{ fontSize: '14px', opacity: 0.9 }}>Toplam Atölye</div>
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
              <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>{stats.active}</div>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>Aktif Atölye</div>
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
              <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>
                {stats.totalBalance.toLocaleString('tr-TR')} ₺
              </div>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>Toplam Bakiye</div>
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
              <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>
                {stats.totalEarnings.toLocaleString('tr-TR')} ₺
              </div>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>Toplam Kazanç</div>
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
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px' }}>
              <TextField
                placeholder="Atölye adı, yetkili kişi veya email ara..."
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
                value={specializationFilter}
                onChange={(e) => setSpecializationFilter(e.target.value)}
                InputProps={{
                  style: { borderRadius: '12px' }
                }}
                SelectProps={{
                  displayEmpty: true,
                }}
                fullWidth
                size="small"
                style={{ backgroundColor: 'white' }}
              >
                <MenuItem value="">Tüm Uzmanlıklar</MenuItem>
                <MenuItem value="DIKIM">Dikim</MenuItem>
                <MenuItem value="BASKI_NAKIS">Baskı/Nakış</MenuItem>
                <MenuItem value="KESIM">Kesim</MenuItem>
                <MenuItem value="UTU">Ütü</MenuItem>
                <MenuItem value="TUM">Tüm İşler</MenuItem>
              </TextField>

              <TextField
                select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                fullWidth
                size="small"
                style={{ backgroundColor: 'white', borderRadius: '12px' }}
              >
                <MenuItem value="">Tüm Durumlar</MenuItem>
                <MenuItem value="ACTIVE">Aktif</MenuItem>
                <MenuItem value="PASSIVE">Pasif</MenuItem>
              </TextField>
            </div>
          </CardContent>
        </Card>

        {/* Atölyeler Listesi */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
          {filteredWorkshops.map((workshop) => (
            <Card key={workshop.id} style={{ 
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden'
            }}>
              <CardContent style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1F2937', margin: '0 0 4px 0' }}>
                      {workshop.name}
                    </h3>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      backgroundColor: workshop.status === 'ACTIVE' ? '#D1FAE5' : '#FEE2E2',
                      color: workshop.status === 'ACTIVE' ? '#065F46' : '#991B1B'
                    }}>
                      {workshop.status === 'ACTIVE' ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Tooltip title="Düzenle">
                      <IconButton 
                        onClick={() => handleEditWorkshop(workshop)}
                        style={{ backgroundColor: '#3B82F6', color: 'white', padding: '6px' }}
                      >
                        <Edit size={16} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Sil">
                      <IconButton 
                        onClick={() => handleDeleteWorkshop(workshop.id)}
                        style={{ backgroundColor: '#EF4444', color: 'white', padding: '6px' }}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </Tooltip>
                  </div>
                </div>

                {/* Uzmanlık */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Building size={16} color="#6B7280" />
                  <span style={{ color: '#6B7280', fontSize: '14px' }}>
                    {getSpecializationLabel(workshop.specialization)}
                  </span>
                </div>

                {/* İletişim Bilgileri */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <User size={14} color="#6B7280" />
                    <span style={{ color: '#6B7280', fontSize: '14px' }}>{workshop.contactPerson}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <Phone size={14} color="#6B7280" />
                    <span style={{ color: '#6B7280', fontSize: '14px' }}>{workshop.phone}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <Mail size={14} color="#6B7280" />
                    <span style={{ color: '#6B7280', fontSize: '14px' }}>{workshop.email}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapPin size={14} color="#6B7280" />
                    <span style={{ color: '#6B7280', fontSize: '14px' }}>{workshop.address}</span>
                  </div>
                </div>

                {/* Finansal Bilgiler */}
                <div style={{ 
                  padding: '16px', 
                  backgroundColor: '#F8FAFC', 
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', color: '#6B7280' }}>Bakiye:</span>
                    <span style={{ 
                      fontSize: '18px', 
                      fontWeight: 'bold',
                      color: workshop.balance >= 0 ? '#10B981' : '#EF4444'
                    }}>
                      {workshop.balance.toLocaleString('tr-TR')} ₺
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#6B7280' }}>Toplam Kazanç:</span>
                    <span style={{ fontSize: '14px', fontWeight: '500', color: '#10B981' }}>
                      {workshop.totalEarnings.toLocaleString('tr-TR')} ₺
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '12px', color: '#6B7280' }}>Toplam Ödeme:</span>
                    <span style={{ fontSize: '14px', fontWeight: '500', color: '#EF4444' }}>
                      {workshop.totalPayments.toLocaleString('tr-TR')} ₺
                    </span>
                  </div>

                  {workshop.balance > 0 && (
                    <button
                      onClick={() => {
                        const amount = prompt('Ödeme miktarını girin:');
                        if (amount && !isNaN(parseFloat(amount))) {
                          handlePayment(workshop, parseFloat(amount));
                        }
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        backgroundColor: '#10B981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      <CreditCard size={16} />
                      Ödeme Yap
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredWorkshops.length === 0 && (
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
                  <Building size={32} color="#6B7280" />
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 'semibold', color: '#374151', margin: '0 0 8px 0' }}>
                  Atölye bulunamadı
                </h3>
                <p style={{ color: '#6B7280', margin: '0 0 16px 0' }}>
                  Filtrelerinizi kontrol edin veya yeni atölye oluşturun.
                </p>
                <button
                  onClick={handleCreateWorkshop}
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
                  Yeni Atölye Oluştur
                </button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Atölye Form Dialog */}
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
          {editingWorkshop ? 'Atölye Düzenle' : 'Yeni Atölye'}
        </DialogTitle>
        <DialogContent style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
            <TextField
              label="Atölye Adı"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              select
              label="Uzmanlık"
              value={formData.specialization}
              onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
              fullWidth
              required
            >
              <MenuItem value="DIKIM">Dikim</MenuItem>
              <MenuItem value="BASKI_NAKIS">Baskı/Nakış</MenuItem>
              <MenuItem value="KESIM">Kesim</MenuItem>
              <MenuItem value="UTU">Ütü</MenuItem>
              <MenuItem value="TUM">Tüm İşler</MenuItem>
            </TextField>
            <TextField
              label="Yetkili Kişi"
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Telefon"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Adres"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              fullWidth
              required
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              <label htmlFor="isActive" style={{ fontSize: '14px', color: '#374151' }}>
                Aktif
              </label>
            </div>
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
            onClick={handleSaveWorkshop}
            style={{ 
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              color: 'white',
              padding: '8px 24px',
              borderRadius: '8px',
              fontWeight: '500'
            }}
          >
            {editingWorkshop ? 'Güncelle' : 'Oluştur'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default FasonWorkshops;