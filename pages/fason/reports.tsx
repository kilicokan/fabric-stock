import React, { useState, useEffect, useMemo } from 'react';
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
  Download,
  Package,
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

interface DetailedRecord {
  id: number;
  processType: string;
  tarih: string;
  atolye: string;
  orderNo: string;
  musteri: string;
  modelKodu: string;
  model: string;
  belgeNo: string;
  giden: number;
  gelen: number;
  status: string;
}

interface ApiWorkshopReport {
  id: number;
  name?: string;
  specialization?: string;
  currentGoods?: number;
  unitPrice?: number;
  totalValue?: number;
  balance?: number;
  lastWorkDate?: string;
  totalWorks?: number;
  completedWorks?: number;
  orders?: Array<{ createdAt?: string }>;
  statistics?: {
    totalQuantity?: number;
    totalAmount?: number;
    totalOrders?: number;
    byStatus?: Record<string, number>;
  };
}

const FasonReports: React.FC = () => {
  const [reports, setReports] = useState<WorkshopReport[]>([]);
  const [detailedRecords, setDetailedRecords] = useState<DetailedRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [specializationFilter, setSpecializationFilter] = useState('');
  const [dateRange, setDateRange] = useState('');
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary');

  // Inline CSS styles
  const styles = {
    primaryGradient: {
      background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/fason/reports');

      if (response.ok) {
        const data = await response.json();

        // API'den gelen veri { workshops: [...] } formatında
        const workshopsData = Array.isArray(data)
          ? data
          : Array.isArray(data?.workshops)
            ? data.workshops
            : [];

        // Veriyi WorkshopReport formatına dönüştür
        const transformedReports: WorkshopReport[] = workshopsData.map((workshop: ApiWorkshopReport) => ({
          id: workshop.id,
          name: workshop.name || '',
          specialization: workshop.specialization || '',
          currentGoods: Number(workshop.currentGoods || workshop.statistics?.totalQuantity || 0),
          unitPrice: Number(
            workshop.unitPrice ||
            (
              workshop.statistics?.totalAmount && workshop.statistics?.totalQuantity
                ? Math.round(workshop.statistics.totalAmount / workshop.statistics.totalQuantity)
                : 0
            )
          ),
          totalValue: Number(workshop.totalValue || workshop.statistics?.totalAmount || 0),
          balance: Number(workshop.balance || 0),
          lastWorkDate: workshop.lastWorkDate || workshop.orders?.[0]?.createdAt || new Date().toISOString(),
          totalWorks: Number(workshop.totalWorks || workshop.statistics?.totalOrders || 0),
          completedWorks: Number(
            workshop.completedWorks ||
            (workshop.statistics?.byStatus?.['TAMAMLADI'] || 0) +
            (workshop.statistics?.byStatus?.['TESLIM_EDILDI'] || 0)
          )
        }));

        // Tüm atölyelerin detaylı kayıtlarını topla
        const allDetailedRecords: DetailedRecord[] = Array.isArray(data?.detailedRecords)
          ? data.detailedRecords
          : [];

        if (transformedReports.length > 0) {
          setReports(transformedReports);
          setDetailedRecords(allDetailedRecords);
          setLoading(false);
          return;
        }
      }
    } catch (error) {
      console.error('Raporlar yüklenirken hata:', error);
    }

    // Boş array set et (mock data yok)
    setReports([]);
    setDetailedRecords([]);
    setLoading(false);
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

  const isDateInRange = (dateValue: string, range: string) => {
    if (!range) return true;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return false;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (range) {
      case 'today':
        return date >= startOfToday;
      case 'week': {
        const weekStart = new Date(startOfToday);
        weekStart.setDate(weekStart.getDate() - 6);
        return date >= weekStart;
      }
      case 'month':
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
      case 'year':
        return date.getFullYear() === now.getFullYear();
      default:
        return true;
    }
  };

  const filteredReports = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return reports.filter((report) => {
      const matchesSearch = normalizedSearch === '' || report.name.toLowerCase().includes(normalizedSearch);
      const matchesSpecialization = specializationFilter === '' || report.specialization === specializationFilter;
      const matchesDate = isDateInRange(report.lastWorkDate, dateRange);

      return matchesSearch && matchesSpecialization && matchesDate;
    });
  }, [reports, searchTerm, specializationFilter, dateRange]);

  const filteredDetailedRecords = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return detailedRecords.filter((record) => {
      const workshopName = (record.atolye || '').toLowerCase();
      const orderNo = (record.orderNo || '').toLowerCase();
      const customer = (record.musteri || '').toLowerCase();
      const modelCode = (record.modelKodu || '').toLowerCase();
      const modelName = (record.model || '').toLowerCase();
      const matchesSearch =
        normalizedSearch === '' ||
        workshopName.includes(normalizedSearch) ||
        orderNo.includes(normalizedSearch) ||
        customer.includes(normalizedSearch) ||
        modelCode.includes(normalizedSearch) ||
        modelName.includes(normalizedSearch);
      const matchesDate = isDateInRange(record.tarih, dateRange);

      return matchesSearch && matchesDate;
    });
  }, [detailedRecords, searchTerm, dateRange]);

  const totals = useMemo(() => ({
    totalGoods: filteredReports.reduce((sum, r) => sum + r.currentGoods, 0),
    totalValue: filteredReports.reduce((sum, r) => sum + r.totalValue, 0),
    totalBalance: filteredReports.reduce((sum, r) => sum + r.balance, 0),
    totalWorks: filteredReports.reduce((sum, r) => sum + r.totalWorks, 0),
    completedWorks: filteredReports.reduce((sum, r) => sum + r.completedWorks, 0)
  }), [filteredReports]);

  const exportToExcel = async () => {
    const hasSummaryData = filteredReports.length > 0;
    const hasDetailedData = filteredDetailedRecords.length > 0;

    if ((viewMode === 'summary' && !hasSummaryData) || (viewMode === 'detailed' && !hasDetailedData)) {
      alert('Dışa aktarılacak veri bulunamadı.');
      return;
    }

    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      const exportDate = new Date().toISOString().split('T')[0];

      if (viewMode === 'summary') {
        const summaryRows = filteredReports.map((report) => ({
          'Atölye': report.name,
          'Uzmanlık': getSpecializationLabel(report.specialization),
          'Elindeki Mal': report.currentGoods,
          'Birim Fiyat (₺)': report.unitPrice,
          'Toplam Değer (₺)': report.totalValue,
          'Bakiye (₺)': report.balance,
          'Son İş Tarihi': new Date(report.lastWorkDate).toLocaleDateString('tr-TR'),
          'Toplam İş': report.totalWorks,
          'Tamamlanan İş': report.completedWorks,
          'Tamamlanma (%)': getCompletionRate(report),
        }));

        const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Özet');
        XLSX.writeFile(workbook, `fason-raporu-ozet-${exportDate}.xlsx`);
        return;
      }

      const detailedRows = filteredDetailedRecords.map((record) => ({
        'İşlem': record.processType,
        'Tarih': new Date(record.tarih).toLocaleDateString('tr-TR'),
        'Atölye': record.atolye,
        'Order No': record.orderNo,
        'Müşteri': record.musteri,
        'Model Kodu': record.modelKodu,
        'Model': record.model,
        'Belge No': record.belgeNo,
        'Giden': record.giden,
        'Gelen': record.gelen,
        'Durum': record.status,
      }));

      const detailedSheet = XLSX.utils.json_to_sheet(detailedRows);
      XLSX.utils.book_append_sheet(workbook, detailedSheet, 'Detay');
      XLSX.writeFile(workbook, `fason-raporu-detay-${exportDate}.xlsx`);
    } catch (error) {
      console.error('Excel export hatası:', error);
      alert('Export sırasında bir hata oluştu.');
    }
  };

  const getCompletionRate = (report: WorkshopReport) => {
    if (report.totalWorks <= 0) {
      return 0;
    }

    return Math.round((report.completedWorks / report.totalWorks) * 100);
  };

  if (loading) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#374151',
        fontSize: '18px',
        fontWeight: 500
      }}>
        Atölye raporları yükleniyor...
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: 'white', margin: '0 0 8px 0' }}>
                MIRA STOK
              </h1>
              <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '16px', margin: 0 }}>
                Dış Kaynak Üretim Raporları
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setViewMode('summary')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  backgroundColor: viewMode === 'summary' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.15)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  backdropFilter: 'blur(10px)'
                }}
              >
                Özet
              </button>
              <button
                onClick={() => setViewMode('detailed')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  backgroundColor: viewMode === 'detailed' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.15)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  backdropFilter: 'blur(10px)'
                }}
              >
                Detaylı Rapor
              </button>
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
                Excel&apos;e Aktar
              </button>
            </div>
          </div>

          {/* Statistics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
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
        {viewMode === 'summary' ? (
          <Card style={{
            borderRadius: '16px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            overflowX: 'auto'
          }}>
            <CardContent style={{ padding: 0 }}>
              <TableContainer component={Paper} style={{ borderRadius: '16px', overflow: 'auto' }}>
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
                              %{getCompletionRate(report)}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {filteredReports.length === 0 && reports.length === 0 && (
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
                    Dış Kaynak Üretim İş Emri Bulunmamaktadır
                  </h3>
                  <p style={{ color: '#6B7280', margin: 0 }}>
                    Atölyelere iş emri atandığında buraya rapor görüntülenecektir.
                  </p>
                </div>
              )}

              {filteredReports.length === 0 && reports.length > 0 && (
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
                    Filtre Sonucu Rapor Bulunamadı
                  </h3>
                  <p style={{ color: '#6B7280', margin: 0 }}>
                    Lütfen filtrelerinizi kontrol edin.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card style={{
            borderRadius: '16px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            overflowX: 'auto'
          }}>
            <CardContent style={{ padding: 0 }}>
              <TableContainer component={Paper} style={{ borderRadius: '16px', overflow: 'auto' }}>
                <Table size="small">
                  <TableHead style={{ backgroundColor: '#F8FAFC' }}>
                    <TableRow>
                      <TableCell style={{ fontWeight: 'bold', color: '#374151', fontSize: '12px' }}>İşlem</TableCell>
                      <TableCell style={{ fontWeight: 'bold', color: '#374151', fontSize: '12px' }}>Tarih</TableCell>
                      <TableCell style={{ fontWeight: 'bold', color: '#374151', fontSize: '12px' }}>Atölye</TableCell>
                      <TableCell style={{ fontWeight: 'bold', color: '#374151', fontSize: '12px' }}>Order No</TableCell>
                      <TableCell style={{ fontWeight: 'bold', color: '#374151', fontSize: '12px' }}>Müşteri</TableCell>
                      <TableCell style={{ fontWeight: 'bold', color: '#374151', fontSize: '12px' }}>Model Kodu</TableCell>
                      <TableCell style={{ fontWeight: 'bold', color: '#374151', fontSize: '12px' }}>Model</TableCell>
                      <TableCell style={{ fontWeight: 'bold', color: '#374151', fontSize: '12px' }}>Belge No</TableCell>
                      <TableCell style={{ fontWeight: 'bold', color: '#374151', fontSize: '12px' }} align="right">Giden</TableCell>
                      <TableCell style={{ fontWeight: 'bold', color: '#374151', fontSize: '12px' }} align="right">Gelen</TableCell>
                      <TableCell style={{ fontWeight: 'bold', color: '#374151', fontSize: '12px' }}>Durum</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredDetailedRecords.map((record) => (
                      <TableRow key={record.id} style={{ backgroundColor: 'white' }}>
                        <TableCell style={{ fontSize: '12px' }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            backgroundColor: '#E5E7EB',
                            color: '#374151'
                          }}>
                            {record.processType}
                          </span>
                        </TableCell>
                        <TableCell style={{ fontSize: '12px' }}>
                          {new Date(record.tarih).toLocaleDateString('tr-TR')}
                        </TableCell>
                        <TableCell style={{ fontSize: '12px', fontWeight: '500' }}>{record.atolye}</TableCell>
                        <TableCell style={{ fontSize: '12px' }}>{record.orderNo}</TableCell>
                        <TableCell style={{ fontSize: '12px' }}>{record.musteri}</TableCell>
                        <TableCell style={{ fontSize: '12px' }}>{record.modelKodu}</TableCell>
                        <TableCell style={{ fontSize: '12px' }}>{record.model}</TableCell>
                        <TableCell style={{ fontSize: '12px' }}>{record.belgeNo}</TableCell>
                        <TableCell style={{ fontSize: '12px', fontWeight: '600', textAlign: 'right' }}>
                          {record.giden}
                        </TableCell>
                        <TableCell style={{ fontSize: '12px', fontWeight: '600', textAlign: 'right', color: '#10B981' }}>
                          {record.gelen}
                        </TableCell>
                        <TableCell style={{ fontSize: '12px' }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            backgroundColor: record.status === 'TAMAMLADI' || record.status === 'TESLIM_EDILDI' ? '#DCFCE7' : '#FEF3C7',
                            color: record.status === 'TAMAMLADI' || record.status === 'TESLIM_EDILDI' ? '#166534' : '#92400E'
                          }}>
                            {record.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {filteredDetailedRecords.length === 0 && (
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
                    Detaylı Kayıt Bulunmamaktadır
                  </h3>
                  <p style={{ color: '#6B7280', margin: 0 }}>
                    Atölyelere iş emri atandığında buraya rapor görüntülenecektir.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default FasonReports;

