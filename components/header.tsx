// components/Header.tsx
import React from "react";
import { useRouter } from "next/router";

export default function Header() {
  const router = useRouter();
  // Sayfa başlığını yol bazlı basit çıkarma
  const title = (() => {
    const p = router.pathname.replace("/", "");
    if (!p) return "Dashboard";
    return p.charAt(0).toUpperCase() + p.slice(1).replace("-", " ");
  })();

  return (
    <header className="w-full bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>

        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-sm text-gray-600">Hoşgeldin, <span className="font-medium text-gray-800">Admin</span></div>

          {/* Basit kullanıcı menüsü */}
          <div className="relative">
            <button className="inline-flex items-center gap-2 px-3 py-1 rounded-md border border-gray-200 bg-white text-sm">
              <span>Emir</span>
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.06z" clipRule="evenodd"/></svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
