import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
} from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type UnitType = "kg" | "m";

type LookupOption = {
  id: number;
  name: string;
};

type FabricOrderRow = {
  id: number;
  orderNumber: number;
  orderDate: string;
  supplierId: number;
  supplierName: string;
  fabricId: number;
  fabricName: string;
  colorId: number;
  colorName: string;
  patternId: number;
  patternName: string;
  quantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  unitType: UnitType;
  arrivalDate: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type FabricOrdersPageProps = {
  initialFabricType?: string;
  initialQuantity?: number;
  initialUnitType?: UnitType;
  autoOpenNewOrder?: boolean;
};

type FormState = {
  id?: number;
  orderNumber: number;
  orderDate: string;
  supplierId: string;
  fabricId: string;
  colorId: string;
  patternId: string;
  quantity: string;
  unitType: UnitType;
  arrivalDate: string;
  status: string;
  notes: string;
};

const STATUS_OPTIONS = ["Beklemede", "Onaylandi", "Iptal Edildi", "Tamamlandi"];

const todayISO = (): string => new Date().toISOString().slice(0, 10);

const normalizeUnitType = (value: string | undefined): UnitType =>
  value?.toLowerCase().startsWith("m") ? "m" : "kg";

const toIsoDate = (value: string | null | undefined): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const toDisplayDate = (value: string | null | undefined): string => {
  if (!value) return "-";
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

const mapLookupList = (raw: unknown): LookupOption[] => {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const casted = item as { id?: unknown; name?: unknown };
      const id = Number(casted.id);
      const name = String(casted.name || "").trim();
      if (!id || !name) return null;
      return { id, name };
    })
    .filter((item): item is LookupOption => Boolean(item))
    .sort((a, b) => a.name.localeCompare(b.name, "tr", { sensitivity: "base" }));
};

const findLookupIdByName = (items: LookupOption[], targetName: string): number | null => {
  const normalizedTarget = targetName.trim().toLocaleLowerCase("tr");
  if (!normalizedTarget) return null;

  const matched = items.find((item) => item.name.trim().toLocaleLowerCase("tr") === normalizedTarget);
  return matched?.id || null;
};

export default function FabricOrdersPage({
  initialFabricType = "",
  initialQuantity,
  initialUnitType = "kg",
  autoOpenNewOrder = false,
}: FabricOrdersPageProps) {
  const normalizedInitialFabricType = initialFabricType.trim();
  const normalizedInitialUnitType = normalizeUnitType(initialUnitType);
  const normalizedInitialQuantity =
    typeof initialQuantity === "number" && Number.isFinite(initialQuantity) ? String(initialQuantity) : "";

  const [orders, setOrders] = useState<FabricOrderRow[]>([]);
  const [suppliers, setSuppliers] = useState<LookupOption[]>([]);
  const [fabrics, setFabrics] = useState<LookupOption[]>([]);
  const [colors, setColors] = useState<LookupOption[]>([]);
  const [patterns, setPatterns] = useState<LookupOption[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [formError, setFormError] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [supplierFilter, setSupplierFilter] = useState<string>("");
  const [fabricFilter, setFabricFilter] = useState<string>(normalizedInitialFabricType);

  const [showForm, setShowForm] = useState<boolean>(false);
  const [autoOpenHandled, setAutoOpenHandled] = useState<boolean>(false);
  const [form, setForm] = useState<FormState>({
    orderNumber: 0,
    orderDate: todayISO(),
    supplierId: "",
    fabricId: "",
    colorId: "",
    patternId: "",
    quantity: "",
    unitType: "kg",
    arrivalDate: "",
    status: "Beklemede",
    notes: "",
  });

  const loadOrders = useCallback(async () => {
    const response = await axios.get<FabricOrderRow[]>("/api/accessory-orders");
    setOrders(Array.isArray(response.data) ? response.data : []);
  }, []);

  const loadReferenceData = useCallback(async () => {
    const [supplierRes, fabricRes, colorRes, patternRes] = await Promise.all([
      axios.get("/api/suppliers"),
      axios.get("/api/accessories"),
      axios.get("/api/colors"),
      axios.get("/api/fabric-patterns"),
    ]);

    setSuppliers(mapLookupList(supplierRes.data));
    setFabrics(mapLookupList(fabricRes.data));
    setColors(mapLookupList(colorRes.data));
    setPatterns(mapLookupList(patternRes.data));
  }, []);

  const loadPageData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      await Promise.all([loadOrders(), loadReferenceData()]);
    } catch (loadError: unknown) {
      console.error("Fabric orders page load error:", loadError);
      setError(parseApiError(loadError, "Aksesuar siparisi verileri alinamadi."));
    } finally {
      setLoading(false);
    }
  }, [loadOrders, loadReferenceData]);

  useEffect(() => {
    void loadPageData();
  }, [loadPageData]);

  const openNewOrderForm = useCallback(
    async (fromPlanning: boolean) => {
      setFormError("");

      try {
        const nextRes = await axios.get<{ nextOrderNumber: number }>("/api/accessory-orders/next-number");
        const nextOrderNumber = Number(nextRes.data?.nextOrderNumber || 1);

        const preferredFabricId = fromPlanning
          ? findLookupIdByName(fabrics, normalizedInitialFabricType)
          : null;

        setForm({
          orderNumber: nextOrderNumber,
          orderDate: todayISO(),
          supplierId: "",
          fabricId: preferredFabricId ? String(preferredFabricId) : "",
          colorId: "",
          patternId: "",
          quantity: fromPlanning ? normalizedInitialQuantity : "",
          unitType: fromPlanning ? normalizedInitialUnitType : "kg",
          arrivalDate: "",
          status: "Beklemede",
          notes: "",
        });

        setShowForm(true);
      } catch (openError: unknown) {
        console.error("Open new order form error:", openError);
        setFormError(parseApiError(openError, "Yeni siparis formu acilamadi."));
      }
    },
    [fabrics, normalizedInitialFabricType, normalizedInitialQuantity, normalizedInitialUnitType]
  );

  useEffect(() => {
    if (!autoOpenNewOrder || autoOpenHandled || loading) return;

    if (fabrics.length === 0 || colors.length === 0 || suppliers.length === 0 || patterns.length === 0) {
      return;
    }

    setAutoOpenHandled(true);
    void openNewOrderForm(true);
  }, [
    autoOpenHandled,
    autoOpenNewOrder,
    colors.length,
    fabrics.length,
    loading,
    openNewOrderForm,
    patterns.length,
    suppliers.length,
  ]);

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase("tr");

    return orders.filter((order) => {
      const searchable = [
        String(order.orderNumber),
        order.supplierName,
        order.fabricName,
        order.colorName,
        order.patternName,
        order.status,
      ]
        .join(" ")
        .toLocaleLowerCase("tr");

      if (term && !searchable.includes(term)) return false;
      if (statusFilter && order.status !== statusFilter) return false;
      if (supplierFilter && order.supplierName !== supplierFilter) return false;
      if (
        fabricFilter &&
        order.fabricName.localeCompare(fabricFilter, "tr", { sensitivity: "base" }) !== 0
      ) {
        return false;
      }

      return true;
    });
  }, [fabricFilter, orders, searchTerm, statusFilter, supplierFilter]);

  const exportRows = useMemo(
    () =>
      filteredOrders.map((order) => ({
        "Siparis No": order.orderNumber,
        "Siparis Tarihi": toDisplayDate(order.orderDate),
        Tedarikci: order.supplierName,
        Aksesuar: order.fabricName,
        Renk: order.colorName,
        Desen: order.patternName,
        Miktar: order.quantity,
        Gelen: order.receivedQuantity,
        Kalan: order.remainingQuantity,
        Birim: order.unitType,
        "Gelis Tarihi": toDisplayDate(order.arrivalDate),
        Durum: order.status,
      })),
    [filteredOrders]
  );

  const handleExcelExport = () => {
    if (exportRows.length === 0) {
      alert("Disari aktarilacak veri bulunamadi.");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Aksesuar Siparisleri");
    XLSX.writeFile(wb, `Aksesuar_siparisleri_${todayISO()}.xlsx`);
  };

  const handlePdfExport = () => {
    if (exportRows.length === 0) {
      alert("Disari aktarilacak veri bulunamadi.");
      return;
    }

    const doc = new jsPDF();
    const headers = [[
      "Siparis No",
      "Siparis Tarihi",
      "Tedarikci",
      "Aksesuar",
      "Renk",
      "Desen",
      "Miktar",
      "Gelen",
      "Kalan",
      "Birim",
      "Gelis Tarihi",
      "Durum",
    ]];
    const body = filteredOrders.map((order) => [
      String(order.orderNumber),
      toDisplayDate(order.orderDate),
      order.supplierName,
      order.fabricName,
      order.colorName,
      order.patternName,
      String(order.quantity),
      String(order.receivedQuantity),
      String(order.remainingQuantity),
      order.unitType,
      toDisplayDate(order.arrivalDate),
      order.status,
    ]);

    autoTable(doc, {
      head: headers,
      body,
      startY: 20,
      theme: "grid",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
    });

    doc.save(`Aksesuar_siparisleri_${todayISO()}.pdf`);
  };

  const handleEditOrder = (order: FabricOrderRow) => {
    setFormError("");
    setForm({
      id: order.id,
      orderNumber: order.orderNumber,
      orderDate: toIsoDate(order.orderDate) || todayISO(),
      supplierId: String(order.supplierId),
      fabricId: String(order.fabricId),
      colorId: String(order.colorId),
      patternId: String(order.patternId),
      quantity: String(order.quantity),
      unitType: normalizeUnitType(order.unitType),
      arrivalDate: toIsoDate(order.arrivalDate),
      status: order.status,
      notes: order.notes || "",
    });
    setShowForm(true);
  };

  const handleDeleteOrder = async (id: number) => {
    if (!confirm("Bu siparisi silmek istediginize emin misiniz?")) {
      return;
    }

    try {
      await axios.delete("/api/accessory-orders", { data: { id } });
      setOrders((prev) => prev.filter((order) => order.id !== id));
    } catch (deleteError: unknown) {
      console.error("Delete fabric order error:", deleteError);
      alert(parseApiError(deleteError, "Siparis silinemedi."));
    }
  };

  const handleFormChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");

    const payload = {
      id: form.id,
      orderDate: form.orderDate,
      supplierId: Number(form.supplierId),
      fabricId: Number(form.fabricId),
      colorId: Number(form.colorId),
      patternId: Number(form.patternId),
      quantity: Number(form.quantity),
      unitType: form.unitType,
      arrivalDate: form.arrivalDate || null,
      status: form.status,
      notes: form.notes.trim() || null,
    };

    if (
      !payload.supplierId ||
      !payload.fabricId ||
      !payload.colorId ||
      !payload.patternId ||
      !Number.isFinite(payload.quantity) ||
      payload.quantity <= 0
    ) {
      setSaving(false);
      setFormError("Tedarikci, Aksesuar, renk, desen ve pozitif miktar zorunludur.");
      return;
    }

    try {
      if (form.id) {
        await axios.put("/api/accessory-orders", payload);
      } else {
        await axios.post("/api/accessory-orders", payload);
      }

      await loadOrders();
      setShowForm(false);
    } catch (submitError: unknown) {
      console.error("Save fabric order error:", submitError);
      setFormError(parseApiError(submitError, "Siparis kaydedilemedi."));
    } finally {
      setSaving(false);
    }
  };

  const uniqueSupplierNames = useMemo(
    () => [...new Set(orders.map((item) => item.supplierName))].sort((a, b) => a.localeCompare(b, "tr")),
    [orders]
  );

  const uniqueFabricNames = useMemo(
    () => [...new Set(orders.map((item) => item.fabricName))].sort((a, b) => a.localeCompare(b, "tr")),
    [orders]
  );

  const hasMissingMasterData =
    suppliers.length === 0 || fabrics.length === 0 || colors.length === 0 || patterns.length === 0;

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Aksesuar Siparisleri</h1>

      {normalizedInitialFabricType ? (
        <div style={styles.infoBox}>Planlamadan gelen Aksesuar filtresi uygulandi: {normalizedInitialFabricType}</div>
      ) : null}

      {error ? <div style={styles.errorBox}>{error}</div> : null}
      {hasMissingMasterData ? (
        <div style={styles.warningBox}>
          Tedarikci, Aksesuar, renk veya desen kartlari eksik. Siparis olusturmadan once tum kartlarin tanimli oldugunu kontrol edin.
        </div>
      ) : null}

      <div style={styles.toolbar}>
        <input
          type="text"
          placeholder="Siparis no, tedarikci, Aksesuar, renk, desen ara..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          style={{ ...styles.input, flex: 1, minWidth: "260px" }}
        />

        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={styles.select}>
          <option value="">Tum Durumlar</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        <select value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)} style={styles.select}>
          <option value="">Tum Tedarikciler</option>
          {uniqueSupplierNames.map((supplier) => (
            <option key={supplier} value={supplier}>
              {supplier}
            </option>
          ))}
        </select>

        <select value={fabricFilter} onChange={(event) => setFabricFilter(event.target.value)} style={styles.select}>
          <option value="">Tum Aksesuarlar</option>
          {uniqueFabricNames.map((fabricName) => (
            <option key={fabricName} value={fabricName}>
              {fabricName}
            </option>
          ))}
        </select>

        <button type="button" style={styles.button} onClick={() => void openNewOrderForm(false)}>
          Yeni Siparis
        </button>
        <button type="button" style={styles.secondaryButton} onClick={handleExcelExport}>
          Excel
        </button>
        <button type="button" style={styles.secondaryButton} onClick={handlePdfExport}>
          PDF
        </button>
      </div>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Siparis No</th>
              <th style={styles.th}>Siparis Tarihi</th>
              <th style={styles.th}>Tedarikci</th>
              <th style={styles.th}>Aksesuar</th>
              <th style={styles.th}>Renk</th>
              <th style={styles.th}>Desen</th>
              <th style={styles.th}>Miktar</th>
              <th style={styles.th}>Gelen</th>
              <th style={styles.th}>Kalan</th>
              <th style={styles.th}>Birim</th>
              <th style={styles.th}>Gelis Tarihi</th>
              <th style={styles.th}>Durum</th>
              <th style={styles.th}>Islem</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td style={styles.td} colSpan={13}>
                  Yukleniyor...
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td style={styles.td} colSpan={13}>
                  Kayit bulunamadi.
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr key={order.id}>
                  <td style={styles.td}>{order.orderNumber}</td>
                  <td style={styles.td}>{toDisplayDate(order.orderDate)}</td>
                  <td style={styles.td}>{order.supplierName}</td>
                  <td style={styles.td}>{order.fabricName}</td>
                  <td style={styles.td}>{order.colorName}</td>
                  <td style={styles.td}>{order.patternName}</td>
                  <td style={styles.td}>{order.quantity}</td>
                  <td style={styles.td}>{order.receivedQuantity}</td>
                  <td style={styles.td}>{order.remainingQuantity}</td>
                  <td style={styles.td}>{order.unitType}</td>
                  <td style={styles.td}>{toDisplayDate(order.arrivalDate)}</td>
                  <td style={styles.td}>{order.status}</td>
                  <td style={styles.td}>
                    <div style={styles.actionRow}>
                      <button type="button" style={styles.linkButton} onClick={() => handleEditOrder(order)}>
                        Duzenle
                      </button>
                      <button type="button" style={styles.linkButtonDanger} onClick={() => void handleDeleteOrder(order.id)}>
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm ? (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{form.id ? "Siparis Duzenle" : "Yeni Siparis"}</h2>
              <button type="button" style={styles.modalCloseButton} onClick={() => setShowForm(false)}>
                Kapat
              </button>
            </div>

            {formError ? <div style={styles.errorBox}>{formError}</div> : null}

            <form onSubmit={handleSubmit} style={styles.formGrid}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Siparis No</label>
                <input type="text" value={String(form.orderNumber || "")} readOnly style={styles.input} />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Siparis Tarihi</label>
                <input
                  type="date"
                  name="orderDate"
                  value={form.orderDate}
                  onChange={handleFormChange}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Tedarikci</label>
                <select
                  name="supplierId"
                  value={form.supplierId}
                  onChange={handleFormChange}
                  style={styles.select}
                  required
                >
                  <option value="">Seciniz</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Aksesuar</label>
                <select
                  name="fabricId"
                  value={form.fabricId}
                  onChange={handleFormChange}
                  style={styles.select}
                  required
                >
                  <option value="">Seciniz</option>
                  {fabrics.map((fabric) => (
                    <option key={fabric.id} value={fabric.id}>
                      {fabric.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Renk</label>
                <select name="colorId" value={form.colorId} onChange={handleFormChange} style={styles.select} required>
                  <option value="">Seciniz</option>
                  {colors.map((color) => (
                    <option key={color.id} value={color.id}>
                      {color.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Desen</label>
                <select
                  name="patternId"
                  value={form.patternId}
                  onChange={handleFormChange}
                  style={styles.select}
                  required
                >
                  <option value="">Seciniz</option>
                  {patterns.map((pattern) => (
                    <option key={pattern.id} value={pattern.id}>
                      {pattern.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Miktar</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  name="quantity"
                  value={form.quantity}
                  onChange={handleFormChange}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Birim</label>
                <select name="unitType" value={form.unitType} onChange={handleFormChange} style={styles.select} required>
                  <option value="kg">kg</option>
                  <option value="m">m</option>
                </select>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Gelis Tarihi</label>
                <input
                  type="date"
                  name="arrivalDate"
                  value={form.arrivalDate}
                  onChange={handleFormChange}
                  style={styles.input}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Durum</label>
                <select name="status" value={form.status} onChange={handleFormChange} style={styles.select} required>
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ ...styles.fieldGroup, gridColumn: "1 / -1" }}>
                <label style={styles.label}>Not</label>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleFormChange}
                  style={styles.textarea}
                  rows={3}
                />
              </div>

              <div style={styles.modalFooter}>
                <button type="button" style={styles.secondaryButton} onClick={() => setShowForm(false)}>
                  Iptal
                </button>
                <button type="submit" style={styles.button} disabled={saving}>
                  {saving ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    width: "100%",
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  title: {
    margin: 0,
    color: "var(--fs-color-text)",
    fontSize: "1.5rem",
    fontWeight: 700,
  },
  infoBox: {
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1e3a8a",
    borderRadius: "10px",
    padding: "0.65rem 0.8rem",
    fontSize: "0.88rem",
    fontWeight: 600,
  },
  warningBox: {
    background: "#fff7ed",
    border: "1px solid #fdba74",
    color: "#9a3412",
    borderRadius: "10px",
    padding: "0.65rem 0.8rem",
    fontSize: "0.86rem",
  },
  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fca5a5",
    color: "#b91c1c",
    borderRadius: "10px",
    padding: "0.65rem 0.8rem",
    fontSize: "0.86rem",
  },
  toolbar: {
    display: "flex",
    gap: "0.6rem",
    flexWrap: "wrap",
    alignItems: "center",
  },
  input: {
    minHeight: "38px",
    padding: "0.55rem 0.65rem",
    border: "1px solid var(--fs-color-border-strong)",
    borderRadius: "8px",
    background: "var(--fs-color-surface-soft)",
    color: "var(--fs-color-text)",
    fontSize: "0.9rem",
  },
  select: {
    minHeight: "38px",
    padding: "0.55rem 0.65rem",
    border: "1px solid var(--fs-color-border-strong)",
    borderRadius: "8px",
    background: "var(--fs-color-surface-soft)",
    color: "var(--fs-color-text)",
    fontSize: "0.9rem",
    minWidth: "150px",
  },
  textarea: {
    width: "100%",
    border: "1px solid var(--fs-color-border-strong)",
    borderRadius: "8px",
    padding: "0.55rem 0.65rem",
    background: "var(--fs-color-surface-soft)",
    color: "var(--fs-color-text)",
    fontSize: "0.9rem",
    resize: "vertical",
  },
  button: {
    minHeight: "38px",
    padding: "0 0.95rem",
    border: "1px solid var(--fs-color-primary-strong)",
    borderRadius: "8px",
    background: "var(--fs-color-primary)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "0.88rem",
  },
  secondaryButton: {
    minHeight: "38px",
    padding: "0 0.95rem",
    border: "1px solid var(--fs-color-border-strong)",
    borderRadius: "8px",
    background: "var(--fs-color-surface-soft)",
    color: "var(--fs-color-text)",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.88rem",
  },
  tableWrapper: {
    border: "1px solid var(--fs-color-border)",
    borderRadius: "10px",
    background: "var(--fs-color-surface)",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    minWidth: "1200px",
    borderCollapse: "collapse",
  },
  th: {
    borderBottom: "1px solid var(--fs-color-border)",
    padding: "0.65rem",
    textAlign: "left",
    fontSize: "0.8rem",
    color: "var(--fs-color-text-muted)",
    background: "var(--fs-color-surface-soft)",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  td: {
    borderTop: "1px solid var(--fs-color-border)",
    padding: "0.65rem",
    fontSize: "0.88rem",
    color: "var(--fs-color-text)",
    whiteSpace: "nowrap",
  },
  actionRow: {
    display: "flex",
    gap: "0.5rem",
  },
  linkButton: {
    border: "none",
    background: "transparent",
    color: "#1d4ed8",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.82rem",
    padding: 0,
  },
  linkButtonDanger: {
    border: "none",
    background: "transparent",
    color: "#b91c1c",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.82rem",
    padding: 0,
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.45)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "1rem",
    zIndex: 60,
  },
  modalCard: {
    width: "100%",
    maxWidth: "880px",
    maxHeight: "90vh",
    overflowY: "auto",
    border: "1px solid var(--fs-color-border)",
    borderRadius: "14px",
    background: "var(--fs-color-surface)",
    boxShadow: "0 20px 45px -28px rgba(15, 23, 42, 0.45)",
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.8rem",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    margin: 0,
    color: "var(--fs-color-text)",
    fontSize: "1.2rem",
    fontWeight: 700,
  },
  modalCloseButton: {
    border: "1px solid var(--fs-color-border-strong)",
    borderRadius: "8px",
    background: "var(--fs-color-surface-soft)",
    color: "var(--fs-color-text)",
    padding: "0.4rem 0.65rem",
    cursor: "pointer",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "0.75rem",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
  },
  label: {
    fontSize: "0.82rem",
    color: "var(--fs-color-text-muted)",
    fontWeight: 600,
  },
  modalFooter: {
    gridColumn: "1 / -1",
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.6rem",
    marginTop: "0.3rem",
  },
};

