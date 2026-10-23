import { useState, useEffect } from 'react';
import axios from 'axios';

interface CuttingOrder {
  id: number;
  modelNo: string;
  modelName: string;
  orderNo: string;
  customerId: string;
  colors: string;
  fabricType: string;
  reportNumber: string;
  plannedLayers: string;
  actualLayers: string;
  createdAt: string;
  cuttingTable: { name: string };
  productWeightKg: number;
  productLengthMeter: number;
  unitType: 'kg' | 'm';
  grammage?: number;
  fabricEntry?: {
    fabric?: {
      name?: string;
      averageGrammage?: number | null;
    };
  };
}

interface CustomerLayerData {
  customerName: string;
  plannedLayers: number;
  actualLayers: number;
  colors: string[];
}

export default function CuttingOrders() {
  const [cuttingOrders, setCuttingOrders] = useState<CuttingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<CuttingOrder | null>(null);
  const [customerLayers, setCustomerLayers] = useState<CustomerLayerData[]>([]);

  useEffect(() => {
    fetchCuttingOrders();
  }, []);

  const fetchCuttingOrders = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/fabric-exits');
      setCuttingOrders(response.data);
    } catch (error) {
      console.error('Kesim emirleri alınamadı:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOrderSelect = (order: CuttingOrder) => {
    setSelectedOrder(order);

    // Müşteri bazlı kat sayısı verilerini hazırla
    const customers = (order.customerId || '').split(', ');
    const colors = (order.colors || '').split(', ');

    const layerData: CustomerLayerData[] = customers.map(customer => ({
      customerName: customer,
      plannedLayers: 0, // Planlanan kat sayısı
      actualLayers: 0,  // Atılan kat sayısı
      colors: colors
    }));

    setCustomerLayers(layerData);
  };

  const updateCustomerLayer = (index: number, field: 'plannedLayers' | 'actualLayers', value: number) => {
    setCustomerLayers(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );

    // Değişiklikleri veritabanına kaydet
    saveLayerData();
  };

  const saveLayerData = async () => {
    if (!selectedOrder) return;

    try {
      const plannedLayers = customerLayers.map(item => item.plannedLayers);
      const actualLayers = customerLayers.map(item => item.actualLayers);

      await axios.put(`/api/fabric-exits/${selectedOrder.id}`, {
        plannedLayers: JSON.stringify(plannedLayers),
        actualLayers: JSON.stringify(actualLayers)
      });

      // Listeyi güncelle
      setCuttingOrders(prev =>
        prev.map(order =>
          order.id === selectedOrder.id
            ? { ...order, plannedLayers: JSON.stringify(plannedLayers), actualLayers: JSON.stringify(actualLayers) }
            : order
        )
      );
    } catch (error) {
      console.error('Kat sayısı verileri kaydedilemedi:', error);
    }
  };

  const exportToPDF = async () => {
    if (!selectedOrder) return;

    const { jsPDF } = await import('jspdf');
    type AutoTableFn = (doc: InstanceType<typeof jsPDF>, options: Record<string, unknown>) => void;
    const autoTable = (await import('jspdf-autotable')).default as AutoTableFn;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text('Kesim Emri Raporu', 14, 20);

    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Rapor Numarası: ${selectedOrder.reportNumber}`, 14, 30);
    doc.text(`Model: ${selectedOrder.modelNo} - ${selectedOrder.modelName}`, 14, 38);
    doc.text(`Sipariş No: ${selectedOrder.orderNo}`, 14, 46);
    doc.text(`Kumaş Türü: ${selectedOrder.fabricType}`, 14, 54);
    doc.text(`Kesim Masası: ${selectedOrder.cuttingTable.name}`, 14, 62);
    doc.text(`Tarih: ${new Date(selectedOrder.createdAt).toLocaleDateString('tr-TR')}`, 14, 70);
    doc.text(`Üretim Miktarı: ${selectedOrder.unitType === 'kg' ? selectedOrder.productWeightKg : selectedOrder.productLengthMeter} ${selectedOrder.unitType}`, 14, 78);

    // Müşteri bazlı kat sayısı tablosu
    const tableData = customerLayers.map(item => [
      item.customerName,
      item.colors.join(', '),
      item.plannedLayers.toString(),
      item.actualLayers.toString()
    ]);

    autoTable(doc, {
      startY: 88,
      head: [['Müşteri', 'Renkler', 'Planlanan Kat', 'Atılan Kat']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 4,
      },
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: 255,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { fontStyle: 'bold' },
        2: { halign: 'center' },
        3: { halign: 'center' }
      }
    });

    doc.save(`kesim-emri-${selectedOrder.reportNumber}.pdf`);
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, color: '#2c3e50' }}>📋 Kesim Emirleri</h1>
        {selectedOrder && (
          <button
            onClick={exportToPDF}
            style={{
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            📄 PDF&apos;e Aktar
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        {/* Kesim Emirleri Listesi */}
        <div style={{ flex: 1 }}>
          <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>Kesim Emirleri</h2>
          <div style={{ border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Rapor No</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Model</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Müşteriler</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Renkler</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Tarih</th>
                </tr>
              </thead>
              <tbody>
                {cuttingOrders.map(order => (
                  <tr
                    key={order.id}
                    onClick={() => handleOrderSelect(order)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: selectedOrder?.id === order.id ? '#e3f2fd' : 'transparent',
                      borderBottom: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedOrder?.id !== order.id) {
                        e.currentTarget.style.backgroundColor = '#f8f9fa';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedOrder?.id !== order.id) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <td style={{ padding: '12px' }}>{order.reportNumber}</td>
                    <td style={{ padding: '12px' }}>{order.modelNo}</td>
                    <td style={{ padding: '12px' }}>{order.customerId}</td>
                    <td style={{ padding: '12px' }}>{order.colors}</td>
                    <td style={{ padding: '12px' }}>
                      {new Date(order.createdAt).toLocaleDateString('tr-TR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detay Görünümü */}
        {selectedOrder && (
          <div style={{ flex: 1 }}>
            <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>Kesim Emri Detayı</h2>
            <div style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px' }}>
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>Genel Bilgiler</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div><strong>Rapor No:</strong> {selectedOrder.reportNumber}</div>
                  <div><strong>Model:</strong> {selectedOrder.modelNo} - {selectedOrder.modelName}</div>
                  <div><strong>Sipariş No:</strong> {selectedOrder.orderNo}</div>
                  <div><strong>Kumaş Türü:</strong> {selectedOrder.fabricType}</div>
                  <div><strong>Kesim Masası:</strong> {selectedOrder.cuttingTable.name}</div>
                  <div><strong>Tarih:</strong> {new Date(selectedOrder.createdAt).toLocaleDateString('tr-TR')}</div>
                  <div><strong>Üretim Miktarı:</strong> {selectedOrder.unitType === 'kg' ? selectedOrder.productWeightKg : selectedOrder.productLengthMeter} {selectedOrder.unitType}</div>
                  <div><strong>Ürün Ortalama Gramajı:</strong> {selectedOrder.grammage ?? 0}</div>
                  <div><strong>Kumaş Ortalama Gramajı:</strong> {selectedOrder.fabricEntry?.fabric?.averageGrammage ?? 0}</div>
                </div>
              </div>

              <div>
                <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>Müşteri Bazlı Kat Sayıları</h3>
                <div style={{ border: '1px solid #ddd', borderRadius: '6px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#e9ecef' }}>
                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Müşteri</th>
                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Renkler</th>
                        <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>Planlanan Kat</th>
                        <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>Atılan Kat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerLayers.map((item, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '10px', fontWeight: 'bold' }}>{item.customerName}</td>
                          <td style={{ padding: '10px' }}>{item.colors.join(', ')}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <input
                              type="number"
                              value={item.plannedLayers}
                              onChange={(e) => updateCustomerLayer(index, 'plannedLayers', parseInt(e.target.value) || 0)}
                              style={{
                                width: '60px',
                                padding: '4px',
                                textAlign: 'center',
                                border: '1px solid #ddd',
                                borderRadius: '4px'
                              }}
                              min="0"
                            />
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <input
                              type="number"
                              value={item.actualLayers}
                              onChange={(e) => updateCustomerLayer(index, 'actualLayers', parseInt(e.target.value) || 0)}
                              style={{
                                width: '60px',
                                padding: '4px',
                                textAlign: 'center',
                                border: '1px solid #ddd',
                                borderRadius: '4px'
                              }}
                              min="0"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
