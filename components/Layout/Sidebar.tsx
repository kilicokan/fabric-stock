import Link from "next/link";
import { useRouter } from "next/router";

export default function Sidebar() {
  const router = useRouter();

  const menuItems = [
    { name: "Kumaş Girişi", path: "/fabric-entry" },
    { name: "Kumaş Çıkışı", path: "/fabric-exit" },
    { name: "Raporlar", path: "/reports" },
    { name: "Kullanıcı Yönetimi", path: "/users" },
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white w-64">
      {/* Logo / Başlık */}
      <div className="h-16 flex items-center justify-center text-xl font-bold border-b border-gray-700">
        MİRA STOCK
      </div>

      {/* Menü Listesi */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {menuItems.map((item) => (
          <Link key={item.path} href={item.path}>
            <div
              className={`cursor-pointer px-4 py-2 rounded-lg transition ${
                router.pathname === item.path
                  ? "bg-blue-600"
                  : "hover:bg-gray-700"
              }`}
            >
              {item.name}
            </div>
          </Link>
        ))}
      </nav>

      {/* Alt Kısım */}
      <div className="p-4 border-t border-gray-700 text-sm text-gray-400">
        © 2025 Mira Production
      </div>
    </div>
  );
}
