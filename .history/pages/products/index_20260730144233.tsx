import { useState, useEffect, CSSProperties } from "react";
/* eslint-disable @next/next/no-img-element */
import axios, { type InternalAxiosRequestConfig } from "axios";
import ExportButtons from "../../components/ExportButtons";
import * as XLSX from "xlsx";

const apiClient = axios.create();

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers = { ...(config.headers as Record<string, string>), Authorization: `Bearer ${token}` } as any;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== "undefined" && error?.response?.status === 401) {
      localStorage.removeItem("token");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

async function getArrayOrEmpty<T>(url: string, label: string): Promise<T[]> {
  try {
    const response = await apiClient.get(url);
    return Array.isArray(response.data) ? (response.data as T[]) : [];
  } catch (error) {
    console.error(`${label} yuklenemedi:`, error);
    return [];
  }
}

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

interface WarehouseOption {
  id: number;
  code: string;
  name: string;
  isActive?: boolean;
}

interface Accessory {
  id: number;
  code?: string;
  name: string;
  unit: string;
  stockQuantity: number;
  warehouseId?: number | null;
  warehouse?: WarehouseOption | null;
}

interface ProductRecipe {
  id?: number;
  resourceType: "FABRIC" | "ACCESSORY";
  fabricId?: number | "";
  accessoryId?: number | "";
  quantityPerUnit: number;
  unit: "m" | "kg";
  fabric?: Fabric;
  accessory?: Accessory;
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
  warehouse?: WarehouseOption | null;
  recipes?: ProductRecipe[];
  fabricType?: string; // For backward compatibility
}

interface ProductForm {
  modelNo: string;
  name: string;
  image?: string;
  materialTypeId: string;
  fabricId: string;
  groupId: string;
  taxRateId: string;
  warehouseId: string;
  recipes: ProductRecipe[];
}

interface ProductListProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  fetchProducts: () => Promise<void>;
}

interface ProductAddProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
}

interface ProductionPlanningRow {
  resourceType: "FABRIC" | "ACCESSORY";
  resourceId: number;
  resourceName: string;
  unit: string;
  requiredQuantity: number;
  stockQuantity: number;
  netQuantity: number;
  purchaseQuantity: number;
  orders: string[];
}

interface ProductEditProps {
  product: Product;
  onSave: (updatedProduct: Product) => void;
  onCancel: () => void;
}

type CsvRow = Record<string, string>;
type GenericRow = Record<string, unknown>;

// CSV parsing utility
function parseCSV(csvText: string): CsvRow[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows: CsvRow[] = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const obj: CsvRow = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    return obj;
  });

  return rows;
}

function pickFirstValue(row: GenericRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null) continue;
    const normalized = String(value).trim();
    if (normalized.length > 0) return normalized;
  }
  return "";
}

function createEmptyRecipe(): ProductRecipe {
  return {
    resourceType: "FABRIC",
    fabricId: "",
    accessoryId: "",
    quantityPerUnit: 0,
    unit: "m",
  };
}

function ProductRecipeEditor({
  recipes,
  fabrics,
  accessories,
  onChange,
}: {
  recipes: ProductRecipe[];
  fabrics: Fabric[];
  accessories: Accessory[];
  onChange: (recipes: ProductRecipe[]) => void;
}) {
  const updateRecipe = (
    index: number,
    field: keyof ProductRecipe,
    value: string | number
  ) => {
    const updated = [...recipes];
    updated[index] = {
      ...updated[index],
      ...(field === "resourceType"
        ? {
            resourceType: value as "FABRIC" | "ACCESSORY",
            fabricId: value === "FABRIC" ? updated[index].fabricId || "" : "",
            accessoryId: value === "ACCESSORY" ? updated[index].accessoryId || "" : "",
            unit: value === "FABRIC" ? "m" : updated[index].unit,
          }
        : {}),
      [field]: field === "quantityPerUnit" ? Number(value) || 0 : value,
    };
    onChange(updated);
  };

  const removeRecipe = (index: number) => {
    onChange(recipes.filter((_, recipeIndex) => recipeIndex !== index));
  };

  return (
    <div style={styles.recipeWrapper}>
      <div style={styles.recipeHeader}>
        <label style={styles.label}>Ürün Reçetesi</label>
        <button
          type="button"
          style={styles.smallActionButton}
          onClick={() => onChange([...recipes, createEmptyRecipe()])}
        >
          Satır Ekle
        </button>
      </div>

      {recipes.length === 0 ? (
        <div style={styles.recipeEmpty}>
          Bu ürüne bağlı hammadde yok. Reçete ekleyerek siparişten metre/kg ihtiyacı hesaplanabilir.
        </div>
      ) : (
        recipes.map((recipe, index) => (
          <div key={`recipe-${index}`} style={styles.recipeRow}>
            <select
              value={recipe.resourceType}
              onChange={(e) => updateRecipe(index, "resourceType", e.target.value)}
              style={{ ...styles.select, flex: 1 }}
            >
              <option value="FABRIC">Kumaş</option>
              <option value="ACCESSORY">Aksesuar</option>
            </select>
            {recipe.resourceType === "FABRIC" ? (
              <select
                value={recipe.fabricId || ""}
                onChange={(e) => updateRecipe(index, "fabricId", e.target.value)}
                style={{ ...styles.select, flex: 2 }}
              >
                <option value="">Kumaş seçiniz</option>
                {fabrics.map((fabric) => (
                  <option key={fabric.id} value={fabric.id}>
                    {fabric.name}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={recipe.accessoryId || ""}
                onChange={(e) => updateRecipe(index, "accessoryId", e.target.value)}
                style={{ ...styles.select, flex: 2 }}
              >
                <option value="">Aksesuar seçiniz</option>
                {accessories.map((accessory) => (
                  <option key={accessory.id} value={accessory.id}>
                    {accessory.name}
                  </option>
                ))}
              </select>
            )}
            <input
              type="number"
              min="0"
              step="0.001"
              value={recipe.quantityPerUnit}
              onChange={(e) => updateRecipe(index, "quantityPerUnit", e.target.value)}
              style={{ ...styles.input, flex: 1 }}
              placeholder="Miktar"
            />
            <select
              value={recipe.unit}
              onChange={(e) => updateRecipe(index, "unit", e.target.value as "m" | "kg")}
              style={{ ...styles.select, flex: 1 }}
            >
              <option value="m">Metre</option>
              <option value="kg">KG</option>
            </select>
            <button
              type="button"
              style={{ ...styles.smallButton, backgroundColor: "#dc3545" }}
              onClick={() => removeRecipe(index)}
            >
              Sil
            </button>
          </div>
        ))
      )}
    </div>
  );
}

// Ana Ürünler Bileşeni
export default function ProductsPage() {
  const [activeTab, setActiveTab] = useState("list");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/products');
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
        <button 
          style={activeTab === "accessories" ? {...styles.tabButton, ...styles.activeTab} : styles.tabButton}
          onClick={() => setActiveTab("accessories")}
        >
          Aksesuarlar
        </button>
        <button 
          style={activeTab === "planning" ? {...styles.tabButton, ...styles.activeTab} : styles.tabButton}
          onClick={() => setActiveTab("planning")}
        >
          Üretim Planlama
        </button>
      </div>
      
      {/* İçerik Alanı */}
      <div style={styles.content}>
        {loading ? (
          <div style={styles.recipeEmpty}>Ürünler yükleniyor...</div>
        ) : (
          <>
            {activeTab === "list" && (
              <ProductList products={products} setProducts={setProducts} fetchProducts={fetchProducts} />
            )}
            {activeTab === "add" && (
              <ProductAdd products={products} setProducts={setProducts} setActiveTab={setActiveTab} />
            )}
            {activeTab === "accessories" && <AccessoryManagement />}
            {activeTab === "planning" && <ProductionPlanning />}
          </>
        )}
      </div>
    </div>
  );
}

// Ürün Listesi Bileşeni
function ProductList({ products, setProducts, fetchProducts }: ProductListProps) {
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [importing, setImporting] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "card">("list");

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
  };

  const handleUpdate = async (updatedProduct: Product) => {
    try {
      const response = await apiClient.put('/api/products', {
        id: updatedProduct.id,
        modelNo: updatedProduct.modelNo,
        name: updatedProduct.name,
        materialTypeId: updatedProduct.materialType?.id || null,
        fabricId: updatedProduct.fabric?.id || null,
        groupId: updatedProduct.group?.id || null,
        taxRateId: updatedProduct.taxRate?.id || null,
        warehouseId: updatedProduct.warehouse?.id || null,
        description: updatedProduct.description,
        image: updatedProduct.image,
        recipes: updatedProduct.recipes || [],
      });

      if (response.status === 200) {
        // Refresh the products list
        await fetchProducts();
        setEditingProduct(null);
        alert("Ürün başarıyla güncellendi!");
      }
    } catch (error) {
      console.error('Ürün güncelleme hatası:', error);
      alert('Ürün güncellenirken hata oluştu');
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Bu ürünü silmek istediğinize emin misiniz?")) {
      apiClient.delete(`/api/products?id=${id}`).then(() => {
        setProducts(products.filter((p: Product) => p.id !== id));
        alert("Ürün başarıyla silindi!");
      }).catch(() => {
        alert("Ürün silinirken hata oluştu");
      });
    }
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      let parsedData: GenericRow[] = [];

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
        modelNo: pickFirstValue(row, ['Model No', 'modelNo', 'ModelNo', 'MODEL NO']),
        name: pickFirstValue(row, ['Ürün Adı', 'Urun Adi', 'Urun Adı', 'Ürün Adı', 'name', 'Name']),
        materialTypeId: pickFirstValue(row, ['Malzeme Türü ID', 'Malzeme Turu ID', 'Malzeme Türü ID', 'materialTypeId', 'MaterialTypeId']),
        fabricId: pickFirstValue(row, ['Kumaş Türü ID', 'Kumas Turu ID', 'Kumaş Türü ID', 'fabricId', 'FabricId']),
        groupId: pickFirstValue(row, ['Grup ID', 'groupId', 'GroupId']),
        taxRateId: pickFirstValue(row, ['KDV Oranı ID', 'KDV Orani ID', 'KDV Oranı ID', 'taxRateId', 'TaxRateId']),
        description: pickFirstValue(row, ['Açıklama', 'Aciklama', 'Açıklama', 'description', 'Description']),
        image: pickFirstValue(row, ['Görsel', 'Gorsel', 'Görsel', 'image', 'Image'])
      }));

      const response = await apiClient.post('/api/products/import', { products: productsToImport });

      if (response.data.success > 0) {
        alert(response.data.message);
        // Refresh the products list
        window.location.reload();
      } else {
        alert(`İçe aktarma başarısız: ${response.data.importErrors.join(', ')}`);
      }

    } catch (error: unknown) {
      console.error('Import error:', error);
      const message =
        typeof error === 'object' && error !== null && 'response' in error
          ? ((error as { response?: { data?: { message?: string; error?: string } } }).response?.data?.message ||
            (error as { response?: { data?: { message?: string; error?: string } } }).response?.data?.error)
          : undefined;
      alert(`İçe aktarma sırasında hata oluştu: ${message || 'Bilinmeyen hata'}`);
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
    'Depo': product.warehouse ? `${product.warehouse.code} - ${product.warehouse.name}` : '',
    'Grup': product.group?.name || '',
    'KDV Oranı': product.taxRate?.name || '',
    'Reçete Satırı': product.recipes?.length || 0,
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

          <div style={styles.viewModeRow}>
            <button
              type="button"
              style={{
                ...styles.viewModeButton,
                ...(viewMode === "list" ? styles.viewModeButtonActive : {}),
              }}
              onClick={() => setViewMode("list")}
            >
              Liste Görünümü
            </button>
            <button
              type="button"
              style={{
                ...styles.viewModeButton,
                ...(viewMode === "card" ? styles.viewModeButtonActive : {}),
              }}
              onClick={() => setViewMode("card")}
            >
              Kart Görünümü
            </button>
          </div>

          {viewMode === "list" ? (
            <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Model No</th>
                    <th style={styles.th}>Ürün Adı</th>
                    <th style={styles.th}>Malzeme Türü</th>
                    <th style={styles.th}>Kumaş Türü</th>
                    <th style={styles.th}>Depo</th>
                    <th style={styles.th}>Grup</th>
                    <th style={styles.th}>KDV Oranı</th>
                    <th style={styles.th}>Reçete</th>
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
                        <td style={styles.td}>
                          {product.warehouse ? `${product.warehouse.code} - ${product.warehouse.name}` : "-"}
                        </td>
                        <td style={styles.td}>{product.group?.name}</td>
                        <td style={styles.td}>{product.taxRate?.name}</td>
                        <td style={styles.td}>
                          {product.recipes?.length
                            ? `${product.recipes.length} satır`
                            : "Tanımsız"}
                        </td>
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
                      <td colSpan={9} style={{...styles.td, textAlign: 'center'}}>
                        Henüz hiç ürün eklenmemiş.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={styles.cardGrid}>
              {products.length > 0 ? (
                products.map((product) => (
                  <div key={product.id} style={styles.productCard}>
                    <div style={styles.productImageContainer}>
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name || "Ürün"}
                          style={styles.productImage}
                        />
                      ) : (
                        <div style={styles.productImagePlaceholder}>Görsel yok</div>
                      )}
                    </div>

                    <div style={styles.productCardBody}>
                      <div style={styles.productCardTitle}>{product.name || "-"}</div>
                      <div style={styles.productCardCode}>{product.modelNo || "-"}</div>
                      <div style={styles.productMetaText}>Malzeme: {product.materialType?.name || "-"}</div>
                      <div style={styles.productMetaText}>Kumaş: {product.fabric?.name || "-"}</div>
                      <div style={styles.productMetaText}>
                        Depo: {product.warehouse ? `${product.warehouse.code} - ${product.warehouse.name}` : "-"}
                      </div>
                      <div style={styles.productMetaText}>Grup: {product.group?.name || "-"}</div>
                      <div style={styles.productMetaText}>KDV: {product.taxRate?.name || "-"}</div>
                      <div style={styles.productMetaText}>
                        Reçete: {product.recipes?.length ? `${product.recipes.length} satır` : "Tanımsız"}
                      </div>
                    </div>

                    <div style={styles.cardActions}>
                      <button
                        type="button"
                        style={{...styles.smallButton, flex: 1}}
                        onClick={() => handleEdit(product)}
                      >
                        Düzenle
                      </button>
                      <button
                        type="button"
                        style={{...styles.smallButton, backgroundColor: '#dc3545', flex: 1}}
                        onClick={() => handleDelete(product.id)}
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div style={styles.emptyCardState}>Henüz hiç ürün eklenmemiş.</div>
              )}
            </div>
          )}

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
    taxRateId: "",
    warehouseId: "",
    recipes: [],
  });

  const [isManualCode, setIsManualCode] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    try {
      const [materialTypeData, fabricData, groupData, taxRateData, warehouseData, accessoryData] = await Promise.all([
        getArrayOrEmpty<MaterialType>("/api/material-types", "Materyal tipleri"),
        getArrayOrEmpty<Fabric>("/api/fabrics", "Kumaslar"),
        getArrayOrEmpty<Group>("/api/groups", "Gruplar"),
        getArrayOrEmpty<TaxRate>("/api/tax-rates", "KDV oranlari"),
        getArrayOrEmpty<WarehouseOption>("/api/warehouses?withSummary=false", "Depolar"),
        getArrayOrEmpty<Accessory>("/api/accessories", "Aksesuarlar"),
      ]);
      setMaterialTypes(materialTypeData);
      setFabrics(fabricData);
      setGroups(groupData);
      setTaxRates(taxRateData);
      setWarehouses(warehouseData.filter((warehouse) => warehouse.isActive !== false));
      setAccessories(accessoryData);
    } catch (error) {
      console.error("Secenekler yuklenirken beklenmeyen hata:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const response = await apiClient.post('/api/products', {
        modelNo: form.modelNo,
        name: form.name,
        materialTypeId: form.materialTypeId,
        fabricId: form.fabricId,
        groupId: form.groupId,
        taxRateId: form.taxRateId,
        warehouseId: form.warehouseId || null,
        image: form.image,
        recipes: form.recipes,
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
        taxRateId: "",
        warehouseId: "",
        recipes: [],
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

        <div style={styles.inputGroup}>
          <label style={styles.label}>Depo</label>
          <select
            name="warehouseId"
            value={form.warehouseId}
            onChange={handleChange}
            style={styles.select}
          >
            <option value="">Depo seciniz</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.code} - {warehouse.name}
              </option>
            ))}
          </select>
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

        <ProductRecipeEditor
          recipes={form.recipes}
          fabrics={fabrics}
          accessories={accessories}
          onChange={(recipes) => setForm((prev) => ({ ...prev, recipes }))}
        />

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
                taxRateId: "",
                warehouseId: "",
                recipes: [],
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
    taxRateId: product.taxRate?.id?.toString() || "",
    warehouseId: product.warehouse?.id?.toString() || "",
    recipes: product.recipes?.map((recipe) => ({
      id: recipe.id,
      resourceType: recipe.resourceType,
      fabricId: recipe.fabricId || "",
      accessoryId: recipe.accessoryId || "",
      quantityPerUnit: recipe.quantityPerUnit,
      unit: recipe.unit,
      fabric: recipe.fabric,
      accessory: recipe.accessory,
    })) || [],
  });

  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [imagePreview, setImagePreview] = useState(product.image || "");

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [materialTypeData, fabricData, groupData, taxRateData, warehouseData, accessoryData] = await Promise.all([
          getArrayOrEmpty<MaterialType>("/api/material-types", "Materyal tipleri"),
          getArrayOrEmpty<Fabric>("/api/fabrics", "Kumaslar"),
          getArrayOrEmpty<Group>("/api/groups", "Gruplar"),
          getArrayOrEmpty<TaxRate>("/api/tax-rates", "KDV oranlari"),
          getArrayOrEmpty<WarehouseOption>("/api/warehouses?withSummary=false", "Depolar"),
          getArrayOrEmpty<Accessory>("/api/accessories", "Aksesuarlar"),
        ]);
        setMaterialTypes(materialTypeData);
        setFabrics(fabricData);
        setGroups(groupData);
        setTaxRates(taxRateData);
        setWarehouses(warehouseData.filter((warehouse) => warehouse.isActive !== false));
        setAccessories(accessoryData);
      } catch (error) {
        console.error("Secenekler yuklenirken beklenmeyen hata:", error);
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
      taxRate: taxRates.find(tr => tr.id === parseInt(form.taxRateId)),
      warehouse: warehouses.find((warehouse) => warehouse.id === parseInt(form.warehouseId)) || null,
      recipes: form.recipes,
    };
    onSave(updatedProduct);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setImagePreview(result);
      setForm(prev => ({ ...prev, image: result }));
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImagePreview("");
    setForm(prev => ({ ...prev, image: "" }));
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
              <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={styles.input}
                />
                {imagePreview ? (
                  <button
                    type="button"
                    style={{...styles.smallButton, backgroundColor: '#6c757d', width: 'fit-content'}}
                    onClick={clearImage}
                  >
                    Görseli Kaldır
                  </button>
                ) : null}
              </div>
            </div>
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
            <label style={styles.label}>Depo</label>
            <select
              name="warehouseId"
              value={form.warehouseId}
              onChange={handleChange}
              style={styles.select}
            >
              <option value="">Depo seciniz</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.code} - {warehouse.name}</option>
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

          <ProductRecipeEditor
            recipes={form.recipes}
            fabrics={fabrics}
            accessories={accessories}
            onChange={(recipes) => setForm((prev) => ({ ...prev, recipes }))}
          />

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

function AccessoryManagement() {
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [form, setForm] = useState({
    id: "",
    code: "",
    name: "",
    unit: "m",
    warehouseId: "",
    stockQuantity: "",
  });

  const loadAccessories = async () => {
    const response = await apiClient.get("/api/accessories");
    setAccessories(response.data);
  };

  const loadWarehouses = async () => {
    const response = await apiClient.get("/api/warehouses?withSummary=false");
    const list = Array.isArray(response.data) ? (response.data as WarehouseOption[]) : [];
    setWarehouses(list.filter((warehouse) => warehouse.isActive !== false));
  };

  useEffect(() => {
    loadAccessories();
    loadWarehouses();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (form.id) {
      await apiClient.put("/api/accessories", {
        ...form,
        warehouseId: form.warehouseId ? Number(form.warehouseId) : null,
      });
    } else {
      await apiClient.post("/api/accessories", {
        ...form,
        warehouseId: form.warehouseId ? Number(form.warehouseId) : null,
      });
    }

    setForm({ id: "", code: "", name: "", unit: "m", warehouseId: "", stockQuantity: "" });
    loadAccessories();
  };

  const handleEdit = (accessory: Accessory) => {
    setForm({
      id: String(accessory.id),
      code: accessory.code || "",
      name: accessory.name,
      unit: accessory.unit,
      warehouseId: accessory.warehouse?.id ? String(accessory.warehouse.id) : "",
      stockQuantity: String(accessory.stockQuantity),
    });
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Bu aksesuarı silmek istiyor musunuz?")) return;
    await apiClient.delete("/api/accessories", { data: { id } });
    loadAccessories();
  };

  return (
    <div style={styles.sectionCard}>
      <h3 style={styles.sectionTitle}>Aksesuar Kartları</h3>
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.recipeRow}>
          <input
            type="text"
            placeholder="Kod"
            value={form.code}
            onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
            style={{ ...styles.input, flex: 1 }}
          />
          <input
            type="text"
            placeholder="Aksesuar adı"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            style={{ ...styles.input, flex: 2 }}
            required
          />
          <select
            value={form.unit}
            onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
            style={{ ...styles.select, flex: 1 }}
          >
            <option value="m">Metre</option>
            <option value="kg">KG</option>
          </select>
          <select
            value={form.warehouseId}
            onChange={(e) => setForm((prev) => ({ ...prev, warehouseId: e.target.value }))}
            style={{ ...styles.select, flex: 1.5 }}
          >
            <option value="">Depo seciniz</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.code} - {warehouse.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.001"
            placeholder="Stok"
            value={form.stockQuantity}
            onChange={(e) => setForm((prev) => ({ ...prev, stockQuantity: e.target.value }))}
            style={{ ...styles.input, flex: 1 }}
          />
          <button type="submit" style={styles.submitButton}>
            {form.id ? "Güncelle" : "Kaydet"}
          </button>
        </div>
      </form>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Kod</th>
              <th style={styles.th}>Ad</th>
              <th style={styles.th}>Birim</th>
              <th style={styles.th}>Depo</th>
              <th style={styles.th}>Stok</th>
              <th style={styles.th}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {accessories.map((accessory) => (
              <tr key={accessory.id}>
                <td style={styles.td}>{accessory.code || "-"}</td>
                <td style={styles.td}>{accessory.name}</td>
                <td style={styles.td}>{accessory.unit}</td>
                <td style={styles.td}>
                  {accessory.warehouse ? `${accessory.warehouse.code} - ${accessory.warehouse.name}` : "-"}
                </td>
                <td style={styles.td}>{accessory.stockQuantity}</td>
                <td style={styles.td}>
                  <button style={{ ...styles.smallButton, marginRight: 8 }} onClick={() => handleEdit(accessory)}>
                    Düzenle
                  </button>
                  <button style={{ ...styles.smallButton, backgroundColor: "#dc3545" }} onClick={() => handleDelete(accessory.id)}>
                    Sil
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductionPlanning() {
  const [rows, setRows] = useState<ProductionPlanningRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPlanning = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get("/api/production-planning");
      setRows(response.data.rows || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlanning();
  }, []);

  return (
    <div style={styles.sectionCard}>
      <div style={styles.recipeHeader}>
        <div>
          <h3 style={styles.sectionTitle}>Üretim Planlama</h3>
          <p style={styles.recipeEmpty}>
            Sipariş reçetelerine göre toplam ihtiyaç, mevcut stok ve satın alma açığı burada hesaplanır.
          </p>
        </div>
        <button type="button" style={styles.smallActionButton} onClick={loadPlanning}>
          Yenile
        </button>
      </div>

      {loading ? (
        <div style={styles.recipeEmpty}>Planlama yükleniyor...</div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Kaynak</th>
                <th style={styles.th}>Tip</th>
                <th style={styles.th}>Gerekli</th>
                <th style={styles.th}>Stok</th>
                <th style={styles.th}>Net</th>
                <th style={styles.th}>Satın Alma</th>
                <th style={styles.th}>Siparişler</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row) => (
                  <tr key={`${row.resourceType}-${row.resourceId}`}>
                    <td style={styles.td}>{row.resourceName}</td>
                    <td style={styles.td}>{row.resourceType === "FABRIC" ? "Kumaş" : "Aksesuar"}</td>
                    <td style={styles.td}>{row.requiredQuantity.toFixed(3)} {row.unit}</td>
                    <td style={styles.td}>{row.stockQuantity.toFixed(3)} {row.unit}</td>
                    <td style={{ ...styles.td, color: row.netQuantity < 0 ? "#dc2626" : "#15803d" }}>
                      {row.netQuantity.toFixed(3)} {row.unit}
                    </td>
                    <td style={styles.td}>{row.purchaseQuantity.toFixed(3)} {row.unit}</td>
                    <td style={styles.td}>{row.orders.join(", ")}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={styles.td} colSpan={7}>
                    Hesaplanacak planlama verisi bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Stiller aynı kalacak...
const styles: Record<string, CSSProperties> = {
  container: {
    width: "100%",
    maxWidth: "100%",
    minHeight: "100vh",
    margin: "0",
    padding: "1.5rem",
    backgroundColor: "#fff",
    borderRadius: "0",
    boxShadow: "none",
    boxSizing: "border-box",
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
    borderTopWidth: "0",
    borderRightWidth: "0",
    borderLeftWidth: "0",
    borderBottomWidth: "3px",
    borderBottomStyle: "solid",
    borderBottomColor: "transparent",
    cursor: "pointer",
    fontSize: "1rem",
    fontWeight: "500",
    color: "#6c757d",
    transition: "all 0.3s"
  },
  activeTab: {
    color: "#007bff",
    borderBottomColor: "#007bff",
    marginBottom: "-2px"
  },
  content: {
    padding: "0 0.5rem"
  },
  sectionCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "1rem"
  },
  sectionTitle: {
    margin: "0 0 0.75rem 0",
    color: "#1f2937"
  },
  tableContainer: {
    overflowX: "auto"
  },
  viewModeRow: {
    display: "flex",
    gap: "0.5rem",
    marginBottom: "1rem"
  },
  viewModeButton: {
    padding: "0.55rem 0.9rem",
    backgroundColor: "#f1f5f9",
    color: "#1f2937",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: "600"
  },
  viewModeButtonActive: {
    backgroundColor: "#2563eb",
    color: "#ffffff",
    borderColor: "#1d4ed8"
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: "1rem"
  },
  productCard: {
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    overflow: "hidden",
    backgroundColor: "#ffffff",
    display: "flex",
    flexDirection: "column",
    minHeight: "100%"
  },
  productImageContainer: {
    height: "170px",
    backgroundColor: "#f8fafc",
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  productImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover"
  },
  productImagePlaceholder: {
    color: "#6b7280",
    fontSize: "0.9rem"
  },
  productCardBody: {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
    padding: "0.8rem",
    flex: 1
  },
  productCardTitle: {
    fontSize: "1rem",
    fontWeight: "700",
    color: "#111827"
  },
  productCardCode: {
    color: "#4b5563",
    fontSize: "0.88rem",
    marginBottom: "0.25rem"
  },
  productMetaText: {
    fontSize: "0.85rem",
    color: "#374151",
    lineHeight: 1.35
  },
  cardActions: {
    display: "flex",
    gap: "0.5rem",
    padding: "0 0.8rem 0.8rem"
  },
  emptyCardState: {
    border: "1px dashed #cbd5e1",
    borderRadius: "10px",
    padding: "1.2rem",
    textAlign: "center",
    color: "#6b7280"
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
    gap: "1.2rem",
    width: "100%",
    maxWidth: "100%"
  },
  recipeWrapper: {
    border: "1px solid #dee2e6",
    borderRadius: "10px",
    padding: "1rem",
    backgroundColor: "#f8fafc"
  },
  recipeHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.75rem"
  },
  recipeEmpty: {
    fontSize: "0.9rem",
    color: "#6c757d",
    lineHeight: 1.5
  },
  recipeRow: {
    display: "flex",
    gap: "0.75rem",
    alignItems: "center",
    marginBottom: "0.75rem",
    flexWrap: "wrap"
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
    borderTopWidth: "0",
    borderRightWidth: "0",
    borderLeftWidth: "0",
    borderBottomWidth: "3px",
    borderBottomStyle: "solid",
    borderBottomColor: "transparent",
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
    borderTopWidth: "0",
    borderRightWidth: "0",
    borderLeftWidth: "0",
    borderBottomWidth: "3px",
    borderBottomStyle: "solid",
    borderBottomColor: "transparent",
    borderRadius: "6px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "background-color 0.3s"
  },
  smallButton: {
    padding: "0.5rem 0.8rem",
    backgroundColor: "#007bff",
    color: "white",
    borderTopWidth: "0",
    borderRightWidth: "0",
    borderLeftWidth: "0",
    borderBottomWidth: "3px",
    borderBottomStyle: "solid",
    borderBottomColor: "transparent",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.9rem"
  },
  smallActionButton: {
    padding: "0.5rem 0.8rem",
    backgroundColor: "#1d4ed8",
    color: "white",
    borderTopWidth: "0",
    borderRightWidth: "0",
    borderLeftWidth: "0",
    borderBottomWidth: "3px",
    borderBottomStyle: "solid",
    borderBottomColor: "transparent",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.9rem"
  },
  submitButton: {
    padding: "0.9rem 1.5rem",
    backgroundColor: "#28a745",
    color: "white",
    borderTopWidth: "0",
    borderRightWidth: "0",
    borderLeftWidth: "0",
    borderBottomWidth: "3px",
    borderBottomStyle: "solid",
    borderBottomColor: "transparent",
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
    width: "95%",
    maxWidth: "1100px",
    maxHeight: "90vh",
    overflowY: "auto"
  }
};






