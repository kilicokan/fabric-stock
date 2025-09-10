// pages/costumers/index.tsx
import Layout from '../../components/layout/Layout';

export default function CostumersPage() {
  return (
    <Layout>
      <div>
        <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>Müşteri Yönetimi</h1>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          {/* Müşteri listesi veya form buraya gelecek */}
          <p>Müşteri listesi burada görüntülenecek</p>
        </div>
      </div>
    </Layout>
  );
}