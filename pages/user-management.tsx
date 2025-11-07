// pages/user-management.tsx
import { useState, useEffect } from "react";
import axios from "axios";

type User = {
  id: number;
  username: string;
  email: string;
  role: "admin" | "user";
  createdAt: string;
  stockAccess: boolean;
  fasonAccess: boolean;
};

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    email: "",
    role: "user" as "user" | "admin",
    stockAccess: false,
    fasonAccess: false,
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/users");
      setUsers(res.data);
    } catch (err) {
      setMessage("Kullanıcılar yüklenirken hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    try {
      const payload = {
        ...formData,
        // Düzenleme modunda ve şifre boşsa şifreyi gönderme
        ...(editingUser && !formData.password && { password: undefined })
      };

      if (editingUser) {
        await axios.put(`/api/users/${editingUser.id}`, payload);
        setMessage("Kullanıcı başarıyla güncellendi.");
      } else {
        await axios.post("/api/users", payload);
        setMessage("Kullanıcı başarıyla eklendi.");
      }
      setFormData({ 
        username: "", 
        password: "", 
        email: "", 
        role: "user",
        stockAccess: false,
        fasonAccess: false
      });
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      setMessage("Hata: " + (err.response?.data?.error || err.message));
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: "",
      email: user.email,
      role: user.role,
      stockAccess: user.stockAccess,
      fasonAccess: user.fasonAccess,
    });
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Bu kullanıcıyı silmek istediğinizden emin misiniz?")) return;
    try {
      await axios.delete(`/api/users/${id}`);
      setMessage("Kullanıcı başarıyla silindi.");
      fetchUsers();
    } catch (err: any) {
      setMessage("Silme hatası: " + (err.response?.data?.error || err.message));
    }
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setFormData({ 
      username: "", 
      password: "", 
      email: "", 
      role: "user",
      stockAccess: false,
      fasonAccess: false
    });
  };

  return (
    <main className="p-6 bg-gray-100 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-[#0f3460] mb-6">👤 Kullanıcı Yönetimi</h1>

        {message && (
          <div
            className={`p-3 rounded mb-5 ${
              message.includes("başarı") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}
          >
            {message}
          </div>
        )}

        {/* Form */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-semibold text-[#16213e] mb-4">
            {editingUser ? "Kullanıcıyı Düzenle" : "Yeni Kullanıcı Ekle"}
          </h2>
          <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSubmit}>
            <input
              type="text"
              name="username"
              placeholder="Kullanıcı Adı"
              value={formData.username}
              onChange={handleInputChange}
              required
              className="p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none w-full"
            />
            <input
              type="email"
              name="email"
              placeholder="E-posta"
              value={formData.email}
              onChange={handleInputChange}
              required
              className="p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none w-full"
            />
            <input
              type="password"
              name="password"
              placeholder={editingUser ? "Yeni Şifre (boş bırakabilirsiniz)" : "Şifre"}
              value={formData.password}
              onChange={handleInputChange}
              required={!editingUser}
              minLength={6}
              className="p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none w-full"
            />
            <select
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              className="p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none w-full"
            >
              <option value="user">Kullanıcı</option>
              <option value="admin">Yönetici</option>
            </select>

            {/* Yeni Checkbox Alanları */}
            <div className="flex gap-4 md:col-span-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="stockAccess"
                  checked={formData.stockAccess}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span>Stok Erişimi</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="fasonAccess"
                  checked={formData.fasonAccess}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span>Fason Erişimi</span>
              </label>
            </div>

            <div className="flex gap-3 md:col-span-2 mt-2">
              <button
                type="submit"
                className="bg-[#16213e] hover:bg-[#0f3460] text-white py-2 px-6 rounded shadow font-semibold transition"
              >
                {editingUser ? "Güncelle" : "Ekle"}
              </button>
              {editingUser && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="bg-red-600 hover:bg-red-700 text-white py-2 px-6 rounded shadow font-semibold transition"
                >
                  İptal
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Kullanıcı Listesi */}
        <div className="bg-white p-6 rounded-lg shadow-md overflow-x-auto">
          <h2 className="text-xl font-semibold text-[#16213e] mb-4">Kullanıcı Listesi</h2>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-200">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Kullanıcı Adı</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">E-posta</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Rol</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Stok Erişimi</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Fason Erişimi</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Oluşturulma</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-gray-500">
                    Yükleniyor...
                  </td>
                </tr>
              ) : users.length > 0 ? (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-2">{user.username}</td>
                    <td className="px-4 py-2">{user.email}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-1 rounded-full text-sm font-semibold ${
                          user.role === "admin" ? "bg-orange-200 text-orange-800" : "bg-blue-200 text-blue-800"
                        }`}
                      >
                        {user.role === "admin" ? "Yönetici" : "Kullanıcı"}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {user.stockAccess ? "✅" : "❌"}
                    </td>
                    <td className="px-4 py-2">
                      {user.fasonAccess ? "✅" : "❌"}
                    </td>
                    <td className="px-4 py-2">{new Date(user.createdAt).toLocaleDateString("tr-TR")}</td>
                    <td className="px-4 py-2 flex gap-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className="bg-[#0f3460] hover:bg-[#16213e] text-white px-3 py-1 rounded text-sm transition"
                      >
                        Düzenle
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition"
                        disabled={user.role === "admin"}
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-gray-400 italic">
                    Henüz kullanıcı bulunmamaktadır.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}