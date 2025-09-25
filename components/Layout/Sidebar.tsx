// components/layout/Sidebar.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const menuItems = [
  { name: "Kumaş Girişi", path: "/fabric-entry", icon: "📥" },
  { name: "Kumaş Çıkışı", path: "/fabric-exit", icon: "📤" },
  {
    name: "Raporlar",
    icon: "📊",
    path: "/reports",
    children: [
      { name: "Hareket Raporları", path: "/reports" },
      { name: "Mevcut Stok", path: "/reports/stock" },
    ],
  },
  {
    name: "Kullanıcı Yönetimi",
    icon: "👤",
    children: [
      { name: "Kullanıcı Listesi", path: "/user-management" },
      { name: "Yeni Kullanıcı Ekle", path: "/user-management?tab=add" },
    ],
  },
  {
    name: "Müşteriler",
    icon: "👔",
    children: [
      { name: "Müşteri Ekle", path: "/customers?tab=add" },
      { name: "Müşteri Kartları", path: "/customers?tab=list" },
    ],
  },
  {
    name: "Kumaşlar",
    icon: "🧵",
    children: [
      { name: "Kumaş Ekle", path: "/fabrics/add" },
      { name: "Kumaş Tedarik", path: "/fabrics/supply" },
      { name: "Kumaş Planlama", path: "/fabrics/planning" },
      { name: "Kumaş Siparişleri", path: "/fabrics/orders" },
      { name: "Kumaş İrsaliyeleri", path: "/fabrics/invoices-slips?type=irsaliyeler" },
      { name: "Kumaş Faturaları", path: "/fabrics/invoices-slips?type=faturalar" },
    ],
  },
  { name: "Ürünler", path: "/products", icon: "👕" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpenMenus({
      customers: pathname.startsWith("/customers"),
      fabrics: pathname.startsWith("/fabrics"),
      users: pathname.startsWith("/user-management"),
      raporlar: pathname.startsWith("/reports"),
    });
  }, [pathname]);

  const toggleMenu = (menuName: string) => {
    setOpenMenus(prev => ({
      ...prev,
      [menuName]: !prev[menuName],
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
    const pathWithoutQuery = path.split('?')[0];
    return pathname === pathWithoutQuery ||
      (pathWithoutQuery.includes('customers') && pathname === '/customers') ||
      (pathWithoutQuery.includes('fabrics/invoices-slips') && pathname === '/fabrics/invoices-slips') ||
      (pathWithoutQuery.includes('user-management') && pathname.startsWith('/user-management')) ||
      (pathWithoutQuery.includes('reports') && pathname.startsWith('/reports'));
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
          const menuKey = item.name.toLowerCase().replace(/\s/g, '');
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
