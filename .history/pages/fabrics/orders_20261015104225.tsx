import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { notifyError } from "../../hooks/useToast";

/* ------------------------------------------------------------------ */
/*  Tipler (mantık değişmedi)                                          */
/* ------------------------------------------------------------------ */

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
  patternId: number | null;
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

/* Değerler API ile birebir aynı kalır; yalnızca görünen etiket Türkçe karakterli. */
const STATUS_OPTIONS = ["Beklemede", "Onaylandi", "Iptal Edildi", "Tamamlandi"];

const STATUS_META: Record<string, { label: string; tone: string }> = {
  Beklemede: { label: "Beklemede", tone: "wait" },
  Onaylandi: { label: "Onaylandı", tone: "ok" },
  "Iptal Edildi": { label: "İptal edildi", tone: "cancel" },
  Tamamlandi: { label: "Tamamlandı", tone: "done" },
};

const statusLabel = (value: string): string => STATUS_META[value]?.label ?? value;
const statusTone = (value: string): string => STATUS_META[value]?.tone ?? "wait";

/* ------------------------------------------------------------------ */
/*  Yardımcılar (mantık değişmedi)                                     */
/* ------------------------------------------------------------------ */

const todayISO = (): string => new Date().toISOString().slice(0, 10);

const normalizeUnitType = (value: string | undefined): UnitType =>
  value?.toLowerCase().startsWith("m") ? "m" : "kg";

const normalizePatternId = (value: number | null | undefined): string =>
  value && value > 0 ? String(value) : "";

const formatPatternName = (value: string | null | undefined): string =>
  value && value.trim() ? value : "-";

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

const formatNumber = (value: number): string =>
  Number.isFinite(value)
    ? value.toLocaleString("tr-TR", { maximumFractionDigits: 3 })
    : "-";

const parseApiError = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; error?: string } | undefined;
    return data?.message || data?.error || fallback;
  }
  return fallback;
};

const getAuthHeaders = (): { Authorization: string } | undefined => {
  if (typeof window === "undefined") return undefined;
  const token = localStorage.getItem("token") || localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : undefined;
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

const lookupName = (items: LookupOption[], id: string): string =>
  items.find((item) => String(item.id) === id)?.name ?? "";

/* ------------------------------------------------------------------ */
/*  Bileşen                                                            */
/* ------------------------------------------------------------------ */

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
  const [colorFilter, setColorFilter] = useState<string>("");

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
    const response = await axios.get<FabricOrderRow[]>("/api/fabric-orders", {
      headers: getAuthHeaders(),
    });
    setOrders(Array.isArray(response.data) ? response.data : []);
  }, []);

  const loadReferenceData = useCallback(async () => {
    const headers = getAuthHeaders();
    const [supplierRes, fabricRes, colorRes, patternRes] = await Promise.all([
      axios.get("/api/suppliers", { headers }),
      axios.get("/api/fabrics", { headers }),
      axios.get("/api/colors", { headers }),
      axios.get("/api/fabric-patterns", { headers }),
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
      setError(parseApiError(loadError, "Kumaş siparişi verileri alınamadı."));
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
        const nextRes = await axios.get<{ nextOrderNumber: number }>("/api/fabric-orders/next-number", {
          headers: getAuthHeaders(),
        });
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
        setFormError(parseApiError(openError, "Yeni sipariş formu açılamadı."));
      }
    },
    [fabrics, normalizedInitialFabricType, normalizedInitialQuantity, normalizedInitialUnitType]
  );

  useEffect(() => {
    if (!autoOpenNewOrder || autoOpenHandled || loading) return;

    if (fabrics.length === 0 || colors.length === 0 || suppliers.length === 0) {
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
    suppliers.length,
  ]);

  /* Esc ile formu kapat */
  useEffect(() => {
    if (!showForm) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowForm(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showForm]);

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
      if (colorFilter && order.colorName !== colorFilter) return false;

      return true;
    });
  }, [colorFilter, fabricFilter, orders, searchTerm, statusFilter, supplierFilter]);

  /* Üst şeritteki sayaçlar */
  const counts = useMemo(() => {
    const base: Record<string, number> = {};
    STATUS_OPTIONS.forEach((s) => (base[s] = 0));
    orders.forEach((o) => {
      base[o.status] = (base[o.status] || 0) + 1;
    });
    return base;
  }, [orders]);

  const activeFilterCount = [searchTerm, statusFilter, supplierFilter, fabricFilter, colorFilter].filter(
    Boolean
  ).length;

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("");
    setSupplierFilter("");
    setFabricFilter("");
    setColorFilter("");
  };

  const exportRows = useMemo(
    () =>
      filteredOrders.map((order) => ({
        "Siparis No": order.orderNumber,
        "Siparis Tarihi": toDisplayDate(order.orderDate),
        Tedarikci: order.supplierName,
        Kumas: order.fabricName,
        Renk: order.colorName,
        Desen: formatPatternName(order.patternName),
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
      notifyError("Dışarı aktarılacak veri bulunamadı.");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kumas Siparisleri");
    XLSX.writeFile(wb, `kumas_siparisleri_${todayISO()}.xlsx`);
  };

  const handlePdfExport = () => {
    if (exportRows.length === 0) {
      notifyError("Dışarı aktarılacak veri bulunamadı.");
      return;
    }

    const doc = new jsPDF();
    const headers = [[
      "Siparis No",
      "Siparis Tarihi",
      "Tedarikci",
      "Kumas",
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
      formatPatternName(order.patternName),
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

    doc.save(`kumas_siparisleri_${todayISO()}.pdf`);
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
      patternId: normalizePatternId(order.patternId),
      quantity: String(order.quantity),
      unitType: normalizeUnitType(order.unitType),
      arrivalDate: toIsoDate(order.arrivalDate),
      status: order.status,
      notes: order.notes || "",
    });
    setShowForm(true);
  };

  const handleDeleteOrder = async (id: number) => {
    if (!confirm("Bu siparişi silmek istediğinize emin misiniz?")) {
      return;
    }

    try {
      await axios.delete("/api/fabric-orders", {
        data: { id },
        headers: getAuthHeaders(),
      });
      setOrders((prev) => prev.filter((order) => order.id !== id));
    } catch (deleteError: unknown) {
      console.error("Delete fabric order error:", deleteError);
      notifyError(parseApiError(deleteError, "Sipariş silinemedi."));
    }
  };

  const handleFormChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

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
      patternId: form.patternId ? Number(form.patternId) : null,
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
      !Number.isFinite(payload.quantity) ||
      payload.quantity <= 0
    ) {
      setSaving(false);
      setFormError("Tedarikçi, kumaş, renk ve pozitif miktar zorunludur.");
      return;
    }

    try {
      if (form.id) {
        await axios.put("/api/fabric-orders", payload, {
          headers: getAuthHeaders(),
        });
      } else {
        await axios.post("/api/fabric-orders", payload, {
          headers: getAuthHeaders(),
        });
      }

      await loadOrders();
      setShowForm(false);
    } catch (submitError: unknown) {
      console.error("Save fabric order error:", submitError);
      setFormError(parseApiError(submitError, "Sipariş kaydedilemedi."));
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

  const uniqueColorNames = useMemo(
    () => [...new Set(orders.map((item) => item.colorName))].sort((a, b) => a.localeCompare(b, "tr")),
    [orders]
  );

  const hasMissingMasterData =
    suppliers.length === 0 || fabrics.length === 0 || colors.length === 0;

  /* Form özet kartı için türetilmiş değerler */
  const slip = {
    supplier: lookupName(suppliers, form.supplierId),
    fabric: lookupName(fabrics, form.fabricId),
    color: lookupName(colors, form.colorId),
    pattern: lookupName(patterns, form.patternId),
    quantity: Number(form.quantity),
  };
  const missing: string[] = [];
  if (!slip.supplier) missing.push("Tedarikçi");
  if (!slip.fabric) missing.push("Kumaş");
  if (!slip.color) missing.push("Renk");
  if (!(slip.quantity > 0)) missing.push("Miktar");

  return (
    <div className="fo">
      <style>{CSS}</style>

      {/* ---------------- Başlık + durum sayaçları ---------------- */}
      <header className="fo-head">
        <div className="fo-head-text">
          <h1 className="fo-title">Kumaş siparişleri</h1>
          <p className="fo-sub">
            {orders.length} sipariş kayıtlı
            {filteredOrders.length !== orders.length ? `, ${filteredOrders.length} tanesi görüntüleniyor` : ""}
          </p>
        </div>

        <div className="fo-stats" role="group" aria-label="Duruma göre filtrele">
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              type="button"
              className={`fo-stat tone-${statusTone(status)}`}
              data-active={statusFilter === status}
              onClick={() => setStatusFilter(statusFilter === status ? "" : status)}
            >
              <span className="fo-stat-num">{counts[status] || 0}</span>
              <span className="fo-stat-label">{statusLabel(status)}</span>
            </button>
          ))}
        </div>

        <div className="fo-head-actions">
          <button type="button" className="fo-btn ghost" onClick={handleExcelExport}>
            Excel
          </button>
          <button type="button" className="fo-btn ghost" onClick={handlePdfExport}>
            PDF
          </button>
          <button type="button" className="fo-btn primary" onClick={() => void openNewOrderForm(false)}>
            Yeni sipariş
          </button>
        </div>
      </header>

      {normalizedInitialFabricType ? (
        <div className="fo-note info">
          Planlamadan gelen kumaş filtresi uygulandı: <strong>{normalizedInitialFabricType}</strong>
        </div>
      ) : null}
      {error ? <div className="fo-note error">{error}</div> : null}
      {hasMissingMasterData ? (
        <div className="fo-note warn">
          Tedarikçi, kumaş veya renk kartları eksik. Sipariş oluşturmadan önce tüm kartların tanımlı olduğunu
          kontrol edin.
        </div>
      ) : null}

      {/* ---------------- Filtre çubuğu ---------------- */}
      <div className="fo-filters">
        <input
          type="search"
          className="fo-control fo-search"
          placeholder="Sipariş no, tedarikçi, kumaş, renk, desen ara"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          aria-label="Ara"
        />
        <select
          className="fo-control"
          value={supplierFilter}
          onChange={(event) => setSupplierFilter(event.target.value)}
          aria-label="Tedarikçi"
        >
          <option value="">Tüm tedarikçiler</option>
          {uniqueSupplierNames.map((supplier) => (
            <option key={supplier} value={supplier}>
              {supplier}
            </option>
          ))}
        </select>
        <select
          className="fo-control"
          value={fabricFilter}
          onChange={(event) => setFabricFilter(event.target.value)}
          aria-label="Kumaş"
        >
          <option value="">Tüm kumaşlar</option>
          {uniqueFabricNames.map((fabricName) => (
            <option key={fabricName} value={fabricName}>
              {fabricName}
            </option>
          ))}
        </select>
        <select
          className="fo-control"
          value={colorFilter}
          onChange={(event) => setColorFilter(event.target.value)}
          aria-label="Renk"
        >
          <option value="">Tüm renkler</option>
          {uniqueColorNames.map((colorName) => (
            <option key={colorName} value={colorName}>
              {colorName}
            </option>
          ))}
        </select>
        {activeFilterCount > 0 ? (
          <button type="button" className="fo-btn quiet" onClick={clearFilters}>
            Filtreleri temizle ({activeFilterCount})
          </button>
        ) : null}
      </div>

      {/* ---------------- Tablo ---------------- */}
      <div className="fo-table-wrap">
        <table className="fo-table">
          <thead>
            <tr>
              <th>Sipariş</th>
              <th>Tedarikçi</th>
              <th>Kumaş</th>
              <th>Renk / desen</th>
              <th className="num">Sipariş miktarı</th>
              <th className="progress-col">Gelen</th>
              <th className="num">Kalan</th>
              <th>Geliş</th>
              <th>Durum</th>
              <th aria-label="İşlemler" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="fo-empty" colSpan={10}>
                  Yükleniyor...
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td className="fo-empty" colSpan={10}>
                  {orders.length === 0
                    ? "Henüz sipariş yok. “Yeni sipariş” ile ilk kaydı oluşturun."
                    : "Bu filtrelerle eşleşen sipariş yok."}
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => {
                const pct =
                  order.quantity > 0
                    ? Math.min(100, Math.max(0, (order.receivedQuantity / order.quantity) * 100))
                    : 0;
                return (
                  <tr key={order.id} data-cancel={statusTone(order.status) === "cancel"}>
                    <td>
                      <div className="fo-cell-strong">#{order.orderNumber}</div>
                      <div className="fo-cell-sub">{toDisplayDate(order.orderDate)}</div>
                    </td>
                    <td>{order.supplierName}</td>
                    <td>{order.fabricName}</td>
                    <td>
                      <div>{order.colorName}</div>
                      <div className="fo-cell-sub">{formatPatternName(order.patternName)}</div>
                    </td>
                    <td className="num">
                      <span className="fo-cell-strong">{formatNumber(order.quantity)}</span>{" "}
                      <span className="fo-unit">{order.unitType}</span>
                    </td>
                    <td className="progress-col">
                      <div className="fo-bar" aria-hidden="true">
                        <span style={{ width: `${pct}%` }} />
                      </div>
                      <div className="fo-cell-sub">
                        {formatNumber(order.receivedQuantity)} {order.unitType} · %{Math.round(pct)}
                      </div>
                    </td>
                    <td className="num">
                      {formatNumber(order.remainingQuantity)} <span className="fo-unit">{order.unitType}</span>
                    </td>
                    <td>{toDisplayDate(order.arrivalDate)}</td>
                    <td>
                      <span className={`fo-badge tone-${statusTone(order.status)}`}>
                        {statusLabel(order.status)}
                      </span>
                    </td>
                    <td>
                      <div className="fo-row-actions">
                        <button type="button" className="fo-link" onClick={() => handleEditOrder(order)}>
                          Düzenle
                        </button>
                        <button
                          type="button"
                          className="fo-link danger"
                          onClick={() => void handleDeleteOrder(order.id)}
                        >
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ---------------- Sipariş formu (sağdan açılan panel) ---------------- */}
      {showForm ? (
        <div
          className="fo-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowForm(false);
          }}
        >
          <form className="fo-sheet" onSubmit={handleSubmit} role="dialog" aria-modal="true" aria-label="Sipariş formu">
            <div className="fo-sheet-head">
              <div>
                <h2 className="fo-sheet-title">
                  {form.id ? "Siparişi düzenle" : "Yeni kumaş siparişi"}
                </h2>
                <p className="fo-sub">Zorunlu alanlar * ile işaretli</p>
              </div>
              <button type="button" className="fo-btn quiet" onClick={() => setShowForm(false)}>
                Kapat
              </button>
            </div>

            {formError ? <div className="fo-note error">{formError}</div> : null}

            <div className="fo-sheet-body">
              {/* Sol: alanlar */}
              <div className="fo-fields">
                <fieldset className="fo-section">
                  <legend>Temel bilgi</legend>
                  <div className="fo-grid">
                    <div className="fo-field">
                      <label htmlFor="fo-orderNumber">Sipariş no</label>
                      <input
                        id="fo-orderNumber"
                        className="fo-control readonly"
                        type="text"
                        value={String(form.orderNumber || "")}
                        readOnly
                      />
                    </div>
                    <div className="fo-field">
                      <label htmlFor="fo-orderDate">Sipariş tarihi *</label>
                      <input
                        id="fo-orderDate"
                        className="fo-control"
                        type="date"
                        name="orderDate"
                        value={form.orderDate}
                        onChange={handleFormChange}
                        required
                      />
                    </div>
                    <div className="fo-field span-2">
                      <label htmlFor="fo-supplierId">Tedarikçi *</label>
                      <select
                        id="fo-supplierId"
                        className="fo-control"
                        name="supplierId"
                        value={form.supplierId}
                        onChange={handleFormChange}
                        required
                      >
                        <option value="">Tedarikçi seçin</option>
                        {suppliers.map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </fieldset>

                <fieldset className="fo-section">
                  <legend>Kumaş tanımı</legend>
                  <div className="fo-grid">
                    <div className="fo-field span-2">
                      <label htmlFor="fo-fabricId">Kumaş *</label>
                      <select
                        id="fo-fabricId"
                        className="fo-control"
                        name="fabricId"
                        value={form.fabricId}
                        onChange={handleFormChange}
                        required
                      >
                        <option value="">Kumaş seçin</option>
                        {fabrics.map((fabric) => (
                          <option key={fabric.id} value={fabric.id}>
                            {fabric.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="fo-field">
                      <label htmlFor="fo-colorId">Renk *</label>
                      <select
                        id="fo-colorId"
                        className="fo-control"
                        name="colorId"
                        value={form.colorId}
                        onChange={handleFormChange}
                        required
                      >
                        <option value="">Renk seçin</option>
                        {colors.map((color) => (
                          <option key={color.id} value={color.id}>
                            {color.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="fo-field">
                      <label htmlFor="fo-patternId">Desen</label>
                      <select
                        id="fo-patternId"
                        className="fo-control"
                        name="patternId"
                        value={form.patternId}
                        onChange={handleFormChange}
                      >
                        <option value="">Desensiz</option>
                        {patterns.map((pattern) => (
                          <option key={pattern.id} value={pattern.id}>
                            {pattern.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </fieldset>

                <fieldset className="fo-section">
                  <legend>Miktar ve teslimat</legend>
                  <div className="fo-grid">
                    <div className="fo-field span-2">
                      <label htmlFor="fo-quantity">Sipariş miktarı *</label>
                      <div className="fo-qty">
                        <input
                          id="fo-quantity"
                          className="fo-control fo-qty-input"
                          type="number"
                          inputMode="decimal"
                          step="0.001"
                          min="0"
                          name="quantity"
                          value={form.quantity}
                          onChange={handleFormChange}
                          placeholder="0"
                          required
                        />
                        <div className="fo-seg" role="radiogroup" aria-label="Birim">
                          {(["kg", "m"] as UnitType[]).map((unit) => (
                            <button
                              key={unit}
                              type="button"
                              role="radio"
                              aria-checked={form.unitType === unit}
                              data-active={form.unitType === unit}
                              onClick={() => setField("unitType", unit)}
                            >
                              {unit}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="fo-field span-2">
                      <label htmlFor="fo-arrivalDate">Beklenen geliş tarihi</label>
                      <input
                        id="fo-arrivalDate"
                        className="fo-control"
                        type="date"
                        name="arrivalDate"
                        value={form.arrivalDate}
                        onChange={handleFormChange}
                      />
                    </div>
                  </div>
                </fieldset>

                <fieldset className="fo-section">
                  <legend>Durum</legend>
                  <div className="fo-status-pick" role="radiogroup" aria-label="Durum">
                    {STATUS_OPTIONS.map((status) => (
                      <button
                        key={status}
                        type="button"
                        role="radio"
                        aria-checked={form.status === status}
                        data-active={form.status === status}
                        className={`fo-chip tone-${statusTone(status)}`}
                        onClick={() => setField("status", status)}
                      >
                        {statusLabel(status)}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="fo-section">
                  <legend>Not</legend>
                  <textarea
                    className="fo-control fo-textarea"
                    name="notes"
                    value={form.notes}
                    onChange={handleFormChange}
                    rows={3}
                    placeholder="Üretim veya tedarikçi için eklenecek not"
                    aria-label="Not"
                  />
                </fieldset>
              </div>

              {/* Sağ: canlı sipariş föyü */}
              <aside className="fo-slip" aria-label="Sipariş özeti">
                <div className="fo-slip-top">
                  <span className="fo-slip-label">Sipariş no</span>
                  <span className="fo-slip-no">#{form.orderNumber || "-"}</span>
                  <span className={`fo-badge tone-${statusTone(form.status)}`}>{statusLabel(form.status)}</span>
                </div>

                <dl className="fo-slip-list">
                  <div>
                    <dt>Tedarikçi</dt>
                    <dd data-empty={!slip.supplier}>{slip.supplier || "Seçilmedi"}</dd>
                  </div>
                  <div>
                    <dt>Kumaş</dt>
                    <dd data-empty={!slip.fabric}>{slip.fabric || "Seçilmedi"}</dd>
                  </div>
                  <div>
                    <dt>Renk</dt>
                    <dd data-empty={!slip.color}>{slip.color || "Seçilmedi"}</dd>
                  </div>
                  <div>
                    <dt>Desen</dt>
                    <dd data-empty={!slip.pattern}>{slip.pattern || "Desensiz"}</dd>
                  </div>
                  <div>
                    <dt>Sipariş tarihi</dt>
                    <dd>{toDisplayDate(form.orderDate)}</dd>
                  </div>
                  <div>
                    <dt>Beklenen geliş</dt>
                    <dd data-empty={!form.arrivalDate}>{toDisplayDate(form.arrivalDate)}</dd>
                  </div>
                </dl>

                <div className="fo-slip-qty">
                  <span className="fo-slip-label">Miktar</span>
                  <span className="fo-slip-qty-num">
                    {slip.quantity > 0 ? formatNumber(slip.quantity) : "0"}
                    <small>{form.unitType}</small>
                  </span>
                </div>

                {missing.length > 0 ? (
                  <p className="fo-slip-missing">Eksik: {missing.join(", ")}</p>
                ) : (
                  <p className="fo-slip-ready">Kaydetmeye hazır</p>
                )}
              </aside>
            </div>

            <div className="fo-sheet-foot">
              <button type="button" className="fo-btn ghost" onClick={() => setShowForm(false)}>
                Vazgeç
              </button>
              <button type="submit" className="fo-btn primary" disabled={saving}>
                {saving ? "Kaydediliyor..." : form.id ? "Değişiklikleri kaydet" : "Siparişi kaydet"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stiller                                                            */
/*  Mevcut --fs-color-* değişkenleri kullanılır; yoksa yedek değer     */
/*  devreye girer. Durum renkleri tema ile uyumlu kalacak şekilde      */
/*  currentColor üzerinden karıştırılır.                               */
/* ------------------------------------------------------------------ */

const CSS = `
.fo {
  --c-text: var(--fs-color-text, #1c2430);
  --c-muted: var(--fs-color-text-muted, #637083);
  --c-surface: var(--fs-color-surface, #ffffff);
  --c-soft: var(--fs-color-surface-soft, #f4f6f8);
  --c-border: var(--fs-color-border, #e1e6ec);
  --c-border-strong: var(--fs-color-border-strong, #c4ccd6);
  --c-primary: var(--fs-color-primary, #1f5f8b);
  --c-primary-strong: var(--fs-color-primary-strong, #174a6c);
  --t-wait: #b7791f;
  --t-ok: #2b6cb0;
  --t-cancel: #c0392b;
  --t-done: #2f855a;

  width: 100%;
  padding: 1rem 1.25rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  color: var(--c-text);
  font-variant-numeric: tabular-nums;
  box-sizing: border-box;
}
.fo *, .fo *::before, .fo *::after { box-sizing: border-box; }

/* ---- başlık ---- */
.fo-head {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) auto auto;
  gap: 1rem 1.5rem;
  align-items: center;
}
.fo-title { margin: 0; font-size: 1.55rem; font-weight: 700; letter-spacing: -0.01em; }
.fo-sub { margin: 0.15rem 0 0; font-size: 0.85rem; color: var(--c-muted); }
.fo-head-actions { display: flex; gap: 0.5rem; align-items: center; }

.fo-stats { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.fo-stat {
  display: flex; align-items: baseline; gap: 0.45rem;
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--c-border);
  border-left-width: 4px;
  border-radius: 6px;
  background: var(--c-surface);
  color: var(--c-text);
  cursor: pointer;
  font: inherit;
}
.fo-stat:hover { background: var(--c-soft); }
.fo-stat[data-active="true"] { background: var(--c-soft); border-color: var(--c-border-strong); }
.fo-stat-num { font-size: 1.15rem; font-weight: 700; }
.fo-stat-label { font-size: 0.8rem; color: var(--c-muted); }
.fo-stat.tone-wait { border-left-color: var(--t-wait); }
.fo-stat.tone-ok { border-left-color: var(--t-ok); }
.fo-stat.tone-cancel { border-left-color: var(--t-cancel); }
.fo-stat.tone-done { border-left-color: var(--t-done); }

/* ---- uyarılar ---- */
.fo-note { padding: 0.6rem 0.8rem; border-radius: 6px; font-size: 0.86rem; border: 1px solid; }
.fo-note.info { color: var(--t-ok); background: color-mix(in srgb, var(--t-ok) 9%, transparent); border-color: color-mix(in srgb, var(--t-ok) 35%, transparent); }
.fo-note.warn { color: var(--t-wait); background: color-mix(in srgb, var(--t-wait) 10%, transparent); border-color: color-mix(in srgb, var(--t-wait) 40%, transparent); }
.fo-note.error { color: var(--t-cancel); background: color-mix(in srgb, var(--t-cancel) 9%, transparent); border-color: color-mix(in srgb, var(--t-cancel) 40%, transparent); }

/* ---- kontroller ---- */
.fo-control {
  width: 100%;
  min-height: 40px;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--c-border-strong);
  border-radius: 6px;
  background: var(--c-surface);
  color: var(--c-text);
  font: inherit;
  font-size: 0.92rem;
}
.fo-control:focus-visible, .fo-btn:focus-visible, .fo-stat:focus-visible, .fo-chip:focus-visible,
.fo-seg button:focus-visible, .fo-link:focus-visible {
  outline: 2px solid var(--c-primary);
  outline-offset: 2px;
}
.fo-control.readonly { background: var(--c-soft); color: var(--c-muted); font-weight: 700; }
.fo-textarea { resize: vertical; min-height: 76px; }

.fo-btn {
  min-height: 40px; padding: 0 1rem;
  border-radius: 6px; border: 1px solid transparent;
  font: inherit; font-size: 0.9rem; font-weight: 600; cursor: pointer;
}
.fo-btn.primary { background: var(--c-primary); border-color: var(--c-primary-strong); color: #fff; }
.fo-btn.primary:hover { background: var(--c-primary-strong); }
.fo-btn.primary:disabled { opacity: 0.6; cursor: progress; }
.fo-btn.ghost { background: var(--c-surface); border-color: var(--c-border-strong); color: var(--c-text); }
.fo-btn.ghost:hover { background: var(--c-soft); }
.fo-btn.quiet { background: transparent; color: var(--c-muted); }
.fo-btn.quiet:hover { color: var(--c-text); background: var(--c-soft); }

/* ---- filtreler ---- */
.fo-filters { display: grid; grid-template-columns: minmax(240px, 2fr) repeat(3, minmax(150px, 1fr)) auto; gap: 0.5rem; align-items: center; }

/* ---- tablo ---- */
.fo-table-wrap { border: 1px solid var(--c-border); border-radius: 8px; background: var(--c-surface); overflow-x: auto; }
.fo-table { width: 100%; min-width: 1080px; border-collapse: collapse; }
.fo-table th {
  position: sticky; top: 0;
  padding: 0.7rem 0.8rem; text-align: left;
  font-size: 0.78rem; font-weight: 700; color: var(--c-muted);
  background: var(--c-soft); border-bottom: 1px solid var(--c-border-strong);
  white-space: nowrap;
}
.fo-table td { padding: 0.65rem 0.8rem; font-size: 0.88rem; border-top: 1px solid var(--c-border); vertical-align: middle; white-space: nowrap; }
.fo-table tbody tr:hover { background: var(--c-soft); }
.fo-table tr[data-cancel="true"] td { color: var(--c-muted); }
.fo-table tr[data-cancel="true"] td:first-child { text-decoration: line-through; }
.fo-table .num { text-align: right; }
.fo-table .progress-col { min-width: 150px; }
.fo-cell-strong { font-weight: 700; }
.fo-cell-sub { font-size: 0.76rem; color: var(--c-muted); margin-top: 1px; }
.fo-unit { font-size: 0.76rem; color: var(--c-muted); }
.fo-empty { text-align: center; padding: 2rem 1rem !important; color: var(--c-muted); white-space: normal !important; }

.fo-bar { height: 6px; border-radius: 3px; background: var(--c-border); overflow: hidden; }
.fo-bar span { display: block; height: 100%; background: var(--t-done); }

.fo-badge {
  display: inline-block; padding: 0.15rem 0.55rem; border-radius: 4px;
  font-size: 0.78rem; font-weight: 700;
  color: var(--tone); background: color-mix(in srgb, var(--tone) 13%, transparent);
}
.tone-wait { --tone: var(--t-wait); }
.tone-ok { --tone: var(--t-ok); }
.tone-cancel { --tone: var(--t-cancel); }
.tone-done { --tone: var(--t-done); }

.fo-row-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }
.fo-link { border: 0; background: transparent; padding: 0; font: inherit; font-size: 0.82rem; font-weight: 600; color: var(--c-primary); cursor: pointer; }
.fo-link:hover { text-decoration: underline; }
.fo-link.danger { color: var(--t-cancel); }

/* ---- form paneli ---- */
.fo-overlay {
  position: fixed; inset: 0; z-index: 60;
  display: flex; justify-content: flex-end;
  background: rgba(15, 23, 42, 0.45);
}
.fo-sheet {
  width: min(980px, 100%); height: 100%;
  display: flex; flex-direction: column;
  background: var(--c-surface);
  border-left: 1px solid var(--c-border-strong);
  box-shadow: -18px 0 40px -24px rgba(15, 23, 42, 0.5);
  animation: fo-in 0.2s ease-out;
}
@keyframes fo-in { from { transform: translateX(24px); opacity: 0; } to { transform: none; opacity: 1; } }
.fo-sheet-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; padding: 1rem 1.25rem; border-bottom: 1px solid var(--c-border); }
.fo-sheet-title { margin: 0; font-size: 1.25rem; font-weight: 700; }
.fo-sheet > .fo-note { margin: 0.75rem 1.25rem 0; }
.fo-sheet-body { flex: 1; overflow-y: auto; display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 1.25rem; padding: 1rem 1.25rem; align-items: start; }
.fo-sheet-foot { display: flex; justify-content: flex-end; gap: 0.6rem; padding: 0.85rem 1.25rem; border-top: 1px solid var(--c-border); background: var(--c-surface); }

.fo-fields { display: flex; flex-direction: column; gap: 0.9rem; }
.fo-section { margin: 0; padding: 0.9rem 1rem 1rem; border: 1px solid var(--c-border); border-radius: 8px; min-width: 0; }
.fo-section legend { padding: 0 0.4rem; font-size: 0.88rem; font-weight: 700; }
.fo-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
.fo-field { display: flex; flex-direction: column; gap: 0.3rem; min-width: 0; }
.fo-field.span-2 { grid-column: 1 / -1; }
.fo-field label { font-size: 0.82rem; font-weight: 600; color: var(--c-muted); }

.fo-qty { display: flex; gap: 0.6rem; align-items: stretch; }
.fo-qty-input { font-size: 1.3rem; font-weight: 700; min-height: 52px; }
.fo-seg { display: flex; border: 1px solid var(--c-border-strong); border-radius: 6px; overflow: hidden; flex: none; }
.fo-seg button { min-width: 64px; border: 0; background: var(--c-surface); color: var(--c-text); font: inherit; font-weight: 700; cursor: pointer; }
.fo-seg button + button { border-left: 1px solid var(--c-border-strong); }
.fo-seg button[data-active="true"] { background: var(--c-primary); color: #fff; }

.fo-status-pick { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.fo-chip {
  min-height: 38px; padding: 0 0.9rem; border-radius: 6px;
  border: 1px solid var(--c-border-strong); background: var(--c-surface); color: var(--c-text);
  font: inherit; font-size: 0.88rem; font-weight: 600; cursor: pointer;
}
.fo-chip:hover { background: var(--c-soft); }
.fo-chip[data-active="true"] { color: var(--tone); border-color: var(--tone); background: color-mix(in srgb, var(--tone) 13%, transparent); }

/* ---- canlı sipariş föyü ---- */
.fo-slip { position: sticky; top: 0; border: 1px solid var(--c-border-strong); border-radius: 8px; background: var(--c-soft); overflow: hidden; }
.fo-slip-top { display: grid; gap: 0.2rem; justify-items: start; padding: 0.9rem 1rem; border-bottom: 1px dashed var(--c-border-strong); }
.fo-slip-label { font-size: 0.78rem; color: var(--c-muted); }
.fo-slip-no { font-size: 1.9rem; font-weight: 800; line-height: 1.1; }
.fo-slip-list { margin: 0; padding: 0.4rem 1rem; }
.fo-slip-list > div { display: flex; justify-content: space-between; gap: 0.75rem; padding: 0.45rem 0; border-bottom: 1px solid var(--c-border); font-size: 0.86rem; }
.fo-slip-list > div:last-child { border-bottom: 0; }
.fo-slip-list dt { color: var(--c-muted); }
.fo-slip-list dd { margin: 0; font-weight: 600; text-align: right; }
.fo-slip-list dd[data-empty="true"] { color: var(--c-muted); font-weight: 400; }
.fo-slip-qty { display: grid; gap: 0.1rem; padding: 0.8rem 1rem; border-top: 1px dashed var(--c-border-strong); }
.fo-slip-qty-num { font-size: 1.8rem; font-weight: 800; }
.fo-slip-qty-num small { margin-left: 0.3rem; font-size: 0.95rem; font-weight: 600; color: var(--c-muted); }
.fo-slip-missing, .fo-slip-ready { margin: 0; padding: 0.6rem 1rem; font-size: 0.82rem; font-weight: 600; }
.fo-slip-missing { color: var(--t-wait); background: color-mix(in srgb, var(--t-wait) 10%, transparent); }
.fo-slip-ready { color: var(--t-done); background: color-mix(in srgb, var(--t-done) 10%, transparent); }

/* ---- duyarlı ---- */
@media (max-width: 1100px) {
  .fo-head { grid-template-columns: 1fr; }
  .fo-filters { grid-template-columns: 1fr 1fr; }
  .fo-search { grid-column: 1 / -1; }
}
@media (max-width: 760px) {
  .fo { padding: 0.75rem; }
  .fo-sheet-body { grid-template-columns: 1fr; }
  .fo-slip { position: static; order: -1; }
  .fo-grid { grid-template-columns: 1fr; }
  .fo-filters { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .fo-sheet { animation: none; }
}
`;
