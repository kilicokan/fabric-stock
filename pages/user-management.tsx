// pages/user-management.tsx
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Send, X } from "lucide-react";

type User = {
  id: number;
  username: string;
  email: string;
  role: "admin" | "user";
  createdAt: string;
  stockAccess: boolean;
  fasonAccess: boolean;
  mobileAccess: boolean;
  name?: string;
};

const normalizeRole = (role?: string | null): "admin" | "user" => {
  const normalizedRole = String(role || "").trim().toLowerCase();
  return normalizedRole === "admin" || normalizedRole === "administrator" || normalizedRole === "adminstrator"
    ? "admin"
    : "user";
};

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const usersFetchVersion = useRef(0);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    email: "",
    role: "user" as "user" | "admin",
    stockAccess: false,
    fasonAccess: false,
    mobileAccess: false,
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [messageModal, setMessageModal] = useState<{ isOpen: boolean; userId: number | null; userName: string }>({
    isOpen: false,
    userId: null,
    userName: ""
  });
  const [messageContent, setMessageContent] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token") || localStorage.getItem("authToken");
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  };

  const fetchUsers = async () => {
    const fetchVersion = ++usersFetchVersion.current;
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      if (!headers) {
        setUsers([]);
        setMessage("Oturum bilgisi bulunamadi. Lutfen tekrar giris yapin.");
        return;
      }

      const res = await axios.get("/api/users", {
        headers: { ...headers, "Cache-Control": "no-cache" },
        params: { _fresh: Date.now() },
      });
      if (fetchVersion !== usersFetchVersion.current) return;
      const rawUsers = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : [];
      const normalizedUsers = rawUsers.map((user: any) => ({
        ...user,
        username: user.username || user.name || "",
        role: normalizeRole(user.role),
        stockAccess: user.stockAccess ?? false,
        fasonAccess: user.fasonAccess ?? false,
        mobileAccess: user.mobileAccess ?? false,
      }));
      setUsers(normalizedUsers);
    } catch (err: any) {
      if (fetchVersion !== usersFetchVersion.current) return;
      const errorMessage =
        err?.response?.data?.error || err?.response?.data?.message || "Kullanicilar yuklenirken hata olustu.";
      setMessage(errorMessage);
    } finally {
      if (fetchVersion === usersFetchVersion.current) setLoading(false);
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
      const headers = getAuthHeaders();
      if (!headers) {
        setMessage("Oturum bilgisi bulunamadi. Lutfen tekrar giris yapin.");
        return;
      }

      const payload = {
        ...formData,
        role: formData.role === "admin" ? "ADMIN" : "OPERATOR",
        ...(editingUser && !formData.password && { password: undefined }),
      };

      if (editingUser) {
        const response = await axios.put<{ user?: User }>(`/api/users/${editingUser.id}`, payload, { headers });
        const savedUser = response.data.user;
        if (savedUser) {
          setUsers((current) => current.map((user) =>
            user.id === editingUser.id
              ? {
                  ...user,
                  ...savedUser,
                  username: savedUser.username || user.username,
                  role: normalizeRole(savedUser.role || user.role),
                }
              : user
          ));
        }
        await fetchUsers();
        setMessage("Kullanici basariyla guncellendi.");
      } else {
        await axios.post("/api/users", payload, { headers });
        setMessage("Kullanici basariyla eklendi.");
        await fetchUsers();
      }

      setFormData({
        username: "",
        password: "",
        email: "",
        role: "user",
        stockAccess: false,
        fasonAccess: false,
        mobileAccess: false,
      });
      setEditingUser(null);
      if (!editingUser) void fetchUsers();
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
      role: normalizeRole(user.role),
      stockAccess: user.stockAccess ?? false,
      fasonAccess: user.fasonAccess ?? false,
      mobileAccess: user.mobileAccess ?? false,
    });
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Bu kullaniciyi silmek istediginizden emin misiniz?")) return;
    try {
      const headers = getAuthHeaders();
      if (!headers) {
        setMessage("Oturum bilgisi bulunamadi. Lutfen tekrar giris yapin.");
        return;
      }

      await axios.delete(`/api/users/${id}`, { headers });
      setMessage("Kullanici basariyla silindi.");
      fetchUsers();
    } catch (err: any) {
      setMessage("Silme hatasi: " + (err.response?.data?.error || err.message));
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
      fasonAccess: false,
      mobileAccess: false
    });
  };

  const handleOpenMessageModal = (userId: number, userName: string) => {
    setMessageModal({ isOpen: true, userId, userName });
    setMessageContent("");
  };

  const handleCloseMessageModal = () => {
    setMessageModal({ isOpen: false, userId: null, userName: "" });
    setMessageContent("");
  };

  const handleSendMessage = async () => {
    if (!messageContent.trim() || !messageModal.userId) return;
    setSendingMessage(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        "/api/messages",
        { recipientId: messageModal.userId, content: messageContent },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage("Mesaj başarıyla gönderildi.");
      handleCloseMessageModal();
    } catch (err: any) {
      setMessage("Mesaj gönderme hatası: " + (err.response?.data?.error || err.message));
    } finally {
      setSendingMessage(false);
    }
  };

  return (
    <main className="p-6 bg-gray-100 min-h-screen">
      <div className="w-full">
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
                <span>Dış Kaynak Üretim Erişimi</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="mobileAccess"
                  checked={formData.mobileAccess}
                  onChange={(event) => {
                    const mobileAccess = event.currentTarget.checked;
                    setFormData((current) => ({ ...current, mobileAccess }));
                  }}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span>Mobil Erişimi</span>
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
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Dış Kaynak Üretim Erişimi</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Mobil Erişimi</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Oluşturulma</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-6 text-gray-500">
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
                    <td className="px-4 py-2">
                      {user.mobileAccess ? "✅" : "❌"}
                    </td>
                    <td className="px-4 py-2">{new Date(user.createdAt).toLocaleDateString("tr-TR")}</td>
                    <td className="px-4 py-2 flex gap-2">
                      <button
                        onClick={() => handleOpenMessageModal(user.id, user.username)}
                        className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-3 py-1 rounded text-sm transition flex items-center gap-1"
                        title="Mesaj gönder"
                      >
                        <Send size={14} />
                        Mesaj
                      </button>
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
                  <td colSpan={8} className="text-center py-6 text-gray-400 italic">
                    Henüz kullanıcı bulunmamaktadır.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Message Modal */}
      {messageModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#16213e]">
                {messageModal.userName}'e Mesaj Gönder
              </h3>
              <button
                onClick={handleCloseMessageModal}
                className="text-gray-500 hover:text-gray-700 transition"
              >
                <X size={20} />
              </button>
            </div>

            <textarea
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              placeholder="Mesajınızı yazın..."
              className="w-full p-3 border border-gray-300 rounded resize-none focus:ring-2 focus:ring-[#8B5CF6] outline-none mb-4"
              rows={4}
            />

            <div className="flex gap-3">
              <button
                onClick={handleSendMessage}
                disabled={!messageContent.trim() || sendingMessage}
                className="flex-1 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 text-white py-2 px-4 rounded font-semibold transition flex items-center justify-center gap-2"
              >
                <Send size={16} />
                {sendingMessage ? "Gönderiliyor..." : "Gönder"}
              </button>
              <button
                onClick={handleCloseMessageModal}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded font-semibold transition"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
