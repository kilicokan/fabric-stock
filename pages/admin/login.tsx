import { useState } from "react";
import axios from "axios";
import { useRouter } from "next/router";

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = async (e: any) => {
  e.preventDefault();
  try {
    const res = await axios.post("/api/admin/login", { username, password });
    if (res.data.success) {
      localStorage.setItem("token", res.data.token); // ✅ Token saklanıyor
      alert("✅ Giriş başarılı!");
      router.push("/admin/dashboard");
    } else {
      alert("❌ Hatalı kullanıcı adı veya şifre");
    }
  } catch (err) {
    console.error("Login hatası:", err);
    alert("Sunucu hatası");
  }
};

  return (
    <div className="max-w-sm mx-auto mt-20 p-4 border rounded">
      <h1 className="text-xl font-bold mb-4">🔑 Admin Giriş</h1>
      <form onSubmit={handleLogin} className="space-y-3">
        <input
          type="text"
          placeholder="Kullanıcı Adı"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <input
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded">
          Giriş Yap
        </button>
      </form>
    </div>
  );
}

const handleLogin = async (e: any) => {
  e.preventDefault();
  try {
    const res = await axios.post("/api/admin/login", { username, password });
    if (res.data.success) {
      localStorage.setItem("token", res.data.token); // ✅ Token saklanıyor
      alert("✅ Giriş başarılı!");
      router.push("/admin/dashboard");
    } else {
      alert("❌ Hatalı kullanıcı adı veya şifre");
    }
  } catch (err) {
    console.error("Login hatası:", err);
    alert("Sunucu hatası");
  }
};
