import { useEffect } from "react";
import { useRouter } from "next/router";
import axios from "axios";

export default function Dashboard() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/admin/login");
    } else {
      axios
        .get("/api/admin/verify", { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => {
          if (!res.data.valid) {
            router.push("/admin/login");
          }
        })
        .catch(() => {
          router.push("/admin/login");
        });
    }
  }, []);

  return (
    <div className="max-w-2xl mx-auto mt-10 p-4">
      <h1 className="text-2xl font-bold">📊 Admin Paneli</h1>
      <p className="mt-4">✅ Hoşgeldiniz, güvenli giriş yaptınız.</p>
    </div>
  );
}
