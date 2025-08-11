import Link from "next/link";
import { useRouter } from "next/router";

export default function Sidebar() {
  const router = useRouter();

  const menuItems = [
    { title: "Kumaş Girişi", icon: "📥", path: "/fabric-entry" },
    { title: "Kumaş Çıkışı", icon: "📤", path: "/fabric-exit" },
    { title: "Raporlar", icon: "📊", path: "/reports" },
    { title: "Kullanıcı Yönetimi", icon: "👤", path: "/users" },
  ];

  return (
    <div style={{
      width: "220px",
      background: "#1e1e2f",
      color: "#fff",
      height: "100vh",
      padding: "20px",
      boxSizing: "border-box"
    }}>
      <h2 style={{ marginBottom: "30px" }}>📋 MIRA OPTA</h2>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {menuItems.map((item, index) => (
          <li key={index} style={{
            marginBottom: "15px",
            background: router.pathname === item.path ? "#333" : "transparent",
            borderRadius: "5px",
            padding: "8px"
          }}>
            <Link href={item.path} style={{ color: "#fff", textDecoration: "none" }}>
              {item.icon} {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
