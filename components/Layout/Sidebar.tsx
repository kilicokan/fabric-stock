// components/layout/Sidebar.tsx
import Link from "next/link";
import { useRouter } from "next/router";
import {
  LayoutDashboard,
  PackagePlus,
  Scissors,
  FileText,
  Users,
  UserPlus,
  Archive,
  Shirt,
} from "lucide-react";

const Sidebar = () => {
  const router = useRouter();

  const menuItems = [
    { name: "Kumaş Girişi", href: "/fabric-entry", icon: PackagePlus },
    { name: "Kumaş Çıkışı", href: "/fabric-exit", icon: Scissors },
    { name: "Raporlar", href: "/stock", icon: FileText },
    { name: "Kullanıcı Yönetimi", href: "/users", icon: Users },
    { name: "Müşteri Ekle", href: "/customers/add", icon: UserPlus },
    { name: "Kumaş Ekle", href: "/fabrics/add", icon: Archive },
    { name: "Ürün Ekle", href: "/products/add", icon: Shirt },
  ];

  return (
    <div className="h-screen w-64 bg-gray-900 text-white flex flex-col">
      {/* Logo */}
      <div className="p-4 text-2xl font-bold border-b border-gray-700">
        MIRA OPTA
      </div>

      {/* Menü */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = router.pathname === item.href;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                isActive
                  ? "bg-gray-700 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <Icon size={20} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default Sidebar;
