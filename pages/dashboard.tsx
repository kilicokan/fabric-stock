import Link from "next/link";
import AuthGuard from "../components/AuthGuard";

function DashboardContent() {
  return (
    <main style={{ maxWidth: "900px", margin: "40px auto", padding: "0 20px" }}>
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <span style={{ backgroundColor: "#e0e7ff", color: "#4338ca", padding: "4px 12px", borderRadius: "12px", fontSize: "14px" }}>
          Fason Takip Sistemi
        </span>
        <h1 style={{ fontSize: "2.5rem", fontWeight: "bold", marginTop: "12px" }}>Mira Fason Takip</h1>
        <p style={{ fontSize: "1.125rem", color: "#6b7280", marginTop: "8px" }}>
          Fason atölye süreçlerini gerçek zamanlı takip edin, iş emirlerini yönetin ve üretim verimliliğinizi artırın.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px" }}>
        <Card title="Fason Dashboard" description="İş emirlerini görüntüleyin, süreçleri takip edin ve detaylı raporlar oluşturun" />
        <Card title="Mobil Takipçi" description="Telefon uygulaması için optimize edilmiş gerçek zamanlı takip formu" />
        <Card title="Atölye Yönetimi" description="Fason atölyelerini kaydedin, düzenleyin ve performanslarını izleyin" />
        <Card title="İş Emri Oluştur" description="Manuel iş emri oluşturun veya ERP sisteminden otomatik alın" />
        <Card title="Takipçi Yönetimi" description="Fason takipçilerini yönetin, görevler atayın ve performans takibi yapın" />
        <Card title="Fason Raporları" description="Detaylı fason takip raporları, analizler ve performans metrikleri" />
      </div>
    </main>
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
