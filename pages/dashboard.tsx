import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import AuthGuard from "../components/AuthGuard";

interface WorkOrder {
  id: number;
  orderNo: string;
  productName: string;
  quantity: number;
  unit: string;
  customerName: string;
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'normal' | 'medium' | 'high';
  dueDate: string | null;
  workshopName: string;
  progress: number;
  remainingDays: number | null;
  createdAt: string;
}

function DashboardContent() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in-progress' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMobileWorkOrders();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (listRef.current) {
        setShowScrollTop(listRef.current.scrollTop > 300);
      }
    };

    const element = listRef.current;
    if (element) {
      element.addEventListener('scroll', handleScroll);
      return () => element.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const scrollToTop = () => {
    if (listRef.current) {
      listRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const fetchMobileWorkOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
      const response = await fetch(`/api/fason/work-orders/mobile?page=1&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setWorkOrders(data.workOrders || []);
    } catch (error) {
      console.error('İşler yüklenirken hata:', error);
      setError('İşler yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin.');
      setWorkOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = workOrders
    .filter(order => statusFilter === 'all' || order.status === statusFilter)
    .filter(order => {
      const searchLower = searchQuery.toLowerCase();
      return (
        order.orderNo.toLowerCase().includes(searchLower) ||
        order.productName.toLowerCase().includes(searchLower) ||
        order.customerName.toLowerCase().includes(searchLower) ||
        order.workshopName.toLowerCase().includes(searchLower)
      );
    });

  const stats = [
    {
      label: 'Toplam İş',
      value: workOrders.length,
      color: '#4338ca',
    },
    {
      label: 'Beklemede',
      value: workOrders.filter(o => o.status === 'pending').length,
      color: '#3B82F6',
    },
    {
      label: 'İşleniyor',
      value: workOrders.filter(o => o.status === 'in-progress').length,
      color: '#F59E0B',
    },
    {
      label: 'Tamamlandı',
      value: workOrders.filter(o => o.status === 'completed').length,
      color: '#10B981',
    },
  ];

  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'pending': return 'Beklemede';
      case 'in-progress': return 'İşleniyor';
      case 'completed': return 'Tamamlandı';
      default: return 'Bilinmeyen';
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending': return '#3B82F6';
      case 'in-progress': return '#F59E0B';
      case 'completed': return '#10B981';
      default: return '#6B7280';
    }
  };

  return (
    <main style={{ maxWidth: "1200px", margin: "40px auto", padding: "0 20px" }}>
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <span style={{ backgroundColor: "#e0e7ff", color: "#4338ca", padding: "4px 12px", borderRadius: "12px", fontSize: "14px" }}>
          Dış Kaynak Üretim Takip Sistemi
        </span>
        <h1 style={{ fontSize: "2.5rem", fontWeight: "bold", marginTop: "12px" }}>Mira Dış Kaynak Üretim Takip</h1>
        <p style={{ fontSize: "1.125rem", color: "#6b7280", marginTop: "8px" }}>
          Dış Kaynak Üretim atölye süreçlerini gerçek zamanlı takip edin, iş emirlerini yönetin ve üretim verimliliğinizi artırın.
        </p>
      </div>

      {/* Stats Section */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", marginBottom: "40px" }}>
        {stats.map((stat, idx) => (
          <div key={idx} style={{
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "20px",
            backgroundColor: "white",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
          }}>
            <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: "8px" }}>{stat.label}</div>
            <div style={{ fontSize: "32px", fontWeight: "bold", color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* My Work Orders Section */}
      <div style={{ marginBottom: "40px" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "20px" }}>Benim İşlerim</h2>

        {/* Search Box */}
        <div style={{ marginBottom: "20px" }}>
          <input
            type="text"
            placeholder="İş emrini, ürünü, müşteriyi veya atölyeyi ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              fontSize: "14px",
              backgroundColor: "white",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              transition: "border-color 0.2s ease",
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#4338ca")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
          />
        </div>

        {/* Filter Buttons */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
          <FilterButton 
            label="Tümü" 
            isActive={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
          />
          <FilterButton 
            label="Beklemede" 
            isActive={statusFilter === 'pending'}
            onClick={() => setStatusFilter('pending')}
            color="#3B82F6"
          />
          <FilterButton 
            label="İşleniyor" 
            isActive={statusFilter === 'in-progress'}
            onClick={() => setStatusFilter('in-progress')}
            color="#F59E0B"
          />
          <FilterButton 
            label="Tamamlandı" 
            isActive={statusFilter === 'completed'}
            onClick={() => setStatusFilter('completed')}
            color="#10B981"
          />
        </div>

        {/* Work Orders List */}
        {error && (
          <div style={{ 
            textAlign: "center", 
            padding: "20px", 
            backgroundColor: "#FEE2E2",
            color: "#DC2626",
            borderRadius: "8px",
            marginBottom: "20px"
          }}>
            {error}
          </div>
        )}
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>Yükleniyor...</div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
            {searchQuery ? "Arama kriterine uygun iş bulunmamaktadır" : "Bu durumda iş bulunmamaktadır"}
          </div>
        ) : (
          <div 
            ref={listRef}
            style={{ 
              display: "grid", 
              gap: "16px",
              maxHeight: "600px",
              overflowY: "auto",
              paddingRight: "8px",
            }}
          >
            {filteredOrders.map(order => (
              <WorkOrderCard key={order.id} order={order} />
            ))}
          </div>
        )}

        {/* Scroll to Top Button */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            style={{
              position: "fixed",
              bottom: "30px",
              right: "30px",
              width: "50px",
              height: "50px",
              borderRadius: "50%",
              backgroundColor: "#4338ca",
              color: "white",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(67, 56, 202, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              transition: "all 0.3s ease",
              zIndex: 1000,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#3730a3";
              e.currentTarget.style.boxShadow = "0 6px 16px rgba(67, 56, 202, 0.6)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#4338ca";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(67, 56, 202, 0.4)";
            }}
            title="Yukarı Kaydır"
          >
            ↑
          </button>
        )}
      </div>

<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px" }}>
        <Card title="Dış Kaynak Üretim Dashboard" description="İş emirlerini Görüntüleyin, süreçleri takip edin ve detaylı raporlar oluşturun" />
        <Card title="Mobil Takipçi" description="Telefon uygulaması için optimize edilmiş gerçek zamanlı takip formu" />
        <Card title="Atölye Yönetimi" description="Dış Kaynak Üretim atölyelerini kaydedin, düzenleyin ve performanslarını izleyin" />
        <Card title="İş Emri Oluştur" description="Manuel iş emri oluşturun veya ERP sisteminden otomatik alın" />
        <Card title="Takipçi Yönetimi" description="Dış Kaynak Üretim takipülerini yönetin, görevler atayın ve performans takibi yapın" />
        <Card title="Dış Kaynak Üretim Raporları" description="Detaylı dış kaynak üretim takip raporları, analizler ve performans metrikleri" />
      </div>
    </main>
  );
}

function FilterButton({ label, isActive, onClick, color = "#4338ca" }: { label: string; isActive: boolean; onClick: () => void; color?: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 16px",
        borderRadius: "8px",
        border: `2px solid ${isActive ? color : "#e5e7eb"}`,
        backgroundColor: isActive ? color : "white",
        color: isActive ? "white" : "#6b7280",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: "500",
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.borderColor = color;
          e.currentTarget.style.color = color;
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.borderColor = "#e5e7eb";
          e.currentTarget.style.color = "#6b7280";
        }
      }}
    >
      {label}
    </button>
  );
}

function WorkOrderCard({ order }: { order: WorkOrder }) {
  const statusColor = {
    pending: '#3B82F6',
    'in-progress': '#F59E0B',
    completed: '#10B981',
  }[order.status];

  const statusLabel = {
    pending: 'Beklemede',
    'in-progress': 'İşleniyor',
    completed: 'Tamamlandı',
  }[order.status];

  return (
    <div style={{
      border: "1px solid #e5e7eb",
      borderLeft: `4px solid ${statusColor}`,
      borderRadius: "12px",
      padding: "16px",
      backgroundColor: "white",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
        <div>
          <div style={{ fontSize: "16px", fontWeight: "bold", color: "#1f2937" }}>{order.orderNo}</div>
          <div style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>{order.productName}</div>
        </div>
        <div style={{
          padding: "6px 12px",
          borderRadius: "6px",
          backgroundColor: statusColor + "20",
          color: statusColor,
          fontSize: "12px",
          fontWeight: "600",
        }}>
          {statusLabel}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "12px", fontSize: "14px" }}>
        <div>
          <div style={{ color: "#6b7280", marginBottom: "4px" }}>Müşteri</div>
          <div style={{ fontWeight: "500", color: "#1f2937" }}>{order.customerName}</div>
        </div>
        <div>
          <div style={{ color: "#6b7280", marginBottom: "4px" }}>Atölye</div>
          <div style={{ fontWeight: "500", color: "#1f2937" }}>{order.workshopName || "-"}</div>
        </div>
        <div>
          <div style={{ color: "#6b7280", marginBottom: "4px" }}>Miktar</div>
          <div style={{ fontWeight: "500", color: "#1f2937" }}>{order.quantity} {order.unit}</div>
        </div>
        <div>
          <div style={{ color: "#6b7280", marginBottom: "4px" }}>Teslim Tarihi</div>
          <div style={{ fontWeight: "500", color: "#1f2937" }}>
            {order.dueDate ? new Date(order.dueDate).toLocaleDateString('tr-TR') : "-"}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
          <div style={{ fontSize: "13px", color: "#6b7280" }}>İlerleme</div>
          <div style={{ fontSize: "13px", fontWeight: "600", color: statusColor }}>{order.progress}%</div>
        </div>
        <div style={{ height: "6px", backgroundColor: "#f3f4f6", borderRadius: "3px", overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${order.progress}%`,
            backgroundColor: statusColor,
            transition: "width 0.3s ease"
          }} />
        </div>
      </div>

      {order.remainingDays !== null && (
        <div style={{ fontSize: "13px", color: order.remainingDays < 0 ? "#EF4444" : order.remainingDays <= 2 ? "#F59E0B" : "#6b7280" }}>
          {order.remainingDays < 0 
            ? `⚠️ ${Math.abs(order.remainingDays)} gün geçmiş`
            : `📅 ${order.remainingDays} gün kaldı`
          }
        </div>
      )}
    </div>
  );
}

function Card({ title, description }: { title: string; description: string }) {
  return (
    <div style={{
      border: "1px solid #e5e7eb",
      borderRadius: "12px",
      padding: "20px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      backgroundColor: "white",
      cursor: "pointer",
      transition: "box-shadow 0.3s ease",
    }}
    onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)")}
    onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)")}
    >
      <h3 style={{ fontWeight: "600", fontSize: "1.125rem", marginBottom: "8px" }}>{title}</h3>
      <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>{description}</p>
    </div>
  );
}

export default function Dashboard() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
