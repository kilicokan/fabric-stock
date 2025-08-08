import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect } from "react";

export default function Dashboard() {
  const router = useRouter();

  // Eğer token yoksa login sayfasına yönlendir
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/admin/login");
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/admin/login");
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-6">
      <h1 className="text-2xl font-bold mb-6">📊 Admin Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-3xl">
        <Link href="/fabric-entry">
          <div className="p-4 bg-white shadow rounded-lg text-center hover:bg-blue-50 cursor-pointer">
            🏭 <p className="font-medium mt-2">Kumaş Girişi</p>
          </div>
        </Link>

        <Link href="/fabric-exit">
          <div className="p-4 bg-white shadow rounded-lg text-center hover:bg-blue-50 cursor-pointer">
            🧵 <p className="font-medium mt-2">Kumaş Çıkışı</p>
          </div>
        </Link>

        <Link href="/reports/stock">
          <div className="p-4 bg-white shadow rounded-lg text-center hover:bg-green-50 cursor-pointer">
            📈 <p className="font-medium mt-2">Stok Raporları</p>
          </div>
        </Link>

        <Link href="/reports/usage">
          <div className="p-4 bg-white shadow rounded-lg text-center hover:bg-yellow-50 cursor-pointer">
            📉 <p className="font-medium mt-2">Tüketim Raporları</p>
          </div>
        </Link>

        <Link href="/admin/users">
          <div className="p-4 bg-white shadow rounded-lg text-center hover:bg-purple-50 cursor-pointer">
            👥 <p className="font-medium mt-2">Kullanıcı Yönetimi</p>
          </div>
        </Link>
      </div>

      <button
        onClick={handleLogout}
        className="mt-6 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
      >
        🚪 Çıkış Yap
      </button>
    </div>
  );
}
