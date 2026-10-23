import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import axios from "axios";

type Accessory = {
  id: number;
  code: string | null;
  name: string;
  unit: string;
  stockQuantity: number;
  warehouse?: {
    id: number;
    code: string;
    name: string;
  } | null;
  createdAt: string;
};

type WarehouseOption = {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
};

type FormState = {
  code: string;
  name: string;
  unit: string;
  warehouseId: string;
  stockQuantity: string;
};

const INITIAL_FORM: FormState = {
  code: "",
  name: "",
  unit: "adet",
  warehouseId: "",
  stockQuantity: "0",
};

const getAuthHeaders = (): { Authorization: string } | undefined => {
  if (typeof window === "undefined") return undefined;
  const token = localStorage.getItem("token") || localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};

const parseApiError = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; error?: string } | undefined;
    return data?.message || data?.error || fallback;
  }
  return fallback;
};

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("tr-TR");
};

export default function AccessoryAddPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [recentAccessories, setRecentAccessories] = useState<Accessory[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [loadingRecent, setLoadingRecent] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  const loadRecentAccessories = useCallback(async () => {
    setLoadingRecent(true);
    setError("");

    try {
      const response = await axios.get<Accessory[]>("/api/accessories");
      const list = Array.isArray(response.data) ? response.data : [];
      const sorted = [...list].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setRecentAccessories(sorted.slice(0, 10));
    } catch (loadError: unknown) {
      console.error("Accessory add page load error:", loadError);
      setError(parseApiError(loadError, "Son eklenen aksesuarlar yuklenemedi."));
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  const loadWarehouses = useCallback(async () => {
    try {
      const response = await axios.get<WarehouseOption[]>("/api/warehouses?withSummary=false", {
        headers: getAuthHeaders(),
      });
      const list = Array.isArray(response.data) ? response.data : [];
      setWarehouses(list.filter((warehouse) => warehouse.isActive));
    } catch (warehouseError) {
      console.error("Warehouse list load error:", warehouseError);
    }
  }, []);

  useEffect(() => {
    void loadRecentAccessories();
    void loadWarehouses();
  }, [loadRecentAccessories, loadWarehouses]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    const normalizedName = form.name.trim();
    const normalizedUnit = form.unit.trim().toLowerCase();
    const stockQuantity = Number(form.stockQuantity);

    if (!normalizedName || !normalizedUnit) {
      setSaving(false);
      setError("Aksesuar adi ve birim zorunludur.");
      return;
    }

    if (!Number.isFinite(stockQuantity) || stockQuantity < 0) {
      setSaving(false);
      setError("Stok miktari 0 veya daha buyuk bir sayi olmali.");
      return;
    }

    try {
      const payload = {
        code: form.code.trim() || null,
        name: normalizedName,
        unit: normalizedUnit,
        warehouseId: form.warehouseId ? Number(form.warehouseId) : null,
        stockQuantity,
      };

      const response = await axios.post<Accessory>("/api/accessories", payload);

      setRecentAccessories((prev) => [response.data, ...prev].slice(0, 10));
      setMessage("Aksesuar basariyla eklendi.");
      resetForm();
    } catch (submitError: unknown) {
      console.error("Accessory add submit error:", submitError);
      setError(parseApiError(submitError, "Aksesuar kaydedilemedi."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Aksesuar Ekle</h1>
        <Link href="/accessories" style={styles.link}>
          Aksesuar listesine git
        </Link>
      </div>

      <p style={styles.subtitle}>Hizli aksesuar karti olusturmak icin bu formu kullanabilirsiniz.</p>

      {error ? <div style={{ ...styles.alert, ...styles.errorAlert }}>{error}</div> : null}
      {message ? <div style={{ ...styles.alert, ...styles.successAlert }}>{message}</div> : null}

      <div style={styles.layout}>
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Yeni Kayit</h2>

          <form onSubmit={handleSubmit} style={styles.form}>
            <label style={styles.label}>
              Kod
              <input
                type="text"
                name="code"
                value={form.code}
                onChange={handleInputChange}
                placeholder="Orn: AKS-1001"
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Aksesuar Adi *
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleInputChange}
                placeholder="Orn: Fermuar 20 cm"
                style={styles.input}
                required
              />
            </label>

            <label style={styles.label}>
              Birim *
              <input
                type="text"
                name="unit"
                value={form.unit}
                onChange={handleInputChange}
                list="add-accessory-unit-options"
                style={styles.input}
                required
              />
              <datalist id="add-accessory-unit-options">
                <option value="adet" />
                <option value="m" />
                <option value="kg" />
                <option value="kutu" />
                <option value="paket" />
              </datalist>
            </label>

            <label style={styles.label}>
              Depo
              <select
                name="warehouseId"
                value={form.warehouseId}
                onChange={handleInputChange}
                style={styles.input}
              >
                <option value="">Depo seciniz</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} - {warehouse.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.label}>
              Baslangic Stok Miktari
              <input
                type="number"
                min="0"
                step="0.01"
                name="stockQuantity"
                value={form.stockQuantity}
                onChange={handleInputChange}
                style={styles.input}
              />
            </label>

            <div style={styles.formActions}>
              <button type="button" style={styles.secondaryButton} onClick={resetForm} disabled={saving}>
                Temizle
              </button>
              <button type="submit" style={styles.primaryButton} disabled={saving}>
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </form>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Son Eklenen 10 Aksesuar</h2>

          {loadingRecent ? (
            <div style={styles.loading}>Yukleniyor...</div>
          ) : recentAccessories.length === 0 ? (
            <div style={styles.empty}>Henuz kayit bulunmuyor.</div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Kod</th>
                    <th style={styles.th}>Ad</th>
                    <th style={styles.th}>Depo</th>
                    <th style={styles.th}>Birim</th>
                    <th style={styles.th}>Stok</th>
                    <th style={styles.th}>Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAccessories.map((item) => (
                    <tr key={item.id}>
                      <td style={styles.td}>{item.code || "-"}</td>
                      <td style={styles.td}>{item.name}</td>
                      <td style={styles.td}>
                        {item.warehouse ? `${item.warehouse.code} - ${item.warehouse.name}` : "-"}
                      </td>
                      <td style={styles.td}>{item.unit}</td>
                      <td style={styles.td}>{item.stockQuantity}</td>
                      <td style={styles.td}>{formatDate(item.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "24px",
    backgroundColor: "#f3f6fb",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    color: "#12263a",
    fontSize: "28px",
  },
  link: {
    color: "#0065d0",
    textDecoration: "none",
    fontWeight: 600,
  },
  subtitle: {
    marginTop: "6px",
    marginBottom: "16px",
    color: "#44566c",
  },
  alert: {
    marginBottom: "14px",
    padding: "10px 12px",
    borderRadius: "8px",
    fontSize: "14px",
    border: "1px solid transparent",
  },
  errorAlert: {
    backgroundColor: "#fff1f0",
    color: "#8f1d1d",
    borderColor: "#ffc5c2",
  },
  successAlert: {
    backgroundColor: "#edf9f0",
    color: "#1d6f42",
    borderColor: "#bfe8cd",
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 420px) minmax(0, 1fr)",
    gap: "16px",
  },
  card: {
    backgroundColor: "#fff",
    border: "1px solid #d9e1ec",
    borderRadius: "12px",
    padding: "16px",
    boxShadow: "0 2px 8px rgba(18, 38, 58, 0.06)",
  },
  cardTitle: {
    margin: "0 0 12px",
    color: "#1b3954",
    fontSize: "18px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    color: "#1f2f44",
    fontSize: "14px",
    fontWeight: 600,
  },
  input: {
    width: "100%",
    padding: "9px 10px",
    borderRadius: "8px",
    border: "1px solid #c9d3e0",
    backgroundColor: "#fff",
    fontSize: "14px",
  },
  formActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "4px",
  },
  primaryButton: {
    padding: "9px 14px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#0065d0",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "9px 14px",
    borderRadius: "8px",
    border: "1px solid #c9d3e0",
    backgroundColor: "#fff",
    color: "#1f2f44",
    fontWeight: 600,
    cursor: "pointer",
  },
  loading: {
    color: "#55697f",
    padding: "12px 0",
  },
  empty: {
    color: "#6a7f96",
    padding: "8px 0",
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "760px",
  },
  th: {
    textAlign: "left",
    borderBottom: "1px solid #d9e1ec",
    padding: "10px",
    color: "#324b66",
    backgroundColor: "#f7f9fc",
    fontSize: "13px",
  },
  td: {
    borderBottom: "1px solid #eef2f7",
    padding: "10px",
    color: "#24364d",
    fontSize: "14px",
    verticalAlign: "top",
  },
};
