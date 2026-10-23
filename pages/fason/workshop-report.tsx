import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Button,
  Box,
} from '@mui/material';
import {
  ArrowLeft,
  Printer,
  Download,
  CheckCircle,
  Clock,
  X,
} from 'lucide-react';

interface WorkshopServiceCost {
  workshopId: number;
  workshopName: string;
  workshopType: string;
  cost: number;
  quantity: number;
}

interface WorkOrderReport {
  id: number;
  modelCode: string;
  modelName: string;
  cuttingNumber: string;
  slipNumber: string;
  totalQuantity: number;
  services: WorkshopServiceCost[];
  totalCost: number;
  createdAt: string;
  status: string;
}

const WorkshopReportPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  const [report, setReport] = useState<WorkOrderReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (orderId) {
      fetchWorkshopReport();
    }
  }, [orderId]);

  const fetchWorkshopReport = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');

      const response = await fetch(`/api/fason/workshop-report/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setReport(data.report);
      } else {
        setError('Rapor yÃ¼klenirken hata oluÅŸtu');
      }
    } catch (err) {
      console.error('Rapor yÃ¼kleme hatasÄ±:', err);
      setError('Bir hata oluÅŸtu');
    } finally {
      setLoading(false);
    }
  };

  const getWorkshopTypeLabel = (type: string): string => {
    const labels: { [key: string]: string } = {
      'DIKIM': 'Dikim AtÃ¶lyesi',
      'UTU': 'ÃœtÃ¼ AtÃ¶lyesi',
      'BASKI_NAKIS': 'BaskÄ±/NakÄ±ÅŸ AtÃ¶lyesi',
      'KESIM': 'Kesim AtÃ¶lyesi',
    };
    return labels[type] || type;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'TAMAMLANDI':
      case 'TESLIM_EDILDI':
        return '#10B981';
      case 'BEKLIYOR':
        return '#F59E0B';
      case 'IPTAL_EDILDI':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusLabel = (status: string): string => {
    const labels: { [key: string]: string } = {
      'TAMAMLANDI': 'TamamlandÄ±',
      'TESLIM_EDILDI': 'Teslim Edildi',
      'BEKLIYOR': 'Bekliyor',
      'IPTAL_EDILDI': 'Ä°ptal Edildi',
    };
    return labels[status] || status;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'TAMAMLANDI':
      case 'TESLIM_EDILDI':
        return <CheckCircle size={20} color="#10B981" />;
      case 'BEKLIYOR':
        return <Clock size={20} color="#F59E0B" />;
      case 'IPTAL_EDILDI':
        return <X size={20} color="#EF4444" />;
      default:
        return null;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // Generate CSV
    let csv = 'AtÃ¶lye Raporu\n';
    csv += `Model Kodu,${report?.modelCode}\n`;
    csv += `Model AdÄ±,${report?.modelName}\n`;
    csv += `Kesim No,${report?.cuttingNumber}\n`;
    csv += `FiÅŸ No,${report?.slipNumber}\n`;
    csv += `Toplam Adet,${report?.totalQuantity}\n`;
    csv += `\nAtÃ¶lye Hizmetleri\n`;
    csv += 'AtÃ¶lye AdÄ±,AtÃ¶lye TÃ¼rÃ¼,Miktar,Ãœcret\n';

    report?.services.forEach((service) => {
      csv += `${service.workshopName},${getWorkshopTypeLabel(service.workshopType)},${service.quantity},${service.cost}\n`;
    });

    csv += `\nToplam AtÃ¶lye Ãœcreti,${report?.totalCost}\n`;

    const element = document.createElement('a');
    element.setAttribute(
      'href',
      'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    );
    element.setAttribute(
      'download',
      `atolye-raporu-${report?.modelCode}.csv`
    );
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)',
        }}
      >
        <CircularProgress />
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)',
          padding: '24px',
        }}
      >
        <Card style={{ maxWidth: '600px', margin: '0 auto', marginTop: '50px' }}>
          <CardContent>
            <Alert severity="error">{error}</Alert>
            <Button
              variant="contained"
              onClick={() => router.back()}
              style={{ marginTop: '16px' }}
            >
              Geri DÃ¶n
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)',
        padding: '24px',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
          padding: '24px 32px',
          borderRadius: '16px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => router.back()}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              cursor: 'pointer',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1
              style={{
                fontSize: '32px',
                fontWeight: 'bold',
                color: 'white',
                margin: 0,
              }}
            >
              MIRA STOK
            </h1>
            <p
              style={{
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '14px',
                margin: '4px 0 0 0',
              }}
            >
              AtÃ¶lye Raporu
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handlePrint}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            <Printer size={20} />
            YazdÄ±r
          </button>
          <button
            onClick={handleDownload}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            <Download size={20} />
            CSV Ä°ndir
          </button>
        </div>
      </div>

      {report && (
        <>
          {/* Work Order Info Card */}
          <Card
            style={{
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              marginBottom: '24px',
            }}
          >
            <CardContent>
              <h2
                style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  marginBottom: '16px',
                  color: '#1F2937',
                }}
              >
                Ä°ÅŸ Emri Bilgileri
              </h2>

              <Grid container spacing={2} style={{ marginBottom: '16px' }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <div style={{ marginBottom: '16px' }}>
                    <label
                      style={{
                        fontSize: '12px',
                        color: '#6B7280',
                        fontWeight: '500',
                        display: 'block',
                        marginBottom: '4px',
                      }}
                    >
                      Model Kodu
                    </label>
                    <p
                      style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: '#1F2937',
                        margin: 0,
                      }}
                    >
                      {report.modelCode}
                    </p>
                  </div>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <div style={{ marginBottom: '16px' }}>
                    <label
                      style={{
                        fontSize: '12px',
                        color: '#6B7280',
                        fontWeight: '500',
                        display: 'block',
                        marginBottom: '4px',
                      }}
                    >
                      Kesim No
                    </label>
                    <p
                      style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: '#1F2937',
                        margin: 0,
                      }}
                    >
                      {report.cuttingNumber}
                    </p>
                  </div>
                </Grid>
              </Grid>

              <Grid container spacing={2} style={{ marginBottom: '16px' }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <div style={{ marginBottom: '16px' }}>
                    <label
                      style={{
                        fontSize: '12px',
                        color: '#6B7280',
                        fontWeight: '500',
                        display: 'block',
                        marginBottom: '4px',
                      }}
                    >
                      FiÅŸ No
                    </label>
                    <p
                      style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: '#1F2937',
                        margin: 0,
                      }}
                    >
                      {report.slipNumber}
                    </p>
                  </div>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <div style={{ marginBottom: '16px' }}>
                    <label
                      style={{
                        fontSize: '12px',
                        color: '#6B7280',
                        fontWeight: '500',
                        display: 'block',
                        marginBottom: '4px',
                      }}
                    >
                      Toplam Adet
                    </label>
                    <p
                      style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: '#1F2937',
                        margin: 0,
                      }}
                    >
                      {report.totalQuantity}
                    </p>
                  </div>
                </Grid>
              </Grid>

              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    fontSize: '12px',
                    color: '#6B7280',
                    fontWeight: '500',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Model AdÄ±
                </label>
                <p
                  style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#1F2937',
                    margin: 0,
                  }}
                >
                  {report.modelName}
                </p>
              </div>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <div>
                    <label
                      style={{
                        fontSize: '12px',
                        color: '#6B7280',
                        fontWeight: '500',
                        display: 'block',
                        marginBottom: '8px',
                      }}
                    >
                      Durum
                    </label>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        backgroundColor: `${getStatusColor(report.status)}20`,
                        borderRadius: '8px',
                        width: 'fit-content',
                      }}
                    >
                      {getStatusIcon(report.status)}
                      <span
                        style={{
                          color: getStatusColor(report.status),
                          fontWeight: '600',
                        }}
                      >
                        {getStatusLabel(report.status)}
                      </span>
                    </div>
                  </div>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <div>
                    <label
                      style={{
                        fontSize: '12px',
                        color: '#6B7280',
                        fontWeight: '500',
                        display: 'block',
                        marginBottom: '4px',
                      }}
                    >
                      Tarih
                    </label>
                    <p
                      style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1F2937',
                        margin: 0,
                      }}
                    >
                      {new Date(report.createdAt).toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Workshop Services Card */}
          <Card
            style={{
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              marginBottom: '24px',
            }}
          >
            <CardContent>
              <h2
                style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  marginBottom: '16px',
                  color: '#1F2937',
                }}
              >
                AtÃ¶lye Hizmetleri ve Ãœcretleri
              </h2>

              {report.services && report.services.length > 0 ? (
                <TableContainer component={Paper} style={{ borderRadius: '12px' }}>
                  <Table>
                    <TableHead style={{ backgroundColor: '#F8FAFC' }}>
                      <TableRow>
                        <TableCell style={{ fontWeight: '600', color: '#374151' }}>
                          AtÃ¶lye AdÄ±
                        </TableCell>
                        <TableCell style={{ fontWeight: '600', color: '#374151' }}>
                          AtÃ¶lye TÃ¼rÃ¼
                        </TableCell>
                        <TableCell
                          align="right"
                          style={{ fontWeight: '600', color: '#374151' }}
                        >
                          Miktar
                        </TableCell>
                        <TableCell
                          align="right"
                          style={{ fontWeight: '600', color: '#374151' }}
                        >
                          Ãœcret
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {report.services.map((service, index) => (
                        <TableRow key={index}>
                          <TableCell style={{ fontWeight: '500' }}>
                            {service.workshopName}
                          </TableCell>
                          <TableCell>
                            <span
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                backgroundColor: '#EFF6FF',
                                color: '#3B82F6',
                              }}
                            >
                              {getWorkshopTypeLabel(service.workshopType)}
                            </span>
                          </TableCell>
                          <TableCell align="right" style={{ fontWeight: '600' }}>
                            {service.quantity}
                          </TableCell>
                          <TableCell
                            align="right"
                            style={{ fontWeight: '600', color: '#10B981' }}
                          >
                            {service.cost.toLocaleString('tr-TR')} â‚º
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* Total Row */}
                      <TableRow style={{ backgroundColor: '#F0FDF4' }}>
                        <TableCell
                          colSpan={3}
                          style={{
                            fontWeight: '600',
                            textAlign: 'right',
                            color: '#047857',
                          }}
                        >
                          Toplam AtÃ¶lye Ãœcreti
                        </TableCell>
                        <TableCell
                          align="right"
                          style={{
                            fontWeight: '700',
                            color: '#10B981',
                            fontSize: '16px',
                          }}
                        >
                          {report.totalCost.toLocaleString('tr-TR')} â‚º
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <p
                  style={{
                    textAlign: 'center',
                    color: '#6B7280',
                    padding: '24px 0',
                  }}
                >
                  HenÃ¼z hizmet kaydÄ± bulunmamaktadÄ±r
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default WorkshopReportPage;

