// components/layout/Sidebar.tsx
"use client";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";

const menuItems = [
  { name: "Kumaş Girişi", path: "/fabric-entry", icon: "📥" },
  { name: "Kumaş Çıkışı", path: "/fabric-exit", icon: "📤" },
  { name: "Raporlar", path: "/reports", icon: "📊" },
  { name: "Kullanıcılar", path: "/users", icon: "👥" },
  // Müşteriler menüsü alt açılır
  {
    name: "Müşteriler",
    icon: "👔",
    children: [
      { name: "Müşteri Ekle", path: "/customers?tab=add" },
      { name: "Müşteri Kartları", path: "/customers?tab=list" },
    ],
  },
  // Kumaşlar menüsü alt açılır
  {
    name: "Kumaşlar",
    icon: "🧵",
    children: [
      { name: "Kumaş Ekle", path: "/fabrics/add" },
      { name: "Kumaş Tedarik", path: "/fabrics/supply" },
      { name: "Kumaş Planlama", path: "/fabrics/planning" },
      { name: "Kumaş Siparişleri", path: "/fabrics/orders" },
      { name: "Kumaş İrsaliyeleri", path: "/fabrics/fabrics-slips" },
      { name: "Kumaş Faturaları", path: "/fabrics/invoices" },
    ],
  },
  { name: "Ürünler", path: "/products", icon: "👕" },
];

export default function Sidebar() {
  const router = useRouter();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    customers: router.pathname.startsWith("/customers"),
    fabrics: router.pathname.startsWith("/fabrics"),
  });

  const toggleMenu = (menuName: string) => {
    setOpenMenus(prev => ({
      ...prev,
      [menuName]: !prev[menuName]
    }));
  };

  const linkStyle = (active: boolean) => ({
    padding: "10px 15px",
    backgroundColor: active ? "#16213e" : "transparent",
    borderRadius: "5px",
    color: "white",
    textDecoration: "none",
    fontWeight: active ? "bold" : "normal",
    display: "flex",
    alignItems: "center",
    marginBottom: "5px",
    transition: "all 0.3s ease",
  });

  const isActive = (path: string) => {
    return router.asPath === path || 
           (path.includes('customers') && router.pathname === '/customers');
  };

  return (
    <aside
      style={{
        width: "250px",
        backgroundColor: "#0f3460",
        color: "white",
        padding: "20px",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        position: "sticky",
        top: 0,
      }}
    >
      <h2 style={{ textAlign: "center", marginBottom: "30px" }}>📦 MIRA STOK</h2>

      {menuItems.map((item) => {
        if (item.children) {
          const menuKey = item.name.toLowerCase();
          const isOpen = openMenus[menuKey];
          
          return (
            <div key={item.name}>
              <button
                onClick={() => toggleMenu(menuKey)}
                style={linkStyle(isActive(item.path ?? "") || isOpen)}
                className="w-full text-left"
              >
                <span style={{ marginRight: "10px" }}>{item.icon}</span>
                {item.name} {isOpen ? "▾" : "▸"}
              </button>
              {isOpen && (
                <div style={{ marginLeft: "20px", marginTop: "5px" }}>
                  {item.children.map((child) => (
                    <Link
                      key={child.path}
                      href={child.path}
                      style={linkStyle(isActive(child.path))}
                    >
                      <span style={{ marginRight: "8px" }}>•</span>
                      {child.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        }

        return (
          <Link
            key={item.path}
            href={item.path}
            style={linkStyle(isActive(item.path))}
          >
            <span style={{ marginRight: "10px" }}>{item.icon}</span>
            {item.name}
          </Link>
        );
      })}
    </aside>
  );
}