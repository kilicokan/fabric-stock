// components/layout/Sidebar.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";

const menuItems = [
  { name: "Kumaş Girişi", path: "/fabric-entry",  },
  { name: "Kumaş Çıkışı", path: "/fabric-exit",  },
  {
    name: "Raporlar",
    path: "/reports",
    children: [
      { name: "Hareket Raporları", path: "/reports" },
      { name: "Mevcut Stok", path: "/reports/stock" },
    ],
  },
  {
    name: "Kullanıcı Yönetimi",
    children: [
      { name: "Kullanıcı Listesi", path: "/user-management" },
      { name: "Yeni Kullanıcı Ekle", path: "/user-management?tab=add" },
    ],
  },
  {
    name: "Müşteriler",
    children: [
      { name: "Müşteri Ekle", path: "/customers" },
      { name: "Müşteri Listesi", path: "/customers/list" },
    ],
  },
  {
    name: "Tedarikçiler",
    children: [
      { name: "Tedarikçi Ekle", path: "/suppliers" },
      { name: "Tedarikçi Düzenle", path: "/suppliers/edit" },
    ],
  },
  {
    name: "Kumaşlar",
    children: [
      { name: "Kumaş Listesi", path: "/fabrics" },
      { name: "Kumaş Ekle", path: "/fabrics/add" },
      { name: "Kumaş Tedarik", path: "/fabrics/supply" },
      { name: "Kumaş Planlama", path: "/fabrics/planning" },
      { name: "Kumaş Siparişleri", path: "/fabrics/orders" },
      { name: "Kumaş İrsaliyeleri", path: "/fabrics/invoices-slips?type=irsaliyeler" },
      { name: "Kumaş Faturaları", path: "/fabrics/invoices-slips?type=faturalar" },
    ],
  },
  { name: "Ürünler", path: "/products",  },
  {
    name: "Fason",
    children: [
      { name: "Fason Gösterge Paneli", path: "/fason/dashboard" },
      { name: "Mobil Fason Takipçi", path: "/fason/mobile-tracker" },
      { name: "Fason Atölye Yönetimi", path: "/fason/workshops" },
      { name: "İş Emri Oluştur", path: "/fason/create-work-order" },
      { name: "Fason İş Emri Yönetimi", path: "/fason/trackers" },
      { name: "Fason Raporları", path: "/fason/reports" },
    ],
  },
  {
    name: "Ayarlar",
    children: [
      { name: "Renk Kartları", path: "/settings/color-cards" },
      { name: "Kesim Masaları", path: "/settings/cutting-tables" },
      { name: "Malzeme Türü Yönetimi", path: "/settings/material-types" },
      { name: "Grup Kartları Yönetimi", path: "/settings/group-cards" },
      { name: "Vergi Oranları Yönetimi", path: "/settings/tax-rates" },
      { name: "Tartı Entegrasyonu", path: "/settings/scale-integration" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    setOpenMenus({
      customers: pathname.startsWith("/customers"),
      fabrics: pathname.startsWith("/fabrics"),
      users: pathname.startsWith("/user-management"),
      raporlar: pathname.startsWith("/reports"),
      ayarlar: pathname.startsWith("/settings"),
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
    backgroundColor: active ? "#e3f2fd" : "transparent",
    borderRadius: "5px",
    color: "#333333",
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
        width: isCollapsed ? "60px" : "250px",
        backgroundColor: "#ffffff",
        color: "#333333",
        padding: isCollapsed ? "20px 10px" : "20px",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        position: "sticky",
        top: 0,
        overflowY: "auto",
        transition: "all 0.3s ease",
        borderRight: "1px solid #e0e0e0",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        {!isCollapsed && (
          <Link href="/" style={{ textDecoration: "none", color: "#333333" }}>
            <img
              src="/miraapp-logo.jpg"
              alt="MiraApp Logo"
              style={{
                display: "block",
                maxWidth: "210px",
                height: "auto",
                cursor: "pointer"
              }}
            />
          </Link>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            backgroundColor: "transparent",
            border: "none",
            color: "#333333",
            fontSize: "20px",
            cursor: "pointer",
            padding: "5px",
            borderRadius: "3px",
            transition: "background-color 0.2s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0f0f0")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          {isCollapsed ? "▶" : "◀"}
        </button>
      </div>

      {user?.stockAccess && menuItems.map((item) => {
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
                {isCollapsed ? "" : item.name} {isCollapsed ? "" : (isOpen ? "▾" : "▸")}
              </button>
              {isOpen && !isCollapsed && (
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
            {isCollapsed ? "" : item.name}
          </Link>
        );
      })}
    </aside>
  );
}
