import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ChangeEvent, type FormEvent } from "react";
import axios from "axios";

type Warehouse = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    fabrics: number;
    accessories: number;
    products: number;
  };
  fabricStockTotal?: number;
  accessoryStockTotal?: number;
};

type WarehouseFormState = {
  id: number | null;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
};

const INITIAL_FORM: WarehouseFormState = {
  id: null,
  code: "",
  name: "",
  description: "",
  isActive: true,
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

const formatNumber = (value: number): string =>
  new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(value || 0);

export default function WarehouseSettingsPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [form, setForm] = useState<WarehouseFormState>(INITIAL_FORM);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  const loadWarehouses = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await axios.get<Warehouse[]>("/api/warehouses", {
        headers: getAuthHeaders(),
      });
      const list = Array.isArray(response.data) ? response.data : [];
      setWarehouses(
        [...list].sort((a, b) => {
          if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
          return a.code.localeCompare(b.code, "tr", { sensitivity: "base" });
        })
      );
    } catch (loadError: unknown) {
      console.error("Warehouse load error:", loadError);
      setError(parseApiError(loadError, "Depolar yuklenemedi."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWarehouses();
  }, [loadWarehouses]);

  const totalFabricStock = useMemo(
    () => warehouses.reduce((sum, warehouse) => sum + (Number(warehouse.fabricStockTotal) || 0), 0),
    [warehouses]
  );

  const totalAccessoryStock = useMemo(
    () => warehouses.reduce((sum, warehouse) => sum + (Number(warehouse.accessoryStockTotal) || 0), 0),
    [warehouses]
  );

  const totalProducts = useMemo(
    () => warehouses.reduce((sum, warehouse) => sum + (warehouse._count?.products || 0), 0),
    [warehouses]
  );

  const resetForm = () => {
    setForm(INITIAL_FORM);
  };

  const handleInputChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    const code = form.code.trim().toUpperCase();
    const name = form.name.trim();

    if (!code || !name) {
      setSaving(false);
      setError("Depo kodu ve depo adi zorunludur.");
      return;
    }

    try {
      const payload = {
        id: form.id,
        code,
        name,
        description: form.description.trim() || null,
        isActive: form.isActive,
      };

      if (form.id) {
        await axios.put("/api/warehouses", payload, {
          headers: getAuthHeaders(),
        });
        setMessage("Depo guncellendi.");
      } else {
        await axios.post("/api/warehouses", payload, {
          headers: getAuthHeaders(),
        });
        setMessage("Depo eklendi.");
      }

      resetForm();
      await loadWarehouses();
    } catch (submitError: unknown) {
      console.error("Warehouse save error:", submitError);
      setError(parseApiError(submitError, "Depo kaydedilemedi."));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (warehouse: Warehouse) => {
    setError("");
    setMessage("");
    setForm({
      id: warehouse.id,
      code: warehouse.code,
      name: warehouse.name,
      description: warehouse.description || "",
      isActive: warehouse.isActive,
    });
  };

  const handleDelete = async (id: number) => {
    const confirmed = window.confirm("Bu depoyu silmek istediginize emin misiniz?");
    if (!confirmed) return;

    setDeletingId(id);
    setError("");
    setMessage("");

    try {
      await axios.delete("/api/warehouses", {
        headers: getAuthHeaders(),
        data: { id },
      });
      if (form.id === id) resetForm();
      setMessage("Depo silindi.");
      await loadWarehouses();
    } catch (deleteError: unknown) {
      console.error("Warehouse delete error:", deleteError);
      setError(parseApiError(deleteError, "Depo silinemedi."));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Depo Yonetimi</h1>
      <p style={styles.subtitle}>Depolari tanimlayin ve stoklarin hangi depoda oldugunu merkezi olarak yonetin.</p>

      {error ? <div style={{ ...styles.alert, ...styles.errorAlert }}>{error}</div> : null}
      {message ? <div style={{ ...styles.alert, ...styles.successAlert }}>{message}</div> : null}

      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Toplam Depo</span>
          <strong style={styles.summaryValue}>{warehouses.length}</strong>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Kumas Stok Toplami</span>
          <strong style={styles.summaryValue}>{formatNumber(totalFabricStock)}</strong>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Aksesuar Stok Toplami</span>
          <strong style={styles.summaryValue}>{formatNumber(totalAccessoryStock)}</strong>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Depoya Bagli Urun</span>
          <strong style={styles.summaryValue}>{formatNumber(totalProducts)}</strong>
        </div>
      </div>

      <div style={styles.layoutGrid}>
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>{form.id ? "Depo Duzenle" : "Yeni Depo Ekle"}</h2>
          <form onSubmit={handleSubmit} style={styles.form}>
            <label style={styles.label}>
              Depo Kod *
              <input
                type="text"
                name="code"
                value={form.code}
                onChange={handleInputChange}
                placeholder="Orn: MD"
                maxLength={20}
                style={styles.input}
                required
              />
            </label>

            <label style={styles.label}>
              Depo Adi *
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleInputChange}
                placeholder="Orn: Mamul Depo"
                style={styles.input}
                required
              />
            </label>

            <label style={styles.label}>
              Aciklama
              <textarea
                name="description"
                value={form.description}
                onChange={handleInputChange}
                rows={3}
                placeholder="Depo ile ilgili not"
                style={{ ...styles.input, resize: "vertical" }}
              />
            </label>

            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
              />
              Aktif depo
            </label>

            <div style={styles.formActions}>
              {form.id ? (
                <button type="button" style={styles.secondaryButton} onClick={resetForm} disabled={saving}>
                  Iptal
                </button>
              ) : null}
              <button type="submit" style={styles.primaryButton} disabled={saving}>
                {saving ? "Kaydediliyor..." : form.id ? "Guncelle" : "Kaydet"}
              </button>
            </div>
          </form>
        </section>

        <section style={styles.card}>
          <div style={styles.listHeader}>
            <h2 style={styles.cardTitle}>Depo Listesi ({warehouses.length})</h2>
            <button type="button" style={styles.secondaryButton} onClick={() => void loadWarehouses()} disabled={loading}>
              Yenile
            </button>
          </div>

          {loading ? (
            <div style={styles.loading}>Yukleniyor...</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Kod</th>
                    <th style={styles.th}>Depo</th>
                    <th style={styles.th}>Durum</th>
                    <th style={styles.th}>Kumas Kalemi</th>
                    <th style={styles.th}>Kumas Stok</th>
                    <th style={styles.th}>Aksesuar Kalemi</th>
                    <th style={styles.th}>Aksesuar Stok</th>
                    <th style={styles.th}>Urun Adedi</th>
                    <th style={styles.th}>Islemler</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouses.length > 0 ? (
                    warehouses.map((warehouse) => (
                      <tr key={warehouse.id}>
                        <td style={styles.td}>{warehouse.code}</td>
                        <td style={styles.td}>
                          <div>{warehouse.name}</div>
                          <div style={styles.subText}>{warehouse.description || "-"}</div>
                        </td>
                        <td style={styles.td}>{warehouse.isActive ? "Aktif" : "Pasif"}</td>
                        <td style={styles.td}>{warehouse._count?.fabrics || 0}</td>
                        <td style={styles.td}>{formatNumber(Number(warehouse.fabricStockTotal) || 0)}</td>
                        <td style={styles.td}>{warehouse._count?.accessories || 0}</td>
                        <td style={styles.td}>{formatNumber(Number(warehouse.accessoryStockTotal) || 0)}</td>
                        <td style={styles.td}>{warehouse._count?.products || 0}</td>
                        <td style={styles.td}>
                          <button type="button" style={styles.inlineButton} onClick={() => handleEdit(warehouse)}>
                            Duzenle
                          </button>
                          <button
                            type="button"
                            style={{ ...styles.inlineButton, ...styles.dangerButton }}
                            onClick={() => void handleDelete(warehouse.id)}
                            disabled={deletingId === warehouse.id}
                          >
                            {deletingId === warehouse.id ? "Siliniyor..." : "Sil"}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td style={styles.emptyCell} colSpan={9}>
                        Henuz depo tanimi yok.
                      </td>
                    </tr>
                  )}
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
    backgroundColor: "#f4f7fb",
  },
  title: {
    margin: 0,
    fontSize: "28px",
    color: "#102a43",
  },
  subtitle: {
    marginTop: "8px",
    marginBottom: "16px",
    color: "#486581",
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
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "12px",
    marginBottom: "16px",
  },
  summaryCard: {
    border: "1px solid #d9e2ec",
    borderRadius: "12px",
    backgroundColor: "#fff",
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  summaryLabel: {
    color: "#627d98",
    fontSize: "12px",
  },
  summaryValue: {
    color: "#102a43",
    fontSize: "20px",
  },
  layoutGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(300px, 360px) minmax(0, 1fr)",
    gap: "16px",
    alignItems: "start",
  },
  card: {
    border: "1px solid #d9e2ec",
    borderRadius: "12px",
    backgroundColor: "#fff",
    padding: "16px",
    boxShadow: "0 2px 8px rgba(16, 42, 67, 0.06)",
  },
  cardTitle: {
    margin: "0 0 12px",
    color: "#1f3a56",
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
    fontSize: "14px",
    color: "#1f2f44",
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
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "2px",
    color: "#243b53",
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
    backgroundColor: "#0056b8",
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
  listHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "6px",
  },
  loading: {
    color: "#55697f",
    padding: "12px 0",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    minWidth: "980px",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    borderBottom: "1px solid #d9e2ec",
    padding: "10px",
    color: "#324b66",
    backgroundColor: "#f7f9fc",
    fontSize: "13px",
    whiteSpace: "nowrap",
  },
  td: {
    borderBottom: "1px solid #eef2f7",
    padding: "10px",
    color: "#24364d",
    fontSize: "14px",
    verticalAlign: "top",
  },
  subText: {
    marginTop: "3px",
    fontSize: "12px",
    color: "#627d98",
  },
  inlineButton: {
    padding: "6px 10px",
    borderRadius: "6px",
    border: "1px solid #ccd6e3",
    backgroundColor: "#fff",
    color: "#1f2f44",
    cursor: "pointer",
    marginRight: "6px",
    marginBottom: "6px",
  },
  dangerButton: {
    borderColor: "#f0b7b7",
    color: "#8f1d1d",
    backgroundColor: "#fff6f6",
  },
  emptyCell: {
    textAlign: "center",
    padding: "18px",
    color: "#6a7f96",
  },
};
