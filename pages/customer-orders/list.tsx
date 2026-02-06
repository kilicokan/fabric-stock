import { useState, useEffect } from "react";
import axios from "axios";
import ExportButtons from '../../components/ExportButtons';
import * as XLSX from 'xlsx';

interface CustomerOrder {
  id: number;
  orderNo: string;
  productCode: string;
  color: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  customer: {
    id: number;
    name: string;
    phone?: string;
    email?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export default function CustomerOrderList() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await axios.get<CustomerOrder[]>('/api/customer-orders');
      setOrders(response.data);
    } catch (err) {
      setError('Siparişler yüklenemedi');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteOrder = async (id: number) => {
    if (!confirm('Bu siparişi silmek istediğinizden emin misiniz?')) return;

    try {
      await axios.delete('/api/customer-orders', { data: { id } });
      setOrders(prev => prev.filter(order => order.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Sipariş silinemedi');
    }
  };

  const filteredOrders = orders.filter(order =>
    order.orderNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.color.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportData = filteredOrders.map(order => ({
    'Sipariş No': order.orderNo,
    'Ürün Kodu': order.productCode,
    'Renk': order.color,
    'Açıklama': order.description || '',
    'Miktar': order.quantity,
    'Birim Fiyat': order.unitPrice,
    'Toplam Tutar': order.totalPrice,
    'Müşteri': order.customer.name,
    'Telefon': order.customer.phone || '',
    'E-posta': order.customer.email || '',
    'Oluşturulma Tarihi': new Date(order.createdAt).toLocaleDateString('tr-TR')
  }));

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>📦 Müşteri Sipariş Listesi</h1>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.controls}>
        <div style={styles.searchContainer}>
          <input
            type="text"
            placeholder="Sipariş No, Ürün Kodu, Müşteri veya Renk ile ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        <ExportButtons
          data={exportData}
          filename="Musteri_Siparisleri"
        />
      </div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Sipariş No</th>
              <th style={styles.th}>Ürün Kodu</th>
              <th style={styles.th}>Renk</th>
              <th style={styles.th}>Miktar</th>
              <th style={styles.th}>Birim Fiyat</th>
              <th style={styles.th}>Toplam Tutar</th>
              <th style={styles.th}>Müşteri</th>
              <th style={styles.th}>Tarih</th>
              <th style={styles.th}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length > 0 ? (
              filteredOrders.map(order => (
                <tr key={order.id} style={styles.tr}>
                  <td style={styles.td}>{order.orderNo}</td>
                  <td style={styles.td}>{order.productCode}</td>
                  <td style={styles.td}>{order.color}</td>
                  <td style={styles.td}>{order.quantity}</td>
                  <td style={styles.td}>₺{order.unitPrice.toFixed(2)}</td>
                  <td style={styles.td}>₺{order.totalPrice.toFixed(2)}</td>
                  <td style={styles.td}>
                    <div style={styles.customerInfo}>
                      <div style={styles.customerName}>{order.customer.name}</div>
                      {order.customer.phone && (
                        <div style={styles.customerPhone}>{order.customer.phone}</div>
                      )}
                    </div>
                  </td>
                  <td style={styles.td}>
                    {new Date(order.createdAt).toLocaleDateString('tr-TR')}
                  </td>
                  <td style={styles.td}>
                    <div style={styles.actions}>
                      <button
                        onClick={() => deleteOrder(order.id)}
                        style={styles.deleteButton}
                        title="Sil"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} style={styles.noData}>
                  {searchTerm ? 'Arama kriterlerine uygun sipariş bulunamadı' : 'Henüz sipariş bulunmuyor'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '2rem auto',
    padding: '2rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
  },
  title: {
    textAlign: 'center' as const,
    color: '#2c3e50',
    marginBottom: '1.5rem',
    fontSize: '1.8rem'
  },
  controls: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '1.5rem',
    alignItems: 'center',
    flexWrap: 'wrap' as const
  },
  searchContainer: {
    flex: '1',
    minWidth: '300px'
  },
  searchInput: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '1rem',
    outline: 'none'
  },
  tableContainer: {
    overflowX: 'auto' as const,
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const
  },
  th: {
    backgroundColor: '#f8f9fa',
    padding: '1rem',
    textAlign: 'left' as const,
    fontWeight: '600',
    color: '#2c3e50',
    borderBottom: '2px solid #dee2e6',
    fontSize: '0.9rem'
  },
  tr: {
    borderBottom: '1px solid #dee2e6',
    transition: 'background-color 0.2s'
  },
  td: {
    padding: '1rem',
    verticalAlign: 'top' as const,
    fontSize: '0.9rem'
  },
  customerInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem'
  },
  customerName: {
    fontWeight: '500',
    color: '#2c3e50'
  },
  customerPhone: {
    fontSize: '0.8rem',
    color: '#6c757d'
  },
  actions: {
    display: 'flex',
    gap: '0.5rem'
  },
  deleteButton: {
    padding: '0.5rem',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    transition: 'background-color 0.2s'
  },
  noData: {
    textAlign: 'center' as const,
    padding: '3rem',
    color: '#6c757d',
    fontSize: '1.1rem'
  },
  loading: {
    textAlign: 'center' as const,
    padding: '3rem',
    color: '#6c757d',
    fontSize: '1.1rem'
  },
  error: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    padding: '0.75rem',
    borderRadius: '6px',
    marginBottom: '1.5rem',
    border: '1px solid #f5c6cb'
  }
};
