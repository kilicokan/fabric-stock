// pages/customers/index.tsx
import { useState, useEffect } from "react";
import axios from "axios";
import { useRouter } from "next/router";

export default function CustomersPage() {
  const router = useRouter();
  const { tab } = router.query; // URL'den tab parametresini al
  const [activeTab, setActiveTab] = useState<"add" | "list">(tab === "list" ? "list" : "add");
  const [form, setForm] = useState({ 
    name: "", 
    contact: "", 
    address: "",
    taxOffice: "",
    taxNumber: "",
    email: "",
    phone: "" 
  });
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState({ submit: false, list: false });
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  const loadCustomers = async () => {
    try {
      setLoading((s) => ({ ...s, list: true }));
      const { data } = await axios.get("/api/customers");
      setList(data);
    } catch (e) {
      setError("Müşteri listesi yüklenemedi");
    } finally {
      setLoading((s) => ({ ...s, list: false }));
    }
  };

  useEffect(() => {
    if (activeTab === "list") {
      loadCustomers();
    }
  }, [activeTab]);

  useEffect(() => {
    // URL'deki tab parametresine göre aktif sekme ayarla
    if (router.isReady && router.query.tab) {
      setActiveTab(router.query.tab === "list" ? "list" : "add");
    }
  }, [router.isReady, router.query.tab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError("");
      setSuccess("");
      setLoading((s) => ({ ...s, submit: true }));
      await axios.post("/api/customers", form);
      setForm({ 
        name: "", 
        contact: "", 
        address: "",
        taxOffice: "",
        taxNumber: "",
        email: "",
        phone: "" 
      });
      setSuccess("Müşteri başarıyla eklendi!");
      // 2 saniye sonra success mesajını temizle
      setTimeout(() => setSuccess(""), 2000);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Kayıt başarısız");
    } finally {
      setLoading((s) => ({ ...s, submit: false }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleTabChange = (tab: "add" | "list") => {
    setActiveTab(tab);
    // URL'yi güncelle ama sayfayı yeniden yükleme
    router.push(`/customers?tab=${tab}`, undefined, { shallow: true });
  };

  const filteredCustomers = list.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.contact?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* Başlık ve Sekmeler */}
        <div className="border-b">
          <h1 className="text-2xl font-bold p-4 bg-gray-50">Müşteri Yönetimi</h1>
          <div className="flex">
            <button
              className={`py-3 px-6 font-medium ${activeTab === "add" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"}`}
              onClick={() => handleTabChange("add")}
            >
              Müşteri Ekle
            </button>
            <button
              className={`py-3 px-6 font-medium ${activeTab === "list" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"}`}
              onClick={() => handleTabChange("list")}
            >
              Müşteri Kartları
            </button>
          </div>
        </div>

        {/* İçerik Alanı */}
        <div className="p-6">
          {error && (
            <div className="mb-4 rounded bg-red-100 text-red-700 p-3">
              {error}
            </div>
          )}
          
          {success && (
            <div className="mb-4 rounded bg-green-100 text-green-700 p-3">
              {success}
            </div>
          )}

          {activeTab === "add" ? (
            <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Müşteri Adı *
                  </label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Müşteri adı"
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Yetkili Kişi
                  </label>
                  <input
                    name="contact"
                    value={form.contact}
                    onChange={handleChange}
                    placeholder="Yetkili kişi adı"
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefon
                  </label>
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="Telefon numarası"
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    E-posta
                  </label>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="E-posta adresi"
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vergi Dairesi
                  </label>
                  <input
                    name="taxOffice"
                    value={form.taxOffice}
                    onChange={handleChange}
                    placeholder="Vergi dairesi"
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vergi Numarası
                  </label>
                  <input
                    name="taxNumber"
                    value={form.taxNumber}
                    onChange={handleChange}
                    placeholder="Vergi numarası"
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adres
                </label>
                <textarea
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Adres"
                  rows={3}
                  className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <button
                disabled={loading.submit}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium disabled:opacity-50"
              >
                {loading.submit ? "Kaydediliyor..." : "Müşteri Ekle"}
              </button>
            </form>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Müşteri Listesi</h2>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Müşteri ara..."
                    className="border border-gray-300 rounded-md p-2 pl-10 w-64"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
                </div>
              </div>
              
              {loading.list ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm ? "Arama kriterlerine uygun müşteri bulunamadı." : "Henüz müşteri kaydı bulunmamaktadır."}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCustomers.map((customer) => (
                    <div key={customer.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <h3 className="font-semibold text-lg">{customer.name}</h3>
                        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                          Müşteri
                        </span>
                      </div>
                      
                      {customer.contact && (
                        <div className="mt-2 text-sm text-gray-600">
                          <span className="font-medium">Yetkili:</span> {customer.contact}
                        </div>
                      )}
                      
                      <div className="mt-3 space-y-1">
                        {customer.phone && (
                          <div className="flex items-center text-sm">
                            <span className="text-gray-400 mr-2">📞</span>
                            <span>{customer.phone}</span>
                          </div>
                        )}
                        
                        {customer.email && (
                          <div className="flex items-center text-sm">
                            <span className="text-gray-400 mr-2">✉️</span>
                            <span>{customer.email}</span>
                          </div>
                        )}
                        
                        {customer.taxNumber && (
                          <div className="flex items-center text-sm">
                            <span className="text-gray-400 mr-2">🏢</span>
                            <span>Vergi No: {customer.taxNumber}</span>
                          </div>
                        )}
                      </div>
                      
                      {customer.address && (
                        <div className="mt-3 text-sm text-gray-500">
                          <div className="font-medium">Adres:</div>
                          <div className="truncate">{customer.address}</div>
                        </div>
                      )}
                      
                      <div className="mt-4 flex justify-end space-x-2">
                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                          Düzenle
                        </button>
                        <button className="text-red-600 hover:text-red-800 text-sm font-medium">
                          Sil
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .container {
          max-width: 1200px;
        }
      `}</style>
    </div>
  );
}