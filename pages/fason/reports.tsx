import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent,
  TextField,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import { 
  Search, 
  Filter,
  Download,
  DollarSign,
  Package,
  TrendingUp,
  Building,
  Calendar
} from 'lucide-react';

interface WorkshopReport {
  id: number;
  name: string;
  specialization: string;
  currentGoods: number;
  unitPrice: number;
  totalValue: number;
  balance: number;
  lastWorkDate: string;
  totalWorks: number;
  completedWorks: number;
}

const FasonReports: React.FC = () => {
  const [reports, setReports] = useState<WorkshopReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [specializationFilter, setSpecializationFilter] = useState('');
  const [dateRange, setDateRange] = useState('');

  // Inline CSS styles
  const styles = {
    primaryGradient: {
      background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
    }
  };

  useEffect(() => {
    fetchReports();
  }, [searchTerm, specializationFilter, dateRange]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      // Mock data
      const mockData: WorkshopReport[] = [
        {
          id: 1,
          name: 'Merkez Dikim Atölyesi',
          specialization: 'DIKIM',
          currentGoods: 150,
          unitPrice: 25,
          totalValue: 3750,
          balance: 15000,
          lastWorkDate: '2024-01-15',
          totalWorks: 45,
          completedWorks: 40
        },
        {
          id: 2,
          name: 'Nakış Atölyesi',
          specialization: 'BASKI_NAKIS',
          currentGoods: 80,
          unitPrice: 15,
          totalValue: 1200,
          balance: 8000,
          lastWorkDate: '2024-01-14',
          totalWorks: 30,
          completedWorks: 25
        },
        {
          id: 3,
          name: 'Kesim Atölyesi',
          specialization: 'KESIM',
          currentGoods: 200,
          unitPrice: 8,
          totalValue: 1600,
          balance: -2500,
          lastWorkDate: '2024-01-10',
          totalWorks: 20,
          completedWorks: 18
        }
      ];
      
      setReports(mockData);
    } catch (error) {
      console.error('Raporlar yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSpecializationLabel = (specialization: string) => {
    const labels: { [key: string]: string } = {
      'DIKIM': 'Dikim',
      'BASKI_NAKIS': 'Baskı/Nakış',
      'KESIM': 'Kesim',
      'UTU': 'Ütü'
    };
    return labels[specialization] || specialization;
  };

  const filteredReports = reports.filter(report =>
    report.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (specializationFilter === '' || report.specialization === specializationFilter)
  );

  const totals = {
    totalGoods: filteredReports.reduce((sum, r) => sum + r.currentGoods, 0),
    totalValue: filteredReports.reduce((sum, r) => sum + r.totalValue, 0),
    totalBalance: filteredReports.reduce((sum, r) => sum + r.balance, 0),
    totalWorks: filteredReports.reduce((sum, r) => sum + r.totalWorks, 0),
    completedWorks: filteredReports.reduce((sum, r) => sum + r.completedWorks, 0)
  };

  const exportToExcel = () => {
    alert('Excel raporu indiriliyor...');
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
                Fason Raporları
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={exportToExcel}
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
                Excel'e Aktar
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
              <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>
                {totals.totalGoods}
              </div>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>Toplam Mal</div>
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
                {totals.totalValue.toLocaleString('tr-TR')} ₺
              </div>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>Toplam Değer</div>
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
                {totals.totalBalance.toLocaleString('tr-TR')} ₺
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
                {totals.completedWorks}/{totals.totalWorks}
              </div>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>Tamamlanan İşler</div>
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
                placeholder="Atölye adı ara..."
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
              </TextField>

              <TextField
                select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                fullWidth
                size="small"
                style={{ backgroundColor: 'white', borderRadius: '12px' }}
              >
                <MenuItem value="">Tüm Zamanlar</MenuItem>
                <MenuItem value="today">Bugün</MenuItem>
                <MenuItem value="week">Bu Hafta</MenuItem>
                <MenuItem value="month">Bu Ay</MenuItem>
                <MenuItem value="year">Bu Yıl</MenuItem>
              </TextField>
            </div>
          </CardContent>
        </Card>

        {/* Rapor Tablosu */}
        <Card style={{ 
          borderRadius: '16px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <CardContent style={{ padding: 0 }}>
            <TableContainer component={Paper} style={{ borderRadius: '16px', overflow: 'hidden' }}>
              <Table>
                <TableHead style={{ backgroundColor: '#F8FAFC' }}>
                  <TableRow>
                    <TableCell style={{ fontWeight: 'bold', color: '#374151' }}>Atölye</TableCell>
                    <TableCell style={{ fontWeight: 'bold', color: '#374151' }}>Uzmanlık</TableCell>
                    <TableCell style={{ fontWeight: 'bold', color: '#374151' }}>Elindeki Mal</TableCell>
                    <TableCell style={{ fontWeight: 'bold', color: '#374151' }}>Birim Fiyat</TableCell>
                    <TableCell style={{ fontWeight: 'bold', color: '#374151' }}>Toplam Değer</TableCell>
                    <TableCell style={{ fontWeight: 'bold', color: '#374151' }}>Bakiye</TableCell>
                    <TableCell style={{ fontWeight: 'bold', color: '#374151' }}>Son İş Tarihi</TableCell>
                    <TableCell style={{ fontWeight: 'bold', color: '#374151' }}>Tamamlanma</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredReports.map((report) => (
                    <TableRow key={report.id} style={{ backgroundColor: 'white' }}>
                      <TableCell style={{ fontWeight: '500' }}>{report.name}</TableCell>
                      <TableCell>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          backgroundColor: '#F3F4F6',
                          color: '#374151'
                        }}>
                          {getSpecializationLabel(report.specialization)}
                        </span>
                      </TableCell>
                      <TableCell style={{ fontWeight: '600' }}>{report.currentGoods} adet</TableCell>
                      <TableCell>{report.unitPrice.toLocaleString('tr-TR')} ₺</TableCell>
                      <TableCell style={{ fontWeight: '600', color: '#10B981' }}>
                        {report.totalValue.toLocaleString('tr-TR')} ₺
                      </TableCell>
                      <TableCell style={{ 
                        fontWeight: 'bold',
                        color: report.balance >= 0 ? '#10B981' : '#EF4444'
                      }}>
                        {report.balance.toLocaleString('tr-TR')} ₺
                      </TableCell>
                      <TableCell>
                        {new Date(report.lastWorkDate).toLocaleDateString('tr-TR')}
                      </TableCell>
                      <TableCell>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '14px' }}>
                            {report.completedWorks}/{report.totalWorks}
                          </span>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            backgroundColor: '#10B981',
                            color: 'white'
                          }}>
                            %{Math.round((report.completedWorks / report.totalWorks) * 100)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {filteredReports.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 24px' }}>
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
                  <Package size={32} color="#6B7280" />
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 'semibold', color: '#374151', margin: '0 0 8px 0' }}>
                  Rapor bulunamadı
                </h3>
                <p style={{ color: '#6B7280', margin: 0 }}>
                  Filtrelerinizi kontrol edin.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FasonReports;