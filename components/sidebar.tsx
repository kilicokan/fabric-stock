// components/Sidebar.tsx
import Link from "next/link";
import { useRouter } from "next/router";
import React from "react";

export default function Sidebar() {
  const router = useRouter();

  const items = [
    { name: "Kumaş Girişi", href: "/fabric-entry" },
    { name: "Kumaş Çıkışı", href: "/fabric-exit" },
    { name: "Raporlar", href: "/reports" },
    { name: "Kullanıcı Yönetimi", href: "/users" },
  ];

  return (
    <aside className="w-64 bg-gray-900 text-white flex-shrink-0 min-h-screen">
      <div className="h-16 flex items-center justify-center text-xl font-bold border-b border-gray-800">
        MİRA STOCK
      </div>

      <nav className="px-2 py-6 space-y-1">
        {items.map((it) => {
          const active = router.pathname === it.href;
          return (
            <Link key={it.href} href={it.href}>
              <a
                className={`flex items-center gap-3 px-4 py-2 rounded-md text-sm transition ${
                  active ? "bg-blue-600 text-white" : "text-gray-200 hover:bg-gray-800"
                }`}
              >
                <span className="w-6 text-center text-gray-200">●</span>
                <span>{it.name}</span>
              </a>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto p-4 border-t border-gray-800 text-xs text-gray-400">
        © {new Date().getFullYear()} Mira Production
      </div>
    </aside>
  );
}
