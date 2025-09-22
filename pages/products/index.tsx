import { useState } from "react";

// Ana Ürünler Bileşeni
export default function ProductsPage() {
  const [activeTab, setActiveTab] = useState("list"); // "list" veya "add"

  return (
    <div style={styles.container}>
      <h2 style={styles.mainTitle}>Ürün Yönetimi</h2>
      
      {/* Sekmeler */}
      <div style={styles.tabContainer}>
        <button 
          style={activeTab === "list" ? {...styles.tabButton, ...styles.activeTab} : styles.tabButton}
          onClick={() => setActiveTab("list")}
        >
          Ürünler
        </button>
        <button 
          style={activeTab === "add" ? {...styles.tabButton, ...styles.activeTab} : styles.tabButton}
          onClick={() => setActiveTab("add")}
        >
          Ürün Ekle
        </button>
      </div>
      
      {/* İçerik Alanı */}
      <div style={styles.content}>
        {activeTab === "list" ? <ProductList /> : <ProductAdd />}
      </div>
    </div>
  );
}

// Ürün Listesi Bileşeni
function ProductList() {
  const [products, setProducts] = useState([
    {
      id: 1,
      code: "PRD-1001",
      name: "Pamuklu Kumaş",
      materialType: "Dokuma Kumaş",
      groupNo: "GRP-001",
      taxRate: "%18",
      image: ""
    },
    {
      id: 2,
      code: "PRD-1002",
      name: "Polyester Kumaş",
      materialType: "Örme Kumaş",
      groupNo: "GRP-002",
      taxRate: "%8",
      image: ""
    }
  ]);

  const [editingProduct, setEditingProduct] = useState(null);

  const handleEdit = (product) => {
    setEditingProduct(product);
  };

  const handleUpdate = (updatedProduct) => {
    setProducts(products.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    setEditingProduct(null);
    alert("Ürün başarıyla güncellendi!");
  };

  const handleDelete = (id) => {
    if (window.confirm("Bu ürünü silmek istediğinize emin misiniz?")) {
      setProducts(products.filter(p => p.id !== id));
      alert("Ürün başarıyla silindi!");
    }
  };

  return (
    <div>
      {editingProduct ? (
        <ProductEdit 
          product={editingProduct} 
          onSave={handleUpdate} 
          onCancel={() => setEditingProduct(null)} 
        />
      ) : (
        <>
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Ürün Kodu</th>
                  <th style={styles.th}>Ürün Adı</th>
                  <th style={styles.th}>Malzeme Türü</th>
                  <th style={styles.th}>Grup No</th>
                  <th style={styles.th}>KDV Oranı</th>
                  <th style={styles.th}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {products.length > 0 ? (
                  products.map(product => (
                    <tr key={product.id}>
                      <td style={styles.td}>{product.code}</td>
                      <td style={styles.td}>{product.name}</td>
                      <td style={styles.td}>{product.materialType}</td>
                      <td style={styles.td}>{product.groupNo}</td>
                      <td style={styles.td}>{product.taxRate}</td>
                      <td style={styles.td}>
                        <button 
                          style={{...styles.smallButton, marginRight: '0.5rem'}}
                          onClick={() => handleEdit(product)}
                        >
                          Düzenle
                        </button>
                        <button 
                          style={{...styles.smallButton, backgroundColor: '#dc3545'}}
                          onClick={() => handleDelete(product.id)}
                        >
                          Sil
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{...styles.td, textAlign: 'center'}}>
                      Henüz hiç ürün eklenmemiş.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div style={{marginTop: '1rem', textAlign: 'center', color: '#6c757d'}}>
            Toplam {products.length} ürün listeleniyor.
          </div>
        </>
      )}
    </div>
  );
}

// Ürün Düzenleme Bileşeni (Modal benzeri)
function ProductEdit({ product, onSave, onCancel }) {
  const [form, setForm] = useState(product);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div style={styles.editModal}>
      <div style={styles.editContent}>
        <h3 style={{marginTop: 0}}>Ürünü Düzenle</h3>
        
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Ürün Kodu</label>
            <input
              type="text"
              name="code"
              value={form.code}
              onChange={handleChange}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Ürün Adı</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Malzeme Türü</label>
            <select
              name="materialType"
              value={form.materialType}
              onChange={handleChange}
              style={styles.select}
              required
            >
              <option value="Dokuma Kumaş">Dokuma Kumaş</option>
              <option value="Örme Kumaş">Örme Kumaş</option>
              <option value="Dokunmamış Kumaş">Dokunmamış Kumaş</option>
            </select>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Grup No</label>
            <select
              name="groupNo"
              value={form.groupNo}
              onChange={handleChange}
              style={styles.select}
              required
            >
              <option value="GRP-001">GRP-001 (Dokuma Kumaş Grubu)</option>
              <option value="GRP-002">GRP-002 (Örme Kumaş Grubu)</option>
              <option value="GRP-003">GRP-003 (Aksesuar Grubu)</option>
            </select>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>KDV Vergi Oranı</label>
            <select
              name="taxRate"
              value={form.taxRate}
              onChange={handleChange}
              style={styles.select}
              required
            >
              <option value="%1">%1</option>
              <option value="%8">%8</option>
              <option value="%18">%18</option>
            </select>
          </div>

          <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem'}}>
            <button
              type="button"
              style={{...styles.scaleButton, backgroundColor: '#6c757d'}}
              onClick={onCancel}
            >
              İptal
            </button>
            <button
              type="submit"
              style={styles.submitButton}
            >
              Güncelle
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Ürün Ekleme Bileşeni (Önceki ile aynı)
function ProductAdd() {
  const [form, setForm] = useState({ 
    productCode: "",
    productImage: "",
    productName: "", 
    materialType: "", 
    groupNo: "", 
    taxRate: "" 
  });
  
  const [isManualCode, setIsManualCode] = useState(false);
  const [imagePreview, setImagePreview] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    alert("Ürün başarıyla eklendi!");
    setForm({ 
      productCode: "",
      productImage: "",
      productName: "", 
      materialType: "", 
      groupNo: "", 
      taxRate: "" 
    });
    setImagePreview("");
    setIsManualCode(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setForm(prev => ({ ...prev, productImage: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const generateProductCode = () => {
    const randomCode = "PRD-" + Math.floor(1000 + Math.random() * 9000);
    setForm(prev => ({ ...prev, productCode: randomCode }));
  };

  return (
    <div>
      <form onSubmit={handleSubmit} style={styles.form}>
        {/* Ürün Kodu Alanı */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Ürün Kodu</label>
          <div style={styles.inputWithButton}>
            <input
              type="text"
              name="productCode"
              value={form.productCode}
              onChange={handleChange}
              style={styles.textInput}
              placeholder="Ürün kodunu giriniz"
              required
              disabled={!isManualCode}
            />
            {!isManualCode ? (
              <button 
                type="button" 
                style={styles.scaleButton}
                onClick={generateProductCode}
              >
                Kod Oluştur
              </button>
            ) : null}
            <button 
              type="button" 
              style={styles.addButton}
              onClick={() => setIsManualCode(!isManualCode)}
              title={isManualCode ? "Otomatik koda geç" : "Manuel giriş yap"}
            >
              {isManualCode ? "A" : "M"}
            </button>
          </div>
        </div>

        {/* Ürün Görseli Alanı */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Ürün Görseli</label>
          <div style={{display: 'flex', gap: '1rem', alignItems: 'flex-start'}}>
            <div style={{width: '100px', height: '100px', border: '1px dashed #ddd', 
                        borderRadius: '6px', display: 'flex', alignItems: 'center', 
                        justifyContent: 'center', overflow: 'hidden'}}>
              {imagePreview ? (
                <img 
                  src={imagePreview} 
                  alt="Ürün önizleme" 
                  style={{width: '100%', height: '100%', objectFit: 'cover'}}
                />
              ) : (
                <span style={{color: '#6c757d', fontSize: '0.8rem', textAlign: 'center'}}>
                  Görsel yok
                </span>
              )}
            </div>
            <div style={{flex: 1}}>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{width: '100%', padding: '0.5rem'}}
              />
            </div>
          </div>
        </div>

        {/* Ürün Adı Alanı */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Ürün Adı</label>
          <input
            type="text"
            name="productName"
            value={form.productName}
            onChange={handleChange}
            style={styles.input}
            placeholder="Ürün adını giriniz"
            required
          />
        </div>

        {/* Malzeme Türü Alanı */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Malzeme Türü</label>
          <div style={styles.selectWithButton}>
            <select
              name="materialType"
              value={form.materialType}
              onChange={handleChange}
              style={styles.select}
              required
            >
              <option value="">Malzeme türü seçiniz</option>
              <option value="Dokuma Kumaş">Dokuma Kumaş</option>
              <option value="Örme Kumaş">Örme Kumaş</option>
              <option value="Dokunmamış Kumaş">Dokunmamış Kumaş</option>
            </select>
            <button
              type="button"
              style={styles.addButton}
              onClick={() => alert("Malzeme türü yönetim sayfası açılacak")}
              title="Malzeme türü yönet"
            >
              +
            </button>
          </div>
        </div>

        {/* Grup No Alanı */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Grup No</label>
          <div style={styles.selectWithButton}>
            <select
              name="groupNo"
              value={form.groupNo}
              onChange={handleChange}
              style={styles.select}
              required
            >
              <option value="">Grup seçiniz</option>
              <option value="GRP-001">GRP-001 (Dokuma Kumaş Grubu)</option>
              <option value="GRP-002">GRP-002 (Örme Kumaş Grubu)</option>
              <option value="GRP-003">GRP-003 (Aksesuar Grubu)</option>
            </select>
            <button
              type="button"
              style={styles.addButton}
              onClick={() => alert("Grup kartları yönetim sayfası açılacak")}
              title="Grup yönet"
            >
              +
            </button>
          </div>
        </div>

        {/* KDV Oranı Alanı */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>KDV Vergi Oranı</label>
          <div style={styles.selectWithButton}>
            <select
              name="taxRate"
              value={form.taxRate}
              onChange={handleChange}
              style={styles.select}
              required
            >
              <option value="">KDV oranı seçiniz</option>
              <option value="%1">%1</option>
              <option value="%8">%8</option>
              <option value="%18">%18</option>
            </select>
            <button
              type="button"
              style={styles.addButton}
              onClick={() => alert("Vergi oranları yönetim sayfası açılacak")}
              title="Vergi oranı yönet"
            >
              +
            </button>
          </div>
        </div>

        {/* Butonlar */}
        <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem'}}>
          <button
            type="button"
            style={{...styles.scaleButton, backgroundColor: '#6c757d'}}
            onClick={() => {
              setForm({ 
                productCode: "",
                productImage: "",
                productName: "", 
                materialType: "", 
                groupNo: "", 
                taxRate: "" 
              });
              setImagePreview("");
              setIsManualCode(false);
            }}
          >
            Formu Temizle
          </button>
          <button
            type="submit"
            style={styles.submitButton}
          >
            Ürünü Kaydet
          </button>
        </div>
      </form>
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
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
  },
  mainTitle: {
    textAlign: "center",
    color: "#2c3e50",
    marginBottom: "1.5rem",
    fontSize: "1.8rem"
  },
  tabContainer: {
    display: "flex",
    borderBottom: "2px solid #dee2e6",
    marginBottom: "1.5rem"
  },
  tabButton: {
    padding: "0.75rem 1.5rem",
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "1rem",
    fontWeight: "500",
    color: "#6c757d",
    transition: "all 0.3s"
  },
  activeTab: {
    color: "#007bff",
    borderBottom: "3px solid #007bff",
    marginBottom: "-2px"
  },
  content: {
    padding: "0 0.5rem"
  },
  tableContainer: {
    overflowX: "auto"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse"
  },
  th: {
    padding: "0.75rem",
    borderBottom: "2px solid #dee2e6",
    textAlign: "left",
    fontWeight: "600",
    color: "#2c3e50",
    backgroundColor: "#f8f9fa"
  },
  td: {
    padding: "0.75rem",
    borderBottom: "1px solid #dee2e6"
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1.2rem"
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem"
  },
  label: {
    fontWeight: "600",
    color: "#2c3e50",
    fontSize: "0.9rem"
  },
  selectWithButton: {
    display: "flex",
    gap: "0.5rem"
  },
  inputWithButton: {
    display: "flex",
    gap: "0.5rem"
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
    flex: 1
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
    width: "40px"
  },
  scaleButton: {
    padding: "0.75rem 1rem",
    backgroundColor: "#17a2b8",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "background-color 0.3s"
  },
  smallButton: {
    padding: "0.5rem 0.8rem",
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.9rem"
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
    transition: "background-color 0.3s"
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
    zIndex: 1000
  },
  editContent: {
    backgroundColor: "white",
    padding: "2rem",
    borderRadius: "8px",
    width: "90%",
    maxWidth: "500px",
    maxHeight: "90vh",
    overflowY: "auto"
  }
};