import { useState, useEffect, CSSProperties } from "react";
import axios from "axios";
import ExportButtons from "../../components/ExportButtons";
import * as XLSX from "xlsx";

interface MaterialType {
  id: number;
  name: string;
}

interface Fabric {
  id: number;
  name: string;
}

interface Group {
  id: number;
  name: string;
}

interface TaxRate {
  id: number;
  name: string;
}

interface Product {
  id: number;
  modelNo: string;
  name: string;
  image?: string;
  description?: string;
  materialType?: MaterialType;
  fabric?: Fabric;
  group?: Group;
  taxRate?: TaxRate;
}

interface ProductForm {
  modelNo: string;
  name: string;
  image?: string;
  materialTypeId: string;
  fabricId: string;
  groupId: string;
  taxRateId: string;
}

interface ProductListProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
}

interface ProductAddProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
}

interface ProductEditProps {
  product: Product;
  onSave: (updatedProduct: Product) => void;
  onCancel: () => void;
}

// CSV parsing utility
function parseCSV(csvText: string): any[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const obj: any = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    return obj;
  });

  return rows;
}

// Ana Ürünler Bileşeni
export default function ProductsPage() {
  const [activeTab, setActiveTab] = useState("list"); // "list" veya "add"
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/products');
      setProducts(response.data as Product[]);
    } catch (error) {
      console.error('Ürünler yüklenirken hata:', error);
      alert('Ürünler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

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
        {activeTab === "list" ? 
          <ProductList products={products} setProducts={setProducts} /> : 
          <ProductAdd products={products} setProducts={setProducts} setActiveTab={setActiveTab} />
        }
      </div>
    </div>
  );
}

// Ürün Listesi Bileşeni
function ProductList({ products, setProducts }: ProductListProps) {
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [importing, setImporting] = useState(false);

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
  };

  const handleUpdate = (updatedProduct: Product) => {
    setProducts(products.map((p: Product) => p.id === updatedProduct.id ? updatedProduct : p));
    setEditingProduct(null);
    alert("Ürün başarıyla güncellendi!");
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Bu ürünü silmek istediğinize emin misiniz?")) {
      setProducts(products.filter((p: Product) => p.id !== id));
      alert("Ürün başarıyla silindi!");
    }
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      let parsedData: any[] = [];

      if (fileExtension === 'csv') {
        const text = await file.text();
        parsedData = parseCSV(text);
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        parsedData = XLSX.utils.sheet_to_json(worksheet);
      } else {
        alert('Sadece CSV ve Excel dosyaları desteklenir.');
        return;
      }

      if (parsedData.length === 0) {
        alert('Dosya boş veya geçersiz format.');
        return;
      }

      // Transform data to match API expectations
      const productsToImport = parsedData.map(row => ({
        modelNo: row['Model No'] || row['modelNo'] || row['ModelNo'],
        name: row['Ürün Adı'] || row['name'] || row['Name'],
        materialTypeId: row['Malzeme Türü ID'] || row['materialTypeId'] || row['MaterialTypeId'],
        fabricId: row['Kumaş Türü ID'] || row['fabricId'] || row['FabricId'],
        groupId: row['Grup ID'] || row['groupId'] || row['GroupId'],
        taxRateId: row['KDV Oranı ID'] || row['taxRateId'] || row['TaxRateId'],
        description: row['Açıklama'] || row['description'] || row['Description'],
        image: row['Görsel'] || row['image'] || row['Image']
      }));

      const response = await axios.post('/api/products/import', { products: productsToImport });

      if (response.data.success > 0) {
        alert(response.data.message);
        // Refresh the products list
        window.location.reload();
      } else {
        alert(`İçe aktarma başarısız: ${response.data.importErrors.join(', ')}`);
      }

    } catch (error) {
      console.error('Import error:', error);
      alert('İçe aktarma sırasında hata oluştu.');
    } finally {
      setImporting(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const exportData = products.map(product => ({
    'Model No': product.modelNo,
    'Ürün Adı': product.name,
    'Malzeme Türü': product.materialType?.name || '',
    'Kumaş Türü': product.fabric?.name || '',
    'Grup': product.group?.name || '',
    'KDV Oranı': product.taxRate?.name || '',
    'Açıklama': product.description || '',
    'Görsel': product.image || ''
  }));

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
          {/* Import/Export Buttons */}
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <label style={{...styles.scaleButton, backgroundColor: '#28a745', cursor: 'pointer'}}>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileImport}
                style={{ display: 'none' }}
                disabled={importing}
              />
              {importing ? 'İçe Aktarılıyor...' : 'Ürün İçe Aktar'}
            </label>

            <ExportButtons
              data={exportData}
              filename="urunler"
              disabled={products.length === 0}
            />
          </div>

          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Model No</th>
                  <th style={styles.th}>Ürün Adı</th>
                  <th style={styles.th}>Malzeme Türü</th>
                  <th style={styles.th}>Kumaş Türü</th>
                  <th style={styles.th}>Grup</th>
                  <th style={styles.th}>KDV Oranı</th>
                  <th style={styles.th}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {products.length > 0 ? (
                  products.map(product => (
                    <tr key={product.id}>
                      <td style={styles.td}>{product.modelNo}</td>
                      <td style={styles.td}>{product.name}</td>
                      <td style={styles.td}>{product.materialType?.name}</td>
                      <td style={styles.td}>{product.fabric?.name}</td>
                      <td style={styles.td}>{product.group?.name}</td>
                      <td style={styles.td}>{product.taxRate?.name}</td>
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
                    <td colSpan={7} style={{...styles.td, textAlign: 'center'}}>
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

// Ürün Ekleme Bileşeni - GÜNCELLENMİŞ
function ProductAdd({ products, setProducts, setActiveTab }: ProductAddProps) {
  const [form, setForm] = useState<ProductForm>({
    modelNo: "",
    image: "",
    name: "",
    materialTypeId: "",
    fabricId: "",
    groupId: "",
    taxRateId: ""
  });

  const [isManualCode, setIsManualCode] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    try {
      const [mtRes, ftRes, gRes, trRes] = await Promise.all([
        axios.get('/api/material-types'),
        axios.get('/api/fabrics'),
        axios.get('/api/groups'),
        axios.get('/api/tax-rates')
      ]);
      setMaterialTypes(mtRes.data);
      setFabrics(ftRes.data);
      setGroups(gRes.data);
      setTaxRates(trRes.data);
    } catch (error) {
      console.error('Seçenekler yüklenirken hata:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const response = await axios.post('/api/products', {
        modelNo: form.modelNo,
        name: form.name,
        materialTypeId: form.materialTypeId,
        fabricId: form.fabricId,
        groupId: form.groupId,
        taxRateId: form.taxRateId,
        image: form.image
      });

      alert("Ürün başarıyla eklendi!");
      setProducts([...products, response.data.product]);

      // Formu temizle
      setForm({
        modelNo: "",
        image: "",
        name: "",
        materialTypeId: "",
        fabricId: "",
        groupId: "",
        taxRateId: ""
      });
      setImagePreview("");
      setIsManualCode(false);

      // Listeleme sekmesine geç
      setActiveTab("list");
    } catch (error) {
      console.error('Ürün eklenirken hata:', error);
      alert('Ürün eklenirken hata oluştu');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImagePreview(result);
        setForm(prev => ({ ...prev, image: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const generateProductCode = () => {
    const randomCode = "PRD-" + Math.floor(1000 + Math.random() * 9000);
    setForm(prev => ({ ...prev, modelNo: randomCode }));
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
              name="modelNo"
              value={form.modelNo}
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
            name="name"
            value={form.name}
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
              name="materialTypeId"
              value={form.materialTypeId}
              onChange={handleChange}
              style={styles.select}
              required
            >
              <option value="">Malzeme türü seçiniz</option>
              {materialTypes.map(mt => (
                <option key={mt.id} value={mt.id}>{mt.name}</option>
              ))}
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

        {/* Kumaş Türü Alanı */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Kumaş Türü</label>
          <div style={styles.selectWithButton}>
            <select
              name="fabricId"
              value={form.fabricId}
              onChange={handleChange}
              style={styles.select}
              required
            >
              <option value="">Kumaş türü seçiniz</option>
              {fabrics.map(ft => (
                <option key={ft.id} value={ft.id}>{ft.name}</option>
              ))}
            </select>
            <button
              type="button"
              style={styles.addButton}
              onClick={() => alert("Kumaş türü yönetim sayfası açılacak")}
              title="Kumaş türü yönet"
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
              name="groupId"
              value={form.groupId}
              onChange={handleChange}
              style={styles.select}
              required
            >
              <option value="">Grup seçiniz</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
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
              name="taxRateId"
              value={form.taxRateId}
              onChange={handleChange}
              style={styles.select}
              required
            >
              <option value="">KDV oranı seçiniz</option>
              {taxRates.map(tr => (
                <option key={tr.id} value={tr.id}>{tr.name}</option>
              ))}
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
                modelNo: "",
                image: "",
                name: "",
                materialTypeId: "",
                fabricId: "",
                groupId: "",
                taxRateId: ""
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

// Ürün Düzenleme Bileşeni (Modal benzeri) - GÜNCELLENMİŞ
function ProductEdit({ product, onSave, onCancel }: ProductEditProps) {
  const [form, setForm] = useState<ProductForm>({
    modelNo: product.modelNo,
    name: product.name,
    image: product.image || "",
    materialTypeId: product.materialType?.id?.toString() || "",
    fabricId: product.fabric?.id?.toString() || "",
    groupId: product.group?.id?.toString() || "",
    taxRateId: product.taxRate?.id?.toString() || ""
  });

  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [mtRes, ftRes, gRes, trRes] = await Promise.all([
          axios.get('/api/material-types'),
          axios.get('/api/fabrics'),
          axios.get('/api/groups'),
          axios.get('/api/tax-rates')
        ]);
        setMaterialTypes(mtRes.data);
        setFabrics(ftRes.data);
        setGroups(gRes.data);
        setTaxRates(trRes.data);
      } catch (error) {
        console.error('Seçenekler yüklenirken hata:', error);
      }
    };
    fetchOptions();
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const updatedProduct: Product = {
      ...product,
      modelNo: form.modelNo,
      name: form.name,
      image: form.image,
      materialType: materialTypes.find(mt => mt.id === parseInt(form.materialTypeId)),
      fabric: fabrics.find((ft: Fabric) => ft.id === parseInt(form.fabricId)),
      group: groups.find(g => g.id === parseInt(form.groupId)),
      taxRate: taxRates.find(tr => tr.id === parseInt(form.taxRateId))
    };
    onSave(updatedProduct);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
              name="modelNo"
              value={form.modelNo}
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
              name="materialTypeId"
              value={form.materialTypeId}
              onChange={handleChange}
              style={styles.select}
              required
            >
              <option value="">Malzeme türü seçiniz</option>
              {materialTypes.map(mt => (
                <option key={mt.id} value={mt.id}>{mt.name}</option>
              ))}
            </select>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Kumaş Türü</label>
            <select
              name="fabricId"
              value={form.fabricId}
              onChange={handleChange}
              style={styles.select}
              required
            >
              <option value="">Kumaş türü seçiniz</option>
              {fabrics.map(ft => (
                <option key={ft.id} value={ft.id}>{ft.name}</option>
              ))}
            </select>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Grup No</label>
            <select
              name="groupId"
              value={form.groupId}
              onChange={handleChange}
              style={styles.select}
              required
            >
              <option value="">Grup seçiniz</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>KDV Vergi Oranı</label>
            <select
              name="taxRateId"
              value={form.taxRateId}
              onChange={handleChange}
              style={styles.select}
              required
            >
              <option value="">KDV oranı seçiniz</option>
              {taxRates.map(tr => (
                <option key={tr.id} value={tr.id}>{tr.name}</option>
              ))}
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

// Stiller aynı kalacak...
const styles: Record<string, CSSProperties> = {
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