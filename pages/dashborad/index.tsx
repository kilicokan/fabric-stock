// pages/dashboard/index.tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

interface User {
  id: number;
  email: string;
  role: "ADMIN" | "OPERATOR";
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");

    if (!token || !userData) {
      router.push("/login");
      return;
    }

    try {
      setUser(JSON.parse(userData));
    } catch {
      router.push("/login");
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  if (!user) {
    return <p className="text-center mt-10">Yükleniyor...</p>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">📊 Dashboard</h1>
        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
        >
          Çıkış
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-md">
        <h2 className="text-xl font-semibold mb-4">
          Hoşgeldin, {user.email} 👋
        </h2>
        <p className="mb-6">
          Rolün:{" "}
          <span className="font-bold text-blue-600">{user.role}</span>
        </p>

        {user.role === "ADMIN" ? (
          <div className="space-y-3">
            <button className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
              Kullanıcı Yönetimi
            </button>
            <button className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700">
              Kumaş Girişleri
            </button>
            <button className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700">
              Raporlar
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700">
              Kumaş Çıkışı Yap
            </button>
            <button className="w-full bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700">
              Stok Görüntüle
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
