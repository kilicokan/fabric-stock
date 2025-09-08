// pages/index.tsx

import Link from "next/link";
import { useEffect, useState } from "react";
import axios from "axios";

type StockItem = {
  fabricType: string;
  color: string;
  remainingKg: number;
};

export default function Home() {
  const [stockSummary, setStockSummary] = useState<StockItem[]>([]);

  useEffect(() => {
    async function fetchStock() {
      try {
        const res = await axios.get("/api/fabric-entry/remaining-stock/by-fabric-type");
        setStockSummary(res.data);
      } catch (err) {
        console.error("Stok verisi alınamadı", err);
      }
    }
    fetchStock();
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-gray-800">📦 Fabric Stock Takip Paneli</h1>
          <p className="text-gray-600 mt-2">Stok durumunuzu yönetin, analiz edin, kontrol edin.</p>
        </header>

        {/* Özet Bilgiler */}
        <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-12">
          {stockSummary.map((item, i) => (
            <div key={i} className="bg-white rounded shadow p-4 text-center border hover:shadow-md transition">
              <h2 className="text-lg font-semibold text-gray-700">{item.fabricType}</h2>
              <p className="text-sm text-gray-500">{item.color}</p>
              <p className="text-2xl font-bold text-green-600 mt-2">
                {typeof item.remainingKg === "number" ? item.remainingKg.toFixed(2) : "0.00"} kg
              </p>
            </div>
          ))}
        </section>

        {/* Menü Butonları */}
        <section className="flex flex-col sm:flex-row gap-6 justify-center">
          <Link href="/fabric-entry" className="flex-1">
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded text-lg font-medium shadow">➕ Kumaş Girişi</button>
          </Link>
          <Link href="/fabric-exit" className="flex-1">
            <button className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded text-lg font-medium shadow">➖ Kumaş Çıkışı</button>
          </Link>
          <Link href="/reports/stock" className="flex-1">
            <button className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded text-lg font-medium shadow">📊 Stok Raporu</button>
          </Link>
        </section>
      </div>
    </main>
  );
}
// ...existing code...
