import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import axios from "axios";
import ExportButtons from "../../components/ExportButtons";

type Accessory = {
  id: number;
  code: string | null;
  name: string;
  unit: string;
  stockQuantity: number;
  warehouseId?: number | null;
  warehouse?: {
    id: number;
    code: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

type WarehouseOption = {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
};

type AccessoryFormState = {
  id: number | null;
  code: string;
  name: string;
  unit: string;
  warehouseId: string;
  stockQuantity: string;
};

const INITIAL_FORM: AccessoryFormState = {
  id: null,
  code: "",
  name: "",
  unit: "adet",
  warehouseId: "",
  stockQuantity: "0",
};

const compareByName = (a: Accessory, b: Accessory): number =>
  a.name.localeCompare(b.name, "tr", { sensitivity: "base" });

const toDisplayDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("tr-TR");
};

const parseApiError = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; error?: string } | undefined;
    return data?.message || data?.error || fallback;
  }
  return fallback;
};

export default function AccessoriesPage() {
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [form, setForm] = useState<AccessoryFormState>(INITIAL_FORM);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  const loadAccessories = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await axios.get<Accessory[]>("/api/accessories");
      const list = Array.isArray(response.data) ? response.data : [];
      setAccessories([...list].sort(compareByName));
    } catch (loadError: unknown) {
      console.error("Accessories load error:", loadError);
      setError(parseApiError(loadError, "Aksesuar listesi yuklenemedi."));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWarehouses = useCallback(async () => {
    try {
      const response = await axios.get<WarehouseOption[]>("/api/warehouses?withSummary=false", {
        headers:
          typeof window !== "undefined"
            ? (() => {
                const token = localStorage.getItem("token") || localStorage.getItem("authToken");
                return token ? { Authorization: `Bearer ${token}` } : undefined;
              })()
            : undefined,
      });
      const list = Array.isArray(response.data) ? response.data : [];
      setWarehouses(list.filter((warehouse) => warehouse.isActive));
    } catch (warehouseError) {
      console.error("Warehouse load error:", warehouseError);
    }
  }, []);

  useEffect(() => {
    void loadAccessories();
    void loadWarehouses();
  }, [loadAccessories, loadWarehouses]);

  const filteredAccessories = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLocaleLowerCase("tr");
    if (!normalizedTerm) return accessories;

    return accessories.filter((item) => {
      const searchable =
        `${item.code || ""} ${item.name} ${item.unit} ${item.warehouse?.code || ""} ${item.warehouse?.name || ""}`
          .toLocaleLowerCase("tr");
      return searchable.includes(normalizedTerm);
    });
  }, [accessories, searchTerm]);

  const exportRows = useMemo(
    () =>
      filteredAccessories.map((item) => ({
        Kod: item.code || "",
        Ad: item.name,
        Depo: item.warehouse ? `${item.warehouse.code} - ${item.warehouse.name}` : "",
        Birim: item.unit,
        "Stok Miktari": item.stockQuantity,
        "Olusturulma Tarihi": toDisplayDate(item.createdAt),
      })),
    [filteredAccessories]
  );

  const resetForm = () => {
    setForm(INITIAL_FORM);
  };

  const handleFormChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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

    const payload = {
      id: form.id,
      code: form.code.trim() || null,
      name: normalizedName,
      unit: normalizedUnit,
      warehouseId: form.warehouseId ? Number(form.warehouseId) : null,
      stockQuantity,
    };

    try {
      if (form.id) {
        const response = await axios.put<Accessory>("/api/accessories", payload);
        setAccessories((prev) => {
          const next = prev.map((item) => (item.id === response.data.id ? response.data : item));
          return next.sort(compareByName);
        });
        setMessage("Aksesuar guncellendi.");
      } else {
        const response = await axios.post<Accessory>("/api/accessories", payload);
        setAccessories((prev) => [...prev, response.data].sort(compareByName));
        setMessage("Aksesuar eklendi.");
      }

      resetForm();
    } catch (submitError: unknown) {
      console.error("Accessory save error:", submitError);
      setError(parseApiError(submitError, "Aksesuar kaydedilemedi."));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: Accessory) => {
    setError("");
    setMessage("");
    setForm({
      id: item.id,
      code: item.code || "",
      name: item.name,
      unit: item.unit,
      warehouseId: item.warehouse?.id ? String(item.warehouse.id) : "",
      stockQuantity: String(item.stockQuantity),
    });
  };

  const handleDelete = async (id: number) => {
    const confirmed = window.confirm("Bu aksesuari silmek istediginize emin misiniz?");
    if (!confirmed) return;

    setDeletingId(id);
    setError("");
    setMessage("");

    try {
      await axios.delete("/api/accessories", { data: { id } });
      setAccessories((prev) => prev.filter((item) => item.id !== id));
      if (form.id === id) {
        resetForm();
      }
      setMessage("Aksesuar silindi.");
    } catch (deleteError: unknown) {
      console.error("Accessory delete error:", deleteError);
      setError(parseApiError(deleteError, "Aksesuar silinemedi."));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Aksesuar Yonetimi</h1>
      <p style={styles.subtitle}>Aksesuar kartlarini ekleyin, duzenleyin ve stok miktarini takip edin.</p>

      {error ? <div style={{ ...styles.alert, ...styles.errorAlert }}>{error}</div> : null}
      {message ? <div style={{ ...styles.alert, ...styles.successAlert }}>{message}</div> : null}

      <div style={styles.toolbar}>
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Kod, ad veya birim ara..."
          style={styles.searchInput}
        />
        <button type="button" style={styles.secondaryButton} onClick={() => void loadAccessories()} disabled={loading}>
          Yenile
        </button>
        <ExportButtons data={exportRows} filename="Aksesuar_Listesi" disabled={filteredAccessories.length === 0} />
      </div>

      <div style={styles.grid}>
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>{form.id ? "Aksesuari Duzenle" : "Yeni Aksesuar Ekle"}</h2>
          <form onSubmit={handleSubmit} style={styles.form}>
            <label style={styles.label}>
              Kod
              <input
                type="text"
                name="code"
                value={form.code}
                onChange={handleFormChange}
                placeholder="Orn: AKS-001"
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Aksesuar Adi *
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleFormChange}
                placeholder="Orn: Metal Dugme 18mm"
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
                onChange={handleFormChange}
                list="accessory-unit-options"
                style={styles.input}
                required
              />
              <datalist id="accessory-unit-options">
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
                onChange={handleFormChange}
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
              Stok Miktari
              <input
                type="number"
                min="0"
                step="0.01"
                name="stockQuantity"
                value={form.stockQuantity}
                onChange={handleFormChange}
                style={styles.input}
              />
            </label>

            <div style={styles.formActions}>
              {form.id ? (
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={resetForm}
                  disabled={saving}
                >
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
          <h2 style={styles.cardTitle}>
            Aksesuar Listesi ({filteredAccessories.length})
          </h2>

          {loading ? (
            <div style={styles.loading}>Yukleniyor...</div>
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
                    <th style={styles.th}>Olusturma</th>
                    <th style={styles.th}>Islemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccessories.length > 0 ? (
                    filteredAccessories.map((item) => (
                      <tr key={item.id}>
                        <td style={styles.td}>{item.code || "-"}</td>
                        <td style={styles.td}>{item.name}</td>
                        <td style={styles.td}>
                          {item.warehouse ? `${item.warehouse.code} - ${item.warehouse.name}` : "-"}
                        </td>
                        <td style={styles.td}>{item.unit}</td>
                        <td style={styles.td}>{item.stockQuantity}</td>
                        <td style={styles.td}>{toDisplayDate(item.createdAt)}</td>
                        <td style={styles.td}>
                          <button type="button" style={styles.inlineButton} onClick={() => handleEdit(item)}>
                            Duzenle
                          </button>
                          <button
                            type="button"
                            style={{ ...styles.inlineButton, ...styles.dangerButton }}
                            onClick={() => void handleDelete(item.id)}
                            disabled={deletingId === item.id}
                          >
                            {deletingId === item.id ? "Siliniyor..." : "Sil"}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td style={styles.emptyCell} colSpan={7}>
                        Sonuc bulunamadi.
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
    backgroundColor: "#f3f6fb",
  },
  title: {
    margin: 0,
    fontSize: "28px",
    color: "#12263a",
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
  toolbar: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: "16px",
  },
  searchInput: {
    flex: 1,
    minWidth: "260px",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #c9d3e0",
    backgroundColor: "#fff",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 360px) minmax(0, 1fr)",
    gap: "16px",
    alignItems: "start",
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
    gap: "10px",
    justifyContent: "flex-end",
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
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "860px",
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
  emptyCell: {
    textAlign: "center",
    padding: "18px",
    color: "#6a7f96",
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
};
