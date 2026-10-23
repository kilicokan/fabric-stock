import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect } from "react";

export default function Dashboard() {
  const router = useRouter();

  // E?er token yoksa login sayfas?na y�nlendir
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
      <h1 className="text-2xl font-bold mb-6">?? Admin Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-3xl">
        <Link href="/fabric-entry">
          <div className="p-4 bg-white shadow rounded-lg text-center hover:bg-blue-50 cursor-pointer">
            ?? <p className="font-medium mt-2">Kuma? Giri?i</p>
          </div>
        </Link>

        <Link href="/fabric-exit">
          <div className="p-4 bg-white shadow rounded-lg text-center hover:bg-blue-50 cursor-pointer">
            ?? <p className="font-medium mt-2">Kuma? �?k???</p>
          </div>
        </Link>

        <Link href="/reports/stock">
          <div className="p-4 bg-white shadow rounded-lg text-center hover:bg-green-50 cursor-pointer">
            ?? <p className="font-medium mt-2">Stok Raporlar?</p>
          </div>
        </Link>

        <Link href="/reports">
          <div className="p-4 bg-white shadow rounded-lg text-center hover:bg-yellow-50 cursor-pointer">
            ?? <p className="font-medium mt-2">Kuma? Hareket Raporu</p>
          </div>
        </Link>

        <Link href="/admin/users">
          <div className="p-4 bg-white shadow rounded-lg text-center hover:bg-purple-50 cursor-pointer">
            ?? <p className="font-medium mt-2">Kullan?c? Y�netimi</p>
          </div>
        </Link>

        <Link href="/products">
          <div className="p-4 bg-white shadow rounded-lg text-center hover:bg-pink-50 cursor-pointer">
            ?? <p className="font-medium mt-2">�r�nler</p>
          </div>
        </Link>

        <Link href="/customer-orders">
          <div className="p-4 bg-white shadow rounded-lg text-center hover:bg-indigo-50 cursor-pointer">
            ?? <p className="font-medium mt-2">Sipari?ler</p>
          </div>
        </Link>

        <Link href="/license">
          <div className="p-4 bg-white shadow rounded-lg text-center hover:bg-orange-50 cursor-pointer">
            ?? <p className="font-medium mt-2">Lisans</p>
          </div>
        </Link>
      </div>

      <div className="mt-10">
        <button
          onClick={handleLogout}
          className="px-6 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          �?k?? Yap
        </button>
      </div>
    </div>
  );
}
