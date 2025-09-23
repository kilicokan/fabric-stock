import { useState, useEffect } from "react";
import axios from "axios";
import ProductAdd from "./ProductAdd"; // Güncellenmiş ProductAdd bileşeni

interface Product {
  id: string;
  code: string; // ProductAdd.tsx'deki modelNo ile eşleşiyor
  name: string;
  materialType: string;
  groupNo: string;
  taxRate: string;
  image?: string;
}

// Ana Ürünler Bileşeni
export default function ProductsPage() {
  const [activeTab, setActiveTab] = useState<"list" | "add">("list");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Ürün eklendiğinde listeyi yenile
  const handleProductAdded = () => {
    setRefreshTrigger((prev) => prev + 1);
    setActiveTab("list"); // Ekleme sonrası listeye dön
  };

  useEffect(() => {
    // Ürün eklendiğinde event listener
    const handleProductAddedEvent = () => {
      setRefreshTrigger((prev) => prev + 1);
    };
    window.addEventListener("productAdded", handleProductAddedEvent);
    return () => window.removeEventListener("productAdded", handleProductAddedEvent);
  }, []);

  return (
    <div style={styles.container}>
      <h2 style={styles.mainTitle}>Ürün Yönetimi</h2>

      {/* Sekmeler */}
      <div style={styles.tabContainer}>
        <button
          style={activeTab === "list" ? { ...styles.tabButton, ...styles.activeTab } : styles.tabButton}
          onClick={() => setActiveTab("list")}
        >
          Ürünler
        </button>
        <button
          style={activeTab === "add" ? { ...styles.tabButton, ...styles.activeTab } : styles.tabButton}
          onClick={() => setActiveTab("add")}
        >
          Ürün Ekle
        </button>
      </div>

      {/* İçerik Alanı */}
      <div style={styles.content}>
        {activeTab === "list" ? <ProductList refreshTrigger={refreshTrigger} /> : <ProductAdd onProductAdded={handleProductAdded} />}
      </div>
    </div>
  );
}

// Ürün Listesi Bileşeni
function ProductList({ refreshTrigger }: { refreshTrigger: number }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Ürünleri API'den çek
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await axios.get<Product[]>("/api/products");
        console.log("ProductList API Response:", response.data);
        if (response.data.length === 0) {
          setError("Sistemde ürün bulunamadı.");
        } else {
          setProducts(response.data);
        }
      } catch (err: any) {
        const errorMessage = err.response?.data?.message || "Ürünler yüklenemedi";
        setError(errorMessage);
        console.error("Fetch Products Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [refreshTrigger]);

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
  };

  const handleUpdate = async (updatedProduct: Product) => {
    try {
      setLoading(true);
      await axios.put(`/api/products/${updatedProduct.id}`, updatedProduct);
      setProducts(products.map((p) => (p.id === updatedProduct.id ? updatedProduct : p)));
      setEditingProduct(null);
      alert("Ürün başarıyla güncellendi!");
    } catch (err: any) {
      console.error("Update error:", err);
      alert(err.response?.data?.message || "Ürün güncellenirken hata oluştu!");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Bu ürünü silmek istediğinize emin misiniz?")) {
      try {
        setLoading(true);
        await axios.delete(`/api/products/${id}`);
        setProducts(products.filter((p) => p.id !== id));
        alert("Ürün başarıyla silindi!");
      } catch (err: any) {
        console.error("Delete error:", err);
        alert(err.response?.data?.message || "Ürün silinirken hata oluştu!");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div>
      {editingProduct ? (
        <ProductEdit product={editingProduct} onSave={handleUpdate} onCancel={() => setEditingProduct(null)} />
      ) : (
        <>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Ürün Kodu</th>
                  <th style={styles.th}>Ürün Adı</th>
                  <th style={styles.th}>Malzeme Türü</th>
                  <th style={styles.th}>Grup No</th>
                  <th style={styles.th}>KDV Oranı</th>
                  <th style={styles.th}>Görsel</th>
                  <th style={styles.th}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {products.length > 0 ? (
                  products.map((product) => (
                    <tr key={product.id}>
                      <td style={styles.td}>{product.code}</td>
                      <td style={styles.td}>{product.name}</td>
                      <td style={styles.td}>{product.materialType}</td>
                      <td style={styles.td}>{product.groupNo}</td>
                      <td style={styles.td}>{product.taxRate}</td>
                      <td style={styles.td}>
                        {product.image ? (
                          <img src={product.image} alt={product.name} style={{ width: "50px", height: "50px", objectFit: "cover" }} />
                        ) : (
                          "-"
                        )}
                      </td>
                      <td style={styles.td}>
                        <button style={{ ...styles.smallButton, marginRight: "0.5rem" }} onClick={() => handleEdit(product)}>
                          Düzenle
                        </button>
                        <button style={{ ...styles.smallButton, backgroundColor: "#dc3545" }} onClick={() => handleDelete(product.id)}>
                          Sil
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ ...styles.td, textAlign: "center" }}>
                      {loading ? "Yükleniyor..." : "Henüz hiç ürün eklenmemiş."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: "1rem", textAlign: "center", color: "#6c757d" }}>
            Toplam {products.length} ürün listeleniyor.
          </div>
        </>
      )}
    </div>
  );
}

// Ürün Düzenleme Bileşeni
function ProductEdit({ product, onSave, onCancel }: { product: Product; onSave: (product: Product) => void; onCancel: () => void }) {
  const [form, setForm] = useState<Product>({ ...product });
  const [imagePreview, setImagePreview] = useState<string>(product.image || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setForm((prev) => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div style={styles.editModal}>
      <div style={styles.editContent}>
        <h3 style={{ marginTop: 0 }}>Ürünü Düzenle</h3>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Ürün Kodu</label>
            <input type="text" name="code" value={form.code} onChange={handleChange} style={styles.input} required />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Ürün Adı</label>
            <input type="text" name="name" value={form.name} onChange={handleChange} style={styles.input} required />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Ürün Görseli</label>
            <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
              <div
                style={{
                  width: "100px",
                  height: "100px",
                  border: "1px dashed #ddd",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="Ürün önizleme" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ color: "#6c757d", fontSize: "0.8rem", textAlign: "center" }}>Görsel yok</span>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <input type="file" accept="image/*" onChange={handleImageChange} style={{ width: "100%", padding: "0.5rem" }} />
              </div>
            </div>
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Malzeme Türü</label>
            <select name="materialType" value={form.materialType} onChange={handleChange} style={styles.select} required>
              <option value="">Seçiniz</option>
              <option value="Dokuma Kumaş">Dokuma Kumaş</option>
              <option value="Örme Kumaş">Örme Kumaş</option>
              <option value="Dokunmamış Kumaş">Dokunmamış Kumaş</option>
            </select>
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Grup No</label>
            <select name="groupNo" value={form.groupNo} onChange={handleChange} style={styles.select} required>
              <option value="">Seçiniz</option>
              <option value="GRP-001">GRP-001 (Dokuma Kumaş Grubu)</option>
              <option value="GRP-002">GRP-002 (Örme Kumaş Grubu)</option>
              <option value="GRP-003">GRP-003 (Aksesuar Grubu)</option>
            </select>
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>KDV Vergi Oranı</label>
            <select name="taxRate" value={form.taxRate} onChange={handleChange} style={styles.select} required>
              <option value="">Seçiniz</option>
              <option value="%1">%1</option>
              <option value="%8">%8</option>
              <option value="%18">%18</option>
            </select>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.5rem" }}>
            <button type="button" style={{ ...styles.scaleButton, backgroundColor: "#6c757d" }} onClick={onCancel}>
              İptal
            </button>
            <button type="submit" style={styles.submitButton}>
              Güncelle
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Stiller
const styles = {
  container: {
    maxWidth: "900px",
    margin: "2rem auto",
    padding: "1.5rem",
    backgroundColor: "#fff",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  mainTitle: {
    textAlign: "center",
    color: "#2c3e50",
    marginBottom: "1.5rem",
    fontSize: "1.8rem",
  },
  tabContainer: {
    display: "flex",
    borderBottom: "2px solid #dee2e6",
    marginBottom: "1.5rem",
  },
  tabButton: {
    padding: "0.75rem 1.5rem",
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "1rem",
    fontWeight: "500",
    color: "#6c757d",
    transition: "all 0.3s",
  },
  activeTab: {
    color: "#007bff",
    borderBottom: "3px solid #007bff",
    marginBottom: "-2px",
  },
  content: {
    padding: "0 0.5rem",
  },
  tableContainer: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    padding: "0.75rem",
    borderBottom: "2px solid #dee2e6",
    textAlign: "left",
    fontWeight: "600",
    color: "#2c3e50",
    backgroundColor: "#f8f9fa",
  },
  td: {
    padding: "0.75rem",
    borderBottom: "1px solid #dee2e6",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1.2rem",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  label: {
    fontWeight: "600",
    color: "#2c3e50",
    fontSize: "0.9rem",
  },
  selectWithButton: {
    display: "flex",
    gap: "0.5rem",
  },
  inputWithButton: {
    display: "flex",
    gap: "0.5rem",
  },
  select: {
    flex: 1,
    padding: "0.75rem",
    border: "1px solid #ddd",
    borderRadius: "6px",
    fontSize: "1rem",
    backgroundColor: "white",
    outline: "none",
    transition: "border-color 0.3s",
  },
  input: {
    padding: "0.75rem",
    border: "1px solid #ddd",
    borderRadius: "6px",
    fontSize: "1rem",
    outline: "none",
    transition: "border-color 0.3s",
  },
  textInput: {
    padding: "0.75rem",
    border: "1px solid #ddd",
    borderRadius: "6px",
    fontSize: "1rem",
    outline: "none",
    transition: "border-color 0.3s",
    flex: 1,
  },
  addButton: {
    padding: "0.5rem 0.8rem",
    backgroundColor: "#6c757d",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "1.2rem",
    transition: "background-color 0.3s",
    width: "40px",
  },
  scaleButton: {
    padding: "0.75rem 1rem",
    backgroundColor: "#17a2b8",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "background-color 0.3s",
  },
  smallButton: {
    padding: "0.5rem 0.8rem",
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.9rem",
  },
  submitButton: {
    padding: "0.9rem 1.5rem",
    backgroundColor: "#28a745",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "1.1rem",
    fontWeight: "600",
    transition: "background-color 0.3s",
  },
  editModal: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  editContent: {
    backgroundColor: "white",
    padding: "2rem",
    borderRadius: "8px",
    width: "90%",
    maxWidth: "500px",
    maxHeight: "90vh",
    overflowY: "auto",
  },
  error: {
    backgroundColor: "#f8d7da",
    color: "#721c24",
    padding: "0.75rem",
    borderRadius: "6px",
    marginBottom: "1.5rem",
    border: "1px solid #f5c6cb",
    textAlign: "center" as const,
  },
};