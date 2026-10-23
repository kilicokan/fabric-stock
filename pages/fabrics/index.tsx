'use client';

import { useState, useEffect, CSSProperties } from "react";
import axios from "axios";
import ExportButtons from "../../components/ExportButtons";
import * as XLSX from "xlsx";
import { useRouter } from "next/router";
import { notifySuccess, notifyError } from "../../hooks/useToast";

interface Fabric {
  id: number;
  code?: string;
  name: string;
  property?: string;
  width?: number;
  length?: number;
  depot?: string;
  warehouseId?: number | null;
  warehouse?: {
    id: number;
    code: string;
    name: string;
  } | null;
  unit?: string;
  stockQuantity: number;
  defectiveQuantity?: number;
  averageGrammage?: number | null;
  createdAt: string;
}

interface WarehouseOption {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

interface FabricForm {
  code: string;
  name: string;
  property: string;
  width: string;
  length: string;
  depot: string;
  warehouseId: string;
  unit: string;
  stockQuantity: string;
  averageGrammage: string;
}

interface FabricListProps {
  fabrics: Fabric[];
  setFabrics: React.Dispatch<React.SetStateAction<Fabric[]>>;
}

interface FabricAddProps {
  fabrics: Fabric[];
  setFabrics: React.Dispatch<React.SetStateAction<Fabric[]>>;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
  warehouses: WarehouseOption[];
}

interface FabricEditProps {
  fabric: Fabric;
  onSave: (updatedFabric: Fabric) => void;
  onCancel: () => void;
}

type ParsedImportRow = Record<string, string | number | boolean | null | undefined>;

const getAuthHeaders = (): { Authorization: string } | undefined => {
  if (typeof window === "undefined") return undefined;
  const token = localStorage.getItem("token") || localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};

const normalizeHeaderKey = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0131/g, "i")
    .replace(/\u0130/g, "i")
    .replace(/\s+/g, "")
    .toLowerCase();

const pickRowValue = (
  row: ParsedImportRow,
  aliases: string[]
): string | number | boolean | null | undefined => {
  const directMatch = aliases.find((alias) => alias in row);
  if (directMatch) return row[directMatch];

  const normalizedAliasSet = new Set(aliases.map((alias) => normalizeHeaderKey(alias)));
  for (const [rawKey, rawValue] of Object.entries(row)) {
    if (normalizedAliasSet.has(normalizeHeaderKey(rawKey))) {
      return rawValue;
    }
  }
  return undefined;
};

const normalizeNumericText = (
  value: string | number | boolean | null | undefined
): string | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";

  const raw = String(value).trim();
  if (!raw) return null;

  const compact = raw.replace(/\s+/g, "");
  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      return compact.replace(/\./g, "").replace(",", ".");
    }
    return compact.replace(/,/g, "");
  }
  if (lastComma > -1) {
    return compact.replace(",", ".");
  }
  return compact;
};

const parseCsvWithXlsx = (csvText: string): ParsedImportRow[] => {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const header = lines[0];
  const commaCount = (header.match(/,/g) || []).length;
  const semicolonCount = (header.match(/;/g) || []).length;
  const fs = semicolonCount > commaCount ? ";" : ",";

  const workbook = XLSX.read(csvText, { type: "string", FS: fs });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<ParsedImportRow>(worksheet, { defval: "", raw: false });
};

// Ana Kumaşlar Bileşeni
export default function FabricsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("list"); // "list" veya "add"
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [, setLoading] = useState(true);

  useEffect(() => {
    fetchFabrics();
    fetchWarehouses();
  }, []);

  const handleUnauthorized = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    router.replace("/login");
  };

  const fetchFabrics = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/fabrics', {
        headers: getAuthHeaders(),
      });
      setFabrics(response.data as Fabric[]);
    } catch (error) {
      console.error('Kumaşlar yüklenirken hata:', error);
      if ((error as { response?: { status?: number } })?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      notifyError('Kumaşlar yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const response = await axios.get('/api/warehouses?withSummary=false', {
        headers: getAuthHeaders(),
      });
      const list = Array.isArray(response.data) ? (response.data as WarehouseOption[]) : [];
      setWarehouses(list.filter((warehouse) => warehouse.isActive));
    } catch (error) {
      console.error('Depolar yuklenirken hata:', error);
      if ((error as { response?: { status?: number } })?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      setWarehouses([]);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.mainTitle}>Kumaş Yönetimi</h2>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div style={styles.tabContainer}>
          <button
            style={activeTab === "list" ? {...styles.tabButton, ...styles.activeTab} : styles.tabButton}
            onClick={() => setActiveTab("list")}
          >
            Kumaşlar
          </button>
          <button
            style={activeTab === "add" ? {...styles.tabButton, ...styles.activeTab} : styles.tabButton}
            onClick={() => setActiveTab("add")}
          >
            Kumaş Ekle
          </button>
        </div>
        <button
          onClick={() => { window.location.href = '/fabrics/defective-stock'; }}
          style={{
            background: '#b91c1c',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Hatalı Kumaş Stokları
        </button>
      </div>

      {/* İçerik Alanı */}
      <div style={styles.content}>
        {activeTab === "list" ?
          <FabricList fabrics={fabrics} setFabrics={setFabrics} /> :
          <FabricAdd
            fabrics={fabrics}
            setFabrics={setFabrics}
            setActiveTab={setActiveTab}
            warehouses={warehouses}
          />
        }
      </div>
    </div>
  );
}

// Kumaş Listesi Bileşeni
function FabricList({ fabrics, setFabrics }: FabricListProps) {
  const [editingFabric, setEditingFabric] = useState<Fabric | null>(null);
  const [importing, setImporting] = useState(false);
  const [filters, setFilters] = useState({
    name: '',
    property: '',
    depot: '',
  });

  const handleEdit = (fabric: Fabric) => {
    setEditingFabric(fabric);
  };

  const handleUpdate = async (updatedFabric: Fabric) => {
    try {
      const response = await axios.put('/api/fabrics', updatedFabric, { headers: getAuthHeaders() });
      const savedFabric = response.data.fabric || response.data;
      setFabrics(fabrics.map((f: Fabric) => f.id === updatedFabric.id ? savedFabric : f));
      setEditingFabric(null);
      notifySuccess("Kumaş başarıyla güncellendi!");
    } catch (error) {
      console.error("Kumaş güncellenirken hata:", error);
      if ((error as { response?: { status?: number } })?.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("authToken");
        window.location.href = "/login";
        return;
      }
      notifyError("Kumaş güncellenemedi.");
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Bu kumaşı silmek istediğinize emin misiniz?")) {
      setFabrics(fabrics.filter((f: Fabric) => f.id !== id));
      notifySuccess("Kumaş başarıyla silindi!");
    }
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      let parsedData: ParsedImportRow[] = [];

      if (fileExtension === 'csv') {
        const text = await file.text();
        parsedData = parseCsvWithXlsx(text);
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        parsedData = XLSX.utils.sheet_to_json<ParsedImportRow>(worksheet, { defval: "", raw: false });
      } else {
        notifyError('Sadece CSV ve Excel dosyaları desteklenir.');
        return;
      }

      if (parsedData.length === 0) {
        notifyError('Dosya boş veya geçersiz format.');
        return;
      }

      // Transform data to match API expectations
      const fabricsToImport = parsedData.map(row => {
        const rowValues = Object.values(row);
        const codeValue = pickRowValue(row, ['Kod', 'code', 'Code']) ?? rowValues[0];
        const nameValue = pickRowValue(row, ['Ad', 'Kumas Adi', 'Urun Adi', 'name', 'Name']) ?? rowValues[1];
        const propertyValue = pickRowValue(row, ['Ozellik', 'property', 'Property']) ?? rowValues[2];
        const widthValue = pickRowValue(row, ['En', 'width', 'Width']) ?? rowValues[3];
        const lengthValue = pickRowValue(row, ['Boy', 'length', 'Length']) ?? rowValues[4];
        const depotValue = pickRowValue(row, ['Depo', 'depot', 'Depot', 'Warehouse', 'Ambar']) ?? rowValues[5];
        const unitValue = pickRowValue(row, ['Birim', 'unit', 'Unit']) ?? rowValues[6];
        const stockQuantityValue =
          pickRowValue(row, ['Stok Miktari', 'stockQuantity', 'StockQuantity', 'Quantity', 'Miktar']) ?? rowValues[7];

        return {
          code: codeValue,
          name: nameValue,
          property: propertyValue,
          width: normalizeNumericText(widthValue),
          length: normalizeNumericText(lengthValue),
          depot: depotValue,
          unit: unitValue,
          stockQuantity: normalizeNumericText(stockQuantityValue),
        };
      });

      const response = await axios.post('/api/fabrics/import', { fabrics: fabricsToImport }, {
        headers: getAuthHeaders(),
      });

      if (response.data.success > 0) {
        notifySuccess(response.data.message);
        // Refresh the fabrics list
        window.location.reload();
      } else {
        const importErrors = Array.isArray(response.data.importErrors) ? response.data.importErrors : [];
        const duplicateNames = Array.isArray(response.data.duplicateNames) ? response.data.duplicateNames : [];
        if (importErrors.length > 0) {
          notifyError(`İçe aktarma başarısız: ${importErrors.join(', ')}`);
        } else if (duplicateNames.length > 0) {
          notifyError(`İçe aktarılan satırların adları zaten mevcut: ${duplicateNames.join(', ')}`);
        } else {
          notifyError(response.data.message || "İçe aktarma başarısız.");
        }
      }

    } catch (error) {
      console.error('Import error:', error);
      if ((error as { response?: { status?: number } })?.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("authToken");
        window.location.href = "/login";
        return;
      }
      const message = axios.isAxiosError(error)
        ? (error.response?.data?.error ||
          error.response?.data?.message ||
          error.message)
        : 'İçe aktarma sırasında hata oluştu.';
      notifyError(String(message || 'İçe aktarma sırasında hata oluştu.'));
    } finally {
      setImporting(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const filteredFabrics = fabrics.filter(fabric => {
    const matchesName = filters.name === '' || fabric.name.toLowerCase().includes(filters.name.toLowerCase());
    const matchesProperty = filters.property === '' || (fabric.property && fabric.property.toLowerCase().includes(filters.property.toLowerCase()));
    const depotSearchPool = [fabric.depot || "", fabric.warehouse?.code || "", fabric.warehouse?.name || ""]
      .join(" ")
      .toLowerCase();
    const matchesDepot = filters.depot === '' || depotSearchPool.includes(filters.depot.toLowerCase());
    return matchesName && matchesProperty && matchesDepot;
  });

  const exportData = filteredFabrics.map(fabric => ({
    'Kod': fabric.code || '',
    'Ad': fabric.name,
    'Özellik': fabric.property || '',
    'En': fabric.width || '',
    'Boy': fabric.length || '',
    'Depo': fabric.warehouse ? `${fabric.warehouse.code} - ${fabric.warehouse.name}` : fabric.depot || '',
    'Birim': fabric.unit || '',
    'Stok Miktarı': fabric.stockQuantity,
    'Oluşturulma Tarihi': new Date(fabric.createdAt).toLocaleDateString('tr-TR')
  }));

  return (
    <div>
      {editingFabric ? (
        <FabricEdit
          fabric={editingFabric}
          onSave={handleUpdate}
          onCancel={() => setEditingFabric(null)}
        />
      ) : (
        <>
          {/* Filters */}
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Kumaş Adı"
              value={filters.name}
              onChange={(e) => setFilters({ ...filters, name: e.target.value })}
              style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', minWidth: '150px' }}
            />
            <input
              type="text"
              placeholder="Özellik"
              value={filters.property}
              onChange={(e) => setFilters({ ...filters, property: e.target.value })}
              style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', minWidth: '150px' }}
            />
            <input
              type="text"
              placeholder="Depo"
              value={filters.depot}
              onChange={(e) => setFilters({ ...filters, depot: e.target.value })}
              style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', minWidth: '150px' }}
            />
          </div>

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
              {importing ? 'İçe Aktarılıyor...' : 'Kumaş İçe Aktar'}
            </label>

            <ExportButtons
              data={exportData}
              filename="kumas-listesi"
              disabled={filteredFabrics.length === 0}
            />
          </div>

          <div style={styles.tableContainer}>
            <table style={styles.table}>
               <thead>
                 <tr>
                   <th style={styles.th}>Kod</th>
                   <th style={styles.th}>Ad</th>
                   <th style={styles.th}>Özellik</th>
                   <th style={styles.th}>En</th>
                   <th style={styles.th}>Boy</th>
                   <th style={styles.th}>Depo</th>
                   <th style={styles.th}>Birim</th>
                   <th style={styles.th}>Stok Miktarı</th>
                   <th style={styles.th}>Hatalı Stok</th>
                   <th style={styles.th}>İşlemler</th>
                 </tr>
               </thead>
               <tbody>
                 {filteredFabrics.length > 0 ? (
                   filteredFabrics.map(fabric => (
                     <tr key={fabric.id}>
                       <td style={styles.td}>{fabric.code || '-'}</td>
                       <td style={styles.td}>{fabric.name}</td>
                       <td style={styles.td}>{fabric.property || '-'}</td>
                       <td style={styles.td}>{fabric.width || '-'}</td>
                       <td style={styles.td}>{fabric.length || '-'}</td>
                       <td style={styles.td}>
                         {fabric.warehouse ? `${fabric.warehouse.code} - ${fabric.warehouse.name}` : fabric.depot || '-'}
                       </td>
                       <td style={styles.td}>{fabric.unit || '-'}</td>
                       <td style={styles.td}>{fabric.stockQuantity}</td>
                       <td style={{...styles.td, color: '#dc3545'}}>{fabric.defectiveQuantity || 0}</td>
                       <td style={styles.td}>
                         <button
                           style={{...styles.smallButton, marginRight: '0.5rem'}}
                           onClick={() => handleEdit(fabric)}
                         >
                           Düzenle
                         </button>
                         <button
                           style={{...styles.smallButton, backgroundColor: '#dc3545'}}
                           onClick={() => handleDelete(fabric.id)}
                         >
                           Sil
                         </button>
                       </td>
                     </tr>
                   ))
                 ) : (
                   <tr>
                     <td colSpan={10} style={{...styles.td, textAlign: 'center'}}>
                       Filtrelemeye uygun kumaş bulunamadı.
                     </td>
                   </tr>
                 )}
               </tbody>
            </table>
          </div>

          <div style={{marginTop: '1rem', textAlign: 'center', color: '#6c757d'}}>
            Toplam {filteredFabrics.length} kumaş listeleniyor.
          </div>
        </>
      )}
    </div>
  );
}

// Kumaş Ekleme Bileşeni
function FabricAdd({ fabrics, setFabrics, setActiveTab, warehouses }: FabricAddProps) {
  const [form, setForm] = useState<FabricForm>({
    code: "",
    name: "",
    property: "",
    width: "",
    length: "",
    depot: "",
    warehouseId: "",
    unit: "",
    stockQuantity: "",
    averageGrammage: ""
  });

  const [isManualCode, setIsManualCode] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const response = await axios.post('/api/fabrics', {
        code: form.code,
        name: form.name,
        property: form.property,
        width: form.width ? parseFloat(form.width) : null,
        length: form.length ? parseFloat(form.length) : null,
        depot: form.depot,
        warehouseId: form.warehouseId ? Number(form.warehouseId) : null,
        unit: form.unit,
        stockQuantity: parseFloat(form.stockQuantity) || 0
        , averageGrammage: form.averageGrammage ? parseFloat(form.averageGrammage) : null
      }, {
        headers: getAuthHeaders(),
      });

      notifySuccess("Kumaş başarıyla eklendi!");
      setFabrics([...fabrics, response.data.fabric]);

      // Formu temizle
      setForm({
        code: "",
        name: "",
        property: "",
        width: "",
        length: "",
        depot: "",
        warehouseId: "",
        unit: "",
        stockQuantity: "",
        averageGrammage: ""
      });
      setIsManualCode(false);

      // Listeleme sekmesine geç
      setActiveTab("list");
    } catch (error) {
      console.error('Kumaş eklenirken hata:', error);
      if ((error as { response?: { status?: number } })?.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("authToken");
        window.location.href = "/login";
        return;
      }
      notifyError('Kumaş eklenirken hata oluştu');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "warehouseId") {
      const selectedWarehouse = warehouses.find((warehouse) => String(warehouse.id) === value);
      setForm((prev) => ({
        ...prev,
        warehouseId: value,
        depot: selectedWarehouse ? selectedWarehouse.code : "",
      }));
      return;
    }
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const generateFabricCode = () => {
    const randomCode = "FAB-" + Math.floor(1000 + Math.random() * 9000);
    setForm(prev => ({ ...prev, code: randomCode }));
  };

  return (
    <div>
      <form onSubmit={handleSubmit} style={styles.form}>
        {/* Kumaş Kodu Alanı */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Kumaş Kodu</label>
          <div style={styles.inputWithButton}>
            <input
              type="text"
              name="code"
              value={form.code}
              onChange={handleChange}
              style={styles.textInput}
              placeholder="Kumaş kodunu giriniz"
              required
              disabled={!isManualCode}
            />
            {!isManualCode ? (
              <button
                type="button"
                style={styles.scaleButton}
                onClick={generateFabricCode}
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

        {/* Kumaş Adı Alanı */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Kumaş Adı</label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            style={styles.input}
            placeholder="Kumaş adını giriniz"
            required
          />
        </div>

        {/* Özellik Alanı */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Özellik</label>
          <input
            type="text"
            name="property"
            value={form.property}
            onChange={handleChange}
            style={styles.input}
            placeholder="Kumaş özelliğini giriniz"
          />
        </div>

        {/* En ve Boy Alanları */}
        <div style={{display: 'flex', gap: '1rem'}}>
          <div style={{...styles.inputGroup, flex: 1}}>
            <label style={styles.label}>En (cm)</label>
            <input
              type="number"
              name="width"
              value={form.width}
              onChange={handleChange}
              style={styles.input}
              placeholder="En"
              step="0.01"
            />
          </div>
          <div style={{...styles.inputGroup, flex: 1}}>
            <label style={styles.label}>Boy (cm)</label>
            <input
              type="number"
              name="length"
              value={form.length}
              onChange={handleChange}
              style={styles.input}
              placeholder="Boy"
              step="0.01"
            />
          </div>
        </div>

        {/* Depo ve Birim Alanları */}
        <div style={{display: 'flex', gap: '1rem'}}>
          <div style={{...styles.inputGroup, flex: 1}}>
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
            <small style={{ color: '#6c757d' }}>
              {form.depot ? `Kod: ${form.depot}` : 'Depo kodu secime gore atanir.'}
            </small>
          </div>
          <div style={{...styles.inputGroup, flex: 1}}>
            <label style={styles.label}>Birim</label>
            <input
              type="text"
              name="unit"
              value={form.unit}
              onChange={handleChange}
              style={styles.input}
              placeholder="Birim (m, kg, vb.)"
            />
          </div>
        </div>

        {/* Stok Miktarı Alanı */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Stok Miktarı</label>
          <input
            type="number"
            name="stockQuantity"
            value={form.stockQuantity}
            onChange={handleChange}
            style={styles.input}
            placeholder="Stok miktarı"
            step="0.01"
            required
          />
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Kumaş Ortalama Gramajı (g/m²)</label>
          <input type="number" name="averageGrammage" value={form.averageGrammage} onChange={handleChange} style={styles.input} step="0.01" min="0" />
        </div>

        {/* Butonlar */}
        <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem'}}>
          <button
            type="button"
            style={{...styles.scaleButton, backgroundColor: '#6c757d'}}
            onClick={() => {
              setForm({
                code: "",
                name: "",
                property: "",
                width: "",
                length: "",
                depot: "",
                warehouseId: "",
                unit: "",
                stockQuantity: "",
                averageGrammage: ""
              });
              setIsManualCode(false);
            }}
          >
            Formu Temizle
          </button>
          <button
            type="submit"
            style={styles.submitButton}
          >
            Kumaşı Kaydet
          </button>
        </div>
      </form>
    </div>
  );
}

// Kumaş Düzenleme Bileşeni
function FabricEdit({ fabric, onSave, onCancel }: FabricEditProps) {
  const [form, setForm] = useState<FabricForm>({
    code: fabric.code || "",
    name: fabric.name,
    property: fabric.property || "",
    width: fabric.width?.toString() || "",
    length: fabric.length?.toString() || "",
    depot: fabric.depot || "",
    warehouseId: fabric.warehouseId ? String(fabric.warehouseId) : "",
    unit: fabric.unit || "",
    stockQuantity: fabric.stockQuantity.toString(),
    averageGrammage: fabric.averageGrammage?.toString() || ""
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const updatedFabric: Fabric = {
      ...fabric,
      code: form.code,
      name: form.name,
      property: form.property,
      width: form.width ? parseFloat(form.width) : undefined,
      length: form.length ? parseFloat(form.length) : undefined,
      depot: form.depot,
      warehouseId: form.warehouseId ? Number(form.warehouseId) : null,
      unit: form.unit,
      stockQuantity: parseFloat(form.stockQuantity)
      , averageGrammage: form.averageGrammage ? parseFloat(form.averageGrammage) : null
    };
    onSave(updatedFabric);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div style={styles.editModal}>
      <div style={styles.editContent}>
        <h3 style={{marginTop: 0}}>Kumaşı Düzenle</h3>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Kumaş Kodu</label>
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
            <label style={styles.label}>Kumaş Adı</label>
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
            <label style={styles.label}>Özellik</label>
            <input
              type="text"
              name="property"
              value={form.property}
              onChange={handleChange}
              style={styles.input}
            />
          </div>

          <div style={{display: 'flex', gap: '1rem'}}>
            <div style={{...styles.inputGroup, flex: 1}}>
              <label style={styles.label}>En (cm)</label>
              <input
                type="number"
                name="width"
                value={form.width}
                onChange={handleChange}
                style={styles.input}
                step="0.01"
              />
            </div>
            <div style={{...styles.inputGroup, flex: 1}}>
              <label style={styles.label}>Boy (cm)</label>
              <input
                type="number"
                name="length"
                value={form.length}
                onChange={handleChange}
                style={styles.input}
                step="0.01"
              />
            </div>
          </div>

          <div style={{display: 'flex', gap: '1rem'}}>
            <div style={{...styles.inputGroup, flex: 1}}>
              <label style={styles.label}>Depo</label>
              <input
                type="text"
                name="depot"
                value={form.depot}
                onChange={handleChange}
                style={styles.input}
              />
            </div>
            <div style={{...styles.inputGroup, flex: 1}}>
              <label style={styles.label}>Birim</label>
              <input
                type="text"
                name="unit"
                value={form.unit}
                onChange={handleChange}
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Stok Miktarı</label>
            <input
              type="number"
              name="stockQuantity"
              value={form.stockQuantity}
              onChange={handleChange}
              style={styles.input}
              step="0.01"
              required
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Kumaş Ortalama Gramajı (g/m²)</label>
            <input type="number" name="averageGrammage" value={form.averageGrammage} onChange={handleChange} style={styles.input} step="0.01" min="0" />
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

// Stiller
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
    gap: "1.2rem",
    width: "100%",
    maxWidth: "100%"
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
  inputWithButton: {
    display: "flex",
    gap: "0.5rem"
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
    maxWidth: "600px",
    maxHeight: "90vh",
    overflowY: "auto"
  }
};
