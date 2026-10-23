import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
} from "react";
import { useRouter } from "next/router";
import axios from "axios";
import { notifyError } from "../../hooks/useToast";
import {
  DEFAULT_PURCHASE_VOUCHER_TYPE_LABEL,
  PURCHASE_VOUCHER_TYPES,
} from "../../lib/purchase-voucher-types";

/* ------------------------------------------------------------------ */
/*  Tipler (mantık değişmedi)                                          */
/* ------------------------------------------------------------------ */

type TabKey = "irsaliyeler" | "faturalar";
type DocumentType = "irsaliye" | "fatura";
type UnitType = "kg" | "m";

type LookupOption = {
  id: number;
  name: string;
};

type FabricOrderOption = {
  id: number;
  orderNumber: number;
  supplierName: string;
  fabricId: number;
  fabricName: string;
  colorId: number;
  colorName: string;
  quantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  unitType: UnitType;
};

type DocumentRow = {
  id: number;
  documentType: DocumentType;
  fgType: string;
  fgNumber: string;
  date: string;
  orderNo: string | null;
  supplierCode: string;
  supplierName: string;
  documentNumber: string;
  entryWarehouseCode: string;
  exitWarehouseCode: string;
  total: number;
  fabricOrderId: number | null;
  fabricOrderNumber: number | null;
  fabricId: number | null;
  fabricName: string;
  colorId: number | null;
  colorName: string;
  quantity: number;
  unitType: UnitType;
};

type FormState = {
  id?: number;
  documentType: DocumentType;
  fgType: string;
  fgNumber: string;
  date: string;
  orderNo: string;
  supplierCode: string;
  supplierName: string;
  documentNumber: string;
  entryWarehouseCode: string;
  exitWarehouseCode: string;
  fabricOrderId: string;
  fabricId: string;
  colorId: string;
  quantity: string;
  unitType: UnitType;
  total: string;
};

type ContextMenuState = {
  visible: boolean;
  x: number;
  y: number;
  selectedRow: DocumentRow | null;
};

/* ------------------------------------------------------------------ */
/*  Yardımcılar (mantık değişmedi)                                     */
/* ------------------------------------------------------------------ */

const normalizeUnitType = (value: string | null | undefined): UnitType =>
  String(value || "kg").toLowerCase().startsWith("m") ? "m" : "kg";

const toDisplayDate = (value: string | null | undefined): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("tr-TR");
};

const toIsoDate = (value: string | null | undefined): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const todayISO = (): string => new Date().toISOString().slice(0, 10);
const toDocumentType = (tab: TabKey): DocumentType => (tab === "faturalar" ? "fatura" : "irsaliye");

const parseApiError = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; error?: string } | undefined;
    return data?.message || data?.error || fallback;
  }
  return fallback;
};

const normalizeFgType = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const candidate = value as { label?: unknown; value?: unknown; name?: unknown };
    const resolved = [candidate.label, candidate.value, candidate.name].find(
      (item) => typeof item === "string" && item.trim().length > 0
    );
    return typeof resolved === "string" ? resolved.trim() : "";
  }
  return "";
};

const getAuthHeaders = (): { Authorization: string } | undefined => {
  if (typeof window === "undefined") return undefined;
  const token = localStorage.getItem("token") || localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};

const toLookupList = (raw: unknown): LookupOption[] => {
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

const toFabricOrderList = (raw: unknown): FabricOrderOption[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const casted = item as Partial<FabricOrderOption>;
      const id = Number(casted.id || 0);
      const orderNumber = Number(casted.orderNumber || 0);
      const fabricId = Number(casted.fabricId || 0);
      const colorId = Number(casted.colorId || 0);
      if (!id || !orderNumber || !fabricId || !colorId) return null;
      return {
        id,
        orderNumber,
        supplierName: String(casted.supplierName || ""),
        fabricId,
        fabricName: String(casted.fabricName || ""),
        colorId,
        colorName: String(casted.colorName || ""),
        quantity: Number(casted.quantity || 0),
        receivedQuantity: Number(casted.receivedQuantity || 0),
        remainingQuantity: Number(casted.remainingQuantity || 0),
        unitType: normalizeUnitType(String(casted.unitType || "kg")),
      };
    })
    .filter((item): item is FabricOrderOption => Boolean(item))
    .sort((a, b) => b.orderNumber - a.orderNumber);
};

const toDocumentRows = (raw: unknown): DocumentRow[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const casted = item as Partial<DocumentRow>;
      const id = Number(casted.id || 0);
      if (!id) return null;
      return {
        id,
        documentType:
          String(casted.documentType || "irsaliye").toLowerCase().startsWith("f")
            ? "fatura"
            : "irsaliye",
        fgType: String(casted.fgType || ""),
        fgNumber: String(casted.fgNumber || ""),
        date: String(casted.date || ""),
        orderNo: casted.orderNo ? String(casted.orderNo) : null,
        supplierCode: String(casted.supplierCode || ""),
        supplierName: String(casted.supplierName || ""),
        documentNumber: String(casted.documentNumber || ""),
        entryWarehouseCode: String(casted.entryWarehouseCode || ""),
        exitWarehouseCode: String(casted.exitWarehouseCode || ""),
        total: Number(casted.total || 0),
        fabricOrderId: casted.fabricOrderId ? Number(casted.fabricOrderId) : null,
        fabricOrderNumber: casted.fabricOrderNumber ? Number(casted.fabricOrderNumber) : null,
        fabricId: casted.fabricId ? Number(casted.fabricId) : null,
        fabricName: String(casted.fabricName || ""),
        colorId: casted.colorId ? Number(casted.colorId) : null,
        colorName: String(casted.colorName || ""),
        quantity: Number(casted.quantity || 0),
        unitType: normalizeUnitType(casted.unitType || "kg"),
      };
    })
    .filter((item): item is DocumentRow => Boolean(item));
};

const createEmptyForm = (documentType: DocumentType, preferredFgType?: string): FormState => ({
  documentType,
  fgType: normalizeFgType(preferredFgType) || DEFAULT_PURCHASE_VOUCHER_TYPE_LABEL,
  fgNumber: "",
  date: todayISO(),
  orderNo: "",
  supplierCode: "",
  supplierName: "",
  documentNumber: "",
  entryWarehouseCode: "KD",
  exitWarehouseCode: "",
  fabricOrderId: "",
  fabricId: "",
  colorId: "",
  quantity: "",
  unitType: "kg",
  total: "0",
});

const numberFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const qtyFormatter = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 });

const typeLabel = (type: DocumentType): string => (type === "fatura" ? "Fatura" : "İrsaliye");

/* ------------------------------------------------------------------ */
/*  Bileşen                                                            */
/* ------------------------------------------------------------------ */

export default function InvoicesSlipsPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabKey>("irsaliyeler");
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [fabricOrders, setFabricOrders] = useState<FabricOrderOption[]>([]);
  const [fabrics, setFabrics] = useState<LookupOption[]>([]);
  const [colors, setColors] = useState<LookupOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [formError, setFormError] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showForm, setShowForm] = useState<boolean>(false);
  const [form, setForm] = useState<FormState>(createEmptyForm("irsaliye"));
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    selectedRow: null,
  });
  const [handledQuerySignature, setHandledQuerySignature] = useState<string>("");

  const currentType = toDocumentType(activeTab);

  const loadPageData = async (): Promise<void> => {
    setLoading(true);
    setError("");
    try {
      const headers = getAuthHeaders();
      const [documentsRes, fabricOrdersRes, fabricsRes, colorsRes] = await Promise.all([
        axios.get("/api/fabric-documents", { headers }),
        axios.get("/api/fabric-orders", { headers }),
        axios.get("/api/fabrics", { headers }),
        axios.get("/api/colors", { headers }),
      ]);

      setDocuments(toDocumentRows(documentsRes.data));
      setFabricOrders(toFabricOrderList(fabricOrdersRes.data));
      setFabrics(toLookupList(fabricsRes.data));
      setColors(toLookupList(colorsRes.data));
    } catch (loadError: unknown) {
      console.error("Fabric documents load error:", loadError);
      setError(parseApiError(loadError, "Kumaş irsaliye/fatura verileri alınamadı."));
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPageData();
  }, []);

  useEffect(() => {
    const rawType = router.query.type;
    const queryType = Array.isArray(rawType) ? rawType[0] : rawType;
    if (queryType === "faturalar") {
      setActiveTab("faturalar");
      return;
    }
    if (queryType === "irsaliyeler") {
      setActiveTab("irsaliyeler");
    }
  }, [router.query.type]);

  useEffect(() => {
    const closeMenu = () => setContextMenu({ visible: false, x: 0, y: 0, selectedRow: null });
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, []);

  /* Esc: önce menüyü, sonra formu kapat */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setContextMenu({ visible: false, x: 0, y: 0, selectedRow: null });
      setShowForm(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase("tr");
    return documents.filter((row) => {
      if (row.documentType !== currentType) return false;
      if (!query) return true;
      const searchable = [
        row.fgType,
        row.fgNumber,
        row.documentNumber,
        row.orderNo || "",
        String(row.fabricOrderNumber || ""),
        row.fabricName,
        row.colorName,
        row.supplierCode,
        row.supplierName,
      ]
        .join(" ")
        .toLocaleLowerCase("tr");
      return searchable.includes(query);
    });
  }, [currentType, documents, searchTerm]);

  const summary = useMemo(
    () =>
      filteredRows.reduce(
        (acc, row) => {
          acc.count += 1;
          acc.total += row.total;
          acc.quantity += row.quantity;
          return acc;
        },
        { count: 0, total: 0, quantity: 0 }
      ),
    [filteredRows]
  );

  const tabCounts = useMemo(
    () => ({
      irsaliyeler: documents.filter((d) => d.documentType === "irsaliye").length,
      faturalar: documents.filter((d) => d.documentType === "fatura").length,
    }),
    [documents]
  );

  const switchTab = (nextTab: TabKey): void => {
    setActiveTab(nextTab);
    void router.replace(
      {
        pathname: router.pathname,
        query: { ...router.query, type: nextTab },
      },
      undefined,
      { shallow: true }
    );
  };

  const openNewDocument = useCallback((preferredFgType?: string): void => {
    setFormError("");
    setForm(createEmptyForm(currentType, preferredFgType));
    setShowForm(true);
  }, [currentType]);

  const openDocumentFromOrder = useCallback(
    (orderId: number, preferredFgType?: string): void => {
      const selectedSourceOrder = fabricOrders.find((order) => order.id === orderId);
      if (!selectedSourceOrder) {
        setFormError("Aktarılacak kumaş siparişi bulunamadı.");
        return;
      }

      setFormError("");
      setForm({
        ...createEmptyForm(currentType, preferredFgType),
        orderNo: String(selectedSourceOrder.orderNumber || ""),
        supplierName: selectedSourceOrder.supplierName || "",
        fabricOrderId: String(selectedSourceOrder.id),
        fabricId: String(selectedSourceOrder.fabricId),
        colorId: String(selectedSourceOrder.colorId),
        quantity:
          selectedSourceOrder.remainingQuantity > 0
            ? String(selectedSourceOrder.remainingQuantity)
            : String(selectedSourceOrder.quantity || ""),
        unitType: normalizeUnitType(selectedSourceOrder.unitType),
      });
      setShowForm(true);
    },
    [currentType, fabricOrders]
  );

  const openEditDocument = (row: DocumentRow): void => {
    setFormError("");
    setForm({
      id: row.id,
      documentType: row.documentType,
      fgType: row.fgType || "",
      fgNumber: row.fgNumber || "",
      date: toIsoDate(row.date) || todayISO(),
      orderNo: row.orderNo || "",
      supplierCode: row.supplierCode || "",
      supplierName: row.supplierName || "",
      documentNumber: row.documentNumber || "",
      entryWarehouseCode: row.entryWarehouseCode || "",
      exitWarehouseCode: row.exitWarehouseCode || "",
      fabricOrderId: row.fabricOrderId ? String(row.fabricOrderId) : "",
      fabricId: row.fabricId ? String(row.fabricId) : "",
      colorId: row.colorId ? String(row.colorId) : "",
      quantity: String(row.quantity || ""),
      unitType: normalizeUnitType(row.unitType),
      total: String(row.total || 0),
    });
    setShowForm(true);
  };

  const handleContextMenu = (event: MouseEvent, row: DocumentRow | null = null): void => {
    event.preventDefault();
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      selectedRow: row,
    });
  };

  const importFromOrder = (): void => {
    const selectedOrderId = contextMenu.selectedRow?.fabricOrderId || null;
    const preferredFgType = contextMenu.selectedRow?.fgType || "";

    if (selectedOrderId && Number.isInteger(selectedOrderId) && selectedOrderId > 0) {
      openDocumentFromOrder(selectedOrderId, preferredFgType);
      setContextMenu({ visible: false, x: 0, y: 0, selectedRow: null });
      return;
    }

    if (!fabricOrders.length) {
      setFormError("Aktarılacak kumaş siparişi bulunamadı.");
      return;
    }

    const quickList = fabricOrders
      .slice(0, 20)
      .map(
        (order) =>
          `${order.id} - ${order.orderNumber} - ${order.fabricName} / ${order.colorName} (Kalan: ${order.remainingQuantity} ${order.unitType})`
      )
      .join("\n");
    const promptText = `Aktarılacak kumaş siparişi ID veya Sipariş No girin:\n${quickList}`;
    const rawInput = window.prompt(promptText, String(fabricOrders[0].id)) || "";
    const trimmedInput = rawInput.trim();
    if (!trimmedInput) return;

    const numericValue = Number(trimmedInput);
    const matchedOrder =
      Number.isInteger(numericValue) && numericValue > 0
        ? fabricOrders.find((order) => order.id === numericValue || order.orderNumber === numericValue)
        : fabricOrders.find((order) => String(order.orderNumber) === trimmedInput);

    if (!matchedOrder) {
      setFormError("Girilen sipariş bulunamadı.");
      return;
    }

    openDocumentFromOrder(matchedOrder.id, preferredFgType);
    setContextMenu({ visible: false, x: 0, y: 0, selectedRow: null });
  };

  const handleCopyDocument = (): void => {
    if (!contextMenu.selectedRow) return;
    const source = contextMenu.selectedRow;
    setFormError("");
    setForm({
      id: undefined,
      documentType: source.documentType,
      fgType: source.fgType || "",
      fgNumber: "",
      date: todayISO(),
      orderNo: source.orderNo || "",
      supplierCode: source.supplierCode || "",
      supplierName: source.supplierName || "",
      documentNumber: "",
      entryWarehouseCode: source.entryWarehouseCode || "",
      exitWarehouseCode: source.exitWarehouseCode || "",
      fabricOrderId: source.fabricOrderId ? String(source.fabricOrderId) : "",
      fabricId: source.fabricId ? String(source.fabricId) : "",
      colorId: source.colorId ? String(source.colorId) : "",
      quantity: source.quantity ? String(source.quantity) : "",
      unitType: normalizeUnitType(source.unitType),
      total: String(source.total || 0),
    });
    setShowForm(true);
    setContextMenu({ visible: false, x: 0, y: 0, selectedRow: null });
  };

  const handleDeleteDocument = async (id: number): Promise<void> => {
    if (!confirm("Bu belgeyi silmek istediğinize emin misiniz?")) return;
    try {
      await axios.delete("/api/fabric-documents", { data: { id }, headers: getAuthHeaders() });
      await loadPageData();
    } catch (deleteError: unknown) {
      console.error("Delete fabric document error:", deleteError);
      notifyError(parseApiError(deleteError, "Belge silinemedi."));
    } finally {
      setContextMenu({ visible: false, x: 0, y: 0, selectedRow: null });
    }
  };

  const handleFormChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = event.target;
    setForm((prev) => {
      if (name === "documentType") {
        return { ...prev, documentType: value.toLowerCase().startsWith("f") ? "fatura" : "irsaliye" };
      }
      if (name === "fabricOrderId") {
        const selectedOrderId = Number(value);
        const selectedOrder = fabricOrders.find((order) => order.id === selectedOrderId);
        if (!selectedOrder) {
          return { ...prev, fabricOrderId: "" };
        }
        return {
          ...prev,
          fabricOrderId: String(selectedOrder.id),
          fabricId: String(selectedOrder.fabricId),
          colorId: String(selectedOrder.colorId),
          unitType: normalizeUnitType(selectedOrder.unitType),
          supplierName: prev.supplierName || selectedOrder.supplierName,
        };
      }
      if (name === "unitType") {
        return { ...prev, unitType: normalizeUnitType(value) };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    setFormError("");

    const payload = {
      id: form.id,
      documentType: form.documentType,
      fgType: form.fgType.trim(),
      fgNumber: form.fgNumber.trim(),
      date: form.date,
      orderNo: form.orderNo.trim() || null,
      supplierCode: form.supplierCode.trim() || null,
      supplierName: form.supplierName.trim() || null,
      documentNumber: form.documentNumber.trim(),
      entryWarehouseCode: form.entryWarehouseCode.trim() || null,
      exitWarehouseCode: form.exitWarehouseCode.trim() || null,
      fabricOrderId: Number(form.fabricOrderId),
      fabricId: Number(form.fabricId),
      colorId: Number(form.colorId),
      quantity: Number(form.quantity),
      unitType: form.unitType,
      total: Number(form.total),
    };

    if (
      !payload.fgNumber ||
      !payload.documentNumber ||
      !payload.date ||
      !payload.fabricOrderId ||
      !payload.fabricId ||
      !payload.colorId ||
      !Number.isFinite(payload.quantity) ||
      payload.quantity <= 0 ||
      !Number.isFinite(payload.total) ||
      payload.total < 0
    ) {
      setSaving(false);
      setFormError(
        "FG no, belge no, tarih, kumaş siparişi, kumaş, renk ve pozitif miktar zorunludur."
      );
      return;
    }

    try {
      if (form.id) {
        await axios.put("/api/fabric-documents", payload, { headers: getAuthHeaders() });
      } else {
        await axios.post("/api/fabric-documents", payload, { headers: getAuthHeaders() });
      }
      await loadPageData();
      setShowForm(false);
    } catch (submitError: unknown) {
      console.error("Save fabric document error:", submitError);
      setFormError(parseApiError(submitError, "Belge kaydedilemedi."));
    } finally {
      setSaving(false);
    }
  };

  const selectedOrder = useMemo(
    () => fabricOrders.find((order) => String(order.id) === form.fabricOrderId),
    [fabricOrders, form.fabricOrderId]
  );

  const selectedFabric = useMemo(
    () => fabrics.find((item) => String(item.id) === form.fabricId) || null,
    [fabrics, form.fabricId]
  );

  const selectedColor = useMemo(
    () => colors.find((item) => String(item.id) === form.colorId) || null,
    [colors, form.colorId]
  );

  const fgTypeOptions = useMemo(() => {
    const defaultOptions = PURCHASE_VOUCHER_TYPES
      .map((item) => normalizeFgType(item.label))
      .filter((item) => item.length > 0);
    const currentValue = normalizeFgType(form.fgType);
    if (!currentValue) return defaultOptions;
    return defaultOptions.includes(currentValue) ? defaultOptions : [currentValue, ...defaultOptions];
  }, [form.fgType]);

  useEffect(() => {
    if (!router.isReady) return;
    const rawId = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id;
    const rawNew = Array.isArray(router.query.new) ? router.query.new[0] : router.query.new;
    const rawFromOrderId = Array.isArray(router.query.fromOrderId)
      ? router.query.fromOrderId[0]
      : router.query.fromOrderId;
    const rawVoucherType = Array.isArray(router.query.voucherType)
      ? router.query.voucherType[0]
      : router.query.voucherType;

    const signature = `${String(rawId || "")}|${String(rawNew || "")}|${String(rawFromOrderId || "")}|${String(rawVoucherType || "")}|${currentType}`;
    if (signature === handledQuerySignature) return;

    const parsedId = Number(rawId);
    if (Number.isInteger(parsedId) && parsedId > 0) {
      const target = documents.find((row) => row.id === parsedId);
      if (!target) return;
      openEditDocument(target);
      setHandledQuerySignature(signature);
      return;
    }

    const parsedFromOrderId = Number(rawFromOrderId);
    if (Number.isInteger(parsedFromOrderId) && parsedFromOrderId > 0) {
      if (fabricOrders.length === 0) return;
      openDocumentFromOrder(parsedFromOrderId, String(rawVoucherType || "").trim());
      setHandledQuerySignature(signature);
      return;
    }

    if (String(rawNew || "") === "1") {
      openNewDocument(String(rawVoucherType || "").trim());
      setHandledQuerySignature(signature);
    }
  }, [
    router.isReady,
    router.query.id,
    router.query.new,
    router.query.fromOrderId,
    router.query.voucherType,
    currentType,
    documents,
    fabricOrders,
    handledQuerySignature,
    openDocumentFromOrder,
    openNewDocument,
  ]);

  /* ---- form özeti için türetilmiş değerler ---- */
  const formQty = Number(form.quantity);
  const qtyValid = Number.isFinite(formQty) && formQty > 0;
  const sameUnit = selectedOrder ? selectedOrder.unitType === form.unitType : false;
  const isNew = !form.id;
  const afterRemaining =
    selectedOrder && sameUnit && isNew && qtyValid ? selectedOrder.remainingQuantity - formQty : null;
  const receivedPct = selectedOrder && selectedOrder.quantity > 0
    ? Math.min(100, Math.max(0, (selectedOrder.receivedQuantity / selectedOrder.quantity) * 100))
    : 0;
  const thisPct =
    selectedOrder && sameUnit && isNew && qtyValid && selectedOrder.quantity > 0
      ? Math.min(100 - receivedPct, (formQty / selectedOrder.quantity) * 100)
      : 0;

  const missing: string[] = [];
  if (!form.fgNumber.trim()) missing.push("FG no");
  if (!form.documentNumber.trim()) missing.push("Belge no");
  if (!form.fabricOrderId) missing.push("Kumaş siparişi");
  if (!form.fabricId) missing.push("Kumaş");
  if (!form.colorId) missing.push("Renk");
  if (!qtyValid) missing.push("Miktar");

  return (
    <div className="fd">
      <style>{CSS}</style>

      {/* ---------------- Başlık ---------------- */}
      <header className="fd-head">
        <div>
          <h1 className="fd-title">Kumaş irsaliye ve faturaları</h1>
          <p className="fd-sub">
            Gelen kumaşı siparişe bağlayın; sipariş bakiyesi kayıtla birlikte güncellenir.
          </p>
        </div>
        <button type="button" className="fd-btn primary" onClick={() => openNewDocument()}>
          Yeni {activeTab === "faturalar" ? "fatura" : "irsaliye"}
        </button>
      </header>

      {error ? <div className="fd-note error">{error}</div> : null}

      {/* ---------------- Sekmeler + özet ---------------- */}
      <div className="fd-bar">
        <div className="fd-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "irsaliyeler"}
            data-active={activeTab === "irsaliyeler"}
            onClick={() => switchTab("irsaliyeler")}
          >
            İrsaliyeler <span className="fd-tab-count">{tabCounts.irsaliyeler}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "faturalar"}
            data-active={activeTab === "faturalar"}
            onClick={() => switchTab("faturalar")}
          >
            Faturalar <span className="fd-tab-count">{tabCounts.faturalar}</span>
          </button>
        </div>

        <dl className="fd-totals">
          <div>
            <dt>Listedeki kayıt</dt>
            <dd>{summary.count}</dd>
          </div>
          <div>
            <dt>Toplam miktar</dt>
            <dd>{numberFormatter.format(summary.quantity)}</dd>
          </div>
          <div>
            <dt>Toplam tutar</dt>
            <dd>{numberFormatter.format(summary.total)}</dd>
          </div>
        </dl>
      </div>

      <div className="fd-search-row">
        <input
          type="search"
          className="fd-control"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="FG no, belge no, sipariş no, kumaş, renk veya cari ara"
          aria-label="Ara"
        />
        <span className="fd-hint">Satıra sağ tıklayın: siparişten aktar, kopyala, sil</span>
      </div>

      {/* ---------------- Tablo ---------------- */}
      <div className="fd-table-wrap" onContextMenu={(event) => handleContextMenu(event)}>
        <table className="fd-table">
          <thead>
            <tr>
              <th>FG</th>
              <th>Tarih</th>
              <th>Belge no</th>
              <th>Sipariş</th>
              <th>Kumaş / renk</th>
              <th className="num">Miktar</th>
              <th>Cari hesap</th>
              <th className="num">Tutar</th>
              <th aria-label="İşlemler" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="fd-empty" colSpan={9}>
                  Yükleniyor...
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td className="fd-empty" colSpan={9}>
                  {searchTerm
                    ? "Arama kriterlerine uygun kayıt bulunamadı."
                    : `Bu sekmede henüz ${activeTab === "faturalar" ? "fatura" : "irsaliye"} yok.`}
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.id} onContextMenu={(event) => handleContextMenu(event, row)}>
                  <td>
                    <div className="fd-strong">{row.fgNumber || "-"}</div>
                    <div className="fd-cell-sub">{row.fgType || "-"}</div>
                  </td>
                  <td>{toDisplayDate(row.date)}</td>
                  <td>{row.documentNumber}</td>
                  <td>
                    <div>Kumaş #{row.fabricOrderNumber || "-"}</div>
                    <div className="fd-cell-sub">Müşteri: {row.orderNo || "-"}</div>
                  </td>
                  <td>
                    <div>{row.fabricName || "-"}</div>
                    <div className="fd-cell-sub">{row.colorName || "-"}</div>
                  </td>
                  <td className="num">
                    <span className="fd-strong">{numberFormatter.format(row.quantity)}</span>{" "}
                    <span className="fd-unit">{row.unitType}</span>
                  </td>
                  <td>{row.supplierName || "-"}</td>
                  <td className="num">{numberFormatter.format(row.total)}</td>
                  <td>
                    <div className="fd-row-actions">
                      <button type="button" className="fd-link" onClick={() => openEditDocument(row)}>
                        Düzenle
                      </button>
                      <button
                        type="button"
                        className="fd-link danger"
                        onClick={() => void handleDeleteDocument(row.id)}
                      >
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

      {/* ---------------- Sağ tık menüsü ---------------- */}
      {contextMenu.visible ? (
        <div className="fd-menu" style={{ top: contextMenu.y, left: contextMenu.x }} role="menu">
          <button type="button" role="menuitem" onClick={() => openNewDocument()}>
            Yeni
          </button>
          <button type="button" role="menuitem" onClick={importFromOrder} disabled={!fabricOrders.length}>
            Siparişten aktar
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleCopyDocument}
            disabled={!contextMenu.selectedRow}
          >
            Kopyala
          </button>
          <button
            type="button"
            role="menuitem"
            className="danger"
            onClick={() => {
              if (!contextMenu.selectedRow) return;
              void handleDeleteDocument(contextMenu.selectedRow.id);
            }}
            disabled={!contextMenu.selectedRow}
          >
            Sil
          </button>
        </div>
      ) : null}

      {/* ---------------- Belge formu ---------------- */}
      {showForm ? (
        <div
          className="fd-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowForm(false);
          }}
        >
          <form
            className="fd-sheet"
            onSubmit={handleSubmit}
            role="dialog"
            aria-modal="true"
            aria-label="Belge formu"
          >
            <div className="fd-sheet-head">
              <div>
                <h2 className="fd-sheet-title">
                  {form.id ? `${typeLabel(form.documentType)} düzenle` : `Yeni ${typeLabel(form.documentType).toLocaleLowerCase("tr")}`}
                </h2>
                <p className="fd-sub">Zorunlu alanlar * ile işaretli</p>
              </div>

              <div className="fd-seg" role="radiogroup" aria-label="Belge tipi">
                {(["irsaliye", "fatura"] as DocumentType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={form.documentType === type}
                    data-active={form.documentType === type}
                    onClick={() => setForm((prev) => ({ ...prev, documentType: type }))}
                  >
                    {typeLabel(type)}
                  </button>
                ))}
              </div>

              <button type="button" className="fd-btn quiet" onClick={() => setShowForm(false)}>
                Kapat
              </button>
            </div>

            {formError ? <div className="fd-note error fd-sheet-note">{formError}</div> : null}

            <div className="fd-sheet-body">
              <div className="fd-fields">
                {/* Belge kimliği */}
                <fieldset className="fd-section">
                  <legend>Belge bilgisi</legend>
                  <div className="fd-grid cols-4">
                    <div className="fd-field span-2">
                      <label htmlFor="fd-fgType">FG türü</label>
                      <select
                        id="fd-fgType"
                        className="fd-control"
                        name="fgType"
                        value={form.fgType}
                        onChange={handleFormChange}
                      >
                        {fgTypeOptions.map((label, index) => (
                          <option key={`${label}-${index}`} value={label}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="fd-field">
                      <label htmlFor="fd-fgNumber">FG no *</label>
                      <input
                        id="fd-fgNumber"
                        className="fd-control"
                        name="fgNumber"
                        value={form.fgNumber}
                        onChange={handleFormChange}
                        required
                      />
                    </div>
                    <div className="fd-field">
                      <label htmlFor="fd-date">Belge tarihi *</label>
                      <input
                        id="fd-date"
                        className="fd-control"
                        type="date"
                        name="date"
                        value={form.date}
                        onChange={handleFormChange}
                        required
                      />
                    </div>
                    <div className="fd-field span-4">
                      <label htmlFor="fd-documentNumber">Belge no *</label>
                      <input
                        id="fd-documentNumber"
                        className="fd-control fd-big"
                        name="documentNumber"
                        value={form.documentNumber}
                        onChange={handleFormChange}
                        placeholder="Tedarikçinin belge numarası"
                        required
                      />
                    </div>
                  </div>
                </fieldset>

                {/* Sipariş bağlantısı */}
                <fieldset className="fd-section">
                  <legend>Sipariş bağlantısı</legend>
                  <div className="fd-grid cols-4">
                    <div className="fd-field span-4">
                      <label htmlFor="fd-fabricOrderId">Kumaş siparişi *</label>
                      <select
                        id="fd-fabricOrderId"
                        className="fd-control"
                        name="fabricOrderId"
                        value={form.fabricOrderId}
                        onChange={handleFormChange}
                        required
                      >
                        <option value="">Sipariş seçin</option>
                        {fabricOrders.map((order) => (
                          <option key={order.id} value={order.id}>
                            {order.orderNumber} - {order.fabricName} / {order.colorName} (Kalan:{" "}
                            {order.remainingQuantity} {order.unitType})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="fd-field span-2">
                      <label htmlFor="fd-orderNo">Müşteri sipariş no</label>
                      <input
                        id="fd-orderNo"
                        className="fd-control"
                        name="orderNo"
                        value={form.orderNo}
                        onChange={handleFormChange}
                      />
                    </div>
                  </div>
                </fieldset>

                {/* Malzeme */}
                <fieldset className="fd-section">
                  <legend>Malzeme</legend>
                  <div className="fd-grid cols-4">
                    <div className="fd-field span-2">
                      <label htmlFor="fd-fabricId">Kumaş *</label>
                      <select
                        id="fd-fabricId"
                        className="fd-control"
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
                    <div className="fd-field span-2">
                      <label htmlFor="fd-colorId">Renk *</label>
                      <select
                        id="fd-colorId"
                        className="fd-control"
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
                    <div className="fd-field span-4">
                      <label htmlFor="fd-quantity">Gelen miktar *</label>
                      <div className="fd-qty">
                        <input
                          id="fd-quantity"
                          className="fd-control fd-qty-input"
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
                        <div className="fd-seg" role="radiogroup" aria-label="Birim">
                          {(["kg", "m"] as UnitType[]).map((unit) => (
                            <button
                              key={unit}
                              type="button"
                              role="radio"
                              aria-checked={form.unitType === unit}
                              data-active={form.unitType === unit}
                              onClick={() => setForm((prev) => ({ ...prev, unitType: unit }))}
                            >
                              {unit}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </fieldset>

                {/* Cari ve depo */}
                <fieldset className="fd-section">
                  <legend>Cari hesap ve depo</legend>
                  <div className="fd-grid cols-4">
                    <div className="fd-field">
                      <label htmlFor="fd-supplierCode">Cari kodu</label>
                      <input
                        id="fd-supplierCode"
                        className="fd-control"
                        name="supplierCode"
                        value={form.supplierCode}
                        onChange={handleFormChange}
                      />
                    </div>
                    <div className="fd-field span-3">
                      <label htmlFor="fd-supplierName">Cari adı</label>
                      <input
                        id="fd-supplierName"
                        className="fd-control"
                        name="supplierName"
                        value={form.supplierName}
                        onChange={handleFormChange}
                      />
                    </div>
                    <div className="fd-field span-2">
                      <label htmlFor="fd-entry">Giriş depo</label>
                      <input
                        id="fd-entry"
                        className="fd-control"
                        name="entryWarehouseCode"
                        value={form.entryWarehouseCode}
                        onChange={handleFormChange}
                      />
                    </div>
                    <div className="fd-field span-2">
                      <label htmlFor="fd-exit">Çıkış depo</label>
                      <input
                        id="fd-exit"
                        className="fd-control"
                        name="exitWarehouseCode"
                        value={form.exitWarehouseCode}
                        onChange={handleFormChange}
                      />
                    </div>
                  </div>
                </fieldset>

                {/* Tutar */}
                <fieldset className="fd-section">
                  <legend>Tutar</legend>
                  <div className="fd-grid cols-4">
                    <div className="fd-field span-2">
                      <label htmlFor="fd-total">Toplam tutar *</label>
                      <input
                        id="fd-total"
                        className="fd-control fd-big"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        name="total"
                        value={form.total}
                        onChange={handleFormChange}
                        required
                      />
                    </div>
                  </div>
                </fieldset>
              </div>

              {/* Sağ: canlı belge özeti */}
              <aside className="fd-slip" aria-label="Belge özeti">
                <div className="fd-slip-top">
                  <span className="fd-slip-label">{typeLabel(form.documentType)}</span>
                  <span className="fd-slip-no">{form.documentNumber.trim() || "Belge no yok"}</span>
                  <span className="fd-slip-meta">
                    FG: {form.fgNumber.trim() || "-"} · {toDisplayDate(form.date)}
                  </span>
                  <span className="fd-badge">{form.id ? "Güncellenecek" : "Yeni kayıt"}</span>
                </div>

                <dl className="fd-slip-list">
                  <div>
                    <dt>Cari</dt>
                    <dd data-empty={!form.supplierName && !form.supplierCode}>
                      {form.supplierName || form.supplierCode || "Girilmedi"}
                    </dd>
                  </div>
                  <div>
                    <dt>Kumaş</dt>
                    <dd data-empty={!(selectedOrder?.fabricName || selectedFabric)}>
                      {selectedOrder?.fabricName || selectedFabric?.name || "Seçilmedi"}
                    </dd>
                  </div>
                  <div>
                    <dt>Renk</dt>
                    <dd data-empty={!(selectedOrder?.colorName || selectedColor)}>
                      {selectedOrder?.colorName || selectedColor?.name || "Seçilmedi"}
                    </dd>
                  </div>
                  <div>
                    <dt>Depo</dt>
                    <dd data-empty={!form.entryWarehouseCode && !form.exitWarehouseCode}>
                      {form.entryWarehouseCode || form.exitWarehouseCode
                        ? `${form.entryWarehouseCode || "-"} → ${form.exitWarehouseCode || "-"}`
                        : "Girilmedi"}
                    </dd>
                  </div>
                </dl>

                <div className="fd-slip-qty">
                  <div>
                    <span className="fd-slip-label">Miktar</span>
                    <span className="fd-slip-big">
                      {qtyValid ? qtyFormatter.format(formQty) : "0"}
                      <small>{form.unitType}</small>
                    </span>
                  </div>
                  <div>
                    <span className="fd-slip-label">Tutar</span>
                    <span className="fd-slip-big">
                      {Number.isFinite(Number(form.total)) ? numberFormatter.format(Number(form.total)) : "-"}
                    </span>
                  </div>
                </div>

                {selectedOrder ? (
                  <div className="fd-balance">
                    <div className="fd-balance-head">
                      <span>Sipariş #{selectedOrder.orderNumber} bakiyesi</span>
                      <span className="fd-unit">{selectedOrder.unitType}</span>
                    </div>
                    <div className="fd-meter" aria-hidden="true">
                      <span className="got" style={{ width: `${receivedPct}%` }} />
                      <span className="now" style={{ width: `${thisPct}%` }} />
                    </div>
                    <dl className="fd-balance-list">
                      <div>
                        <dt>Sipariş</dt>
                        <dd>{qtyFormatter.format(selectedOrder.quantity)}</dd>
                      </div>
                      <div>
                        <dt>Gelen</dt>
                        <dd>{qtyFormatter.format(selectedOrder.receivedQuantity)}</dd>
                      </div>
                      <div>
                        <dt>Kalan</dt>
                        <dd>{qtyFormatter.format(selectedOrder.remainingQuantity)}</dd>
                      </div>
                      {afterRemaining !== null ? (
                        <div className="after" data-over={afterRemaining < 0}>
                          <dt>Bu belgeden sonra</dt>
                          <dd>{qtyFormatter.format(afterRemaining)}</dd>
                        </div>
                      ) : null}
                    </dl>
                    {afterRemaining !== null && afterRemaining < 0 ? (
                      <p className="fd-over">
                        Girilen miktar sipariş kalanını {qtyFormatter.format(Math.abs(afterRemaining))}{" "}
                        {selectedOrder.unitType} aşıyor.
                      </p>
                    ) : null}
                    {!sameUnit ? (
                      <p className="fd-over">
                        Belge birimi ({form.unitType}) sipariş birimiyle ({selectedOrder.unitType}) aynı değil.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="fd-slip-missing">Sipariş seçilince bakiye burada görünür.</p>
                )}

                {missing.length > 0 ? (
                  <p className="fd-slip-missing">Eksik: {missing.join(", ")}</p>
                ) : (
                  <p className="fd-slip-ready">Kaydetmeye hazır</p>
                )}
              </aside>
            </div>

            <div className="fd-sheet-foot">
              <button type="button" className="fd-btn ghost" onClick={() => setShowForm(false)}>
                Vazgeç
              </button>
              <button type="submit" className="fd-btn primary" disabled={saving}>
                {saving ? "Kaydediliyor..." : form.id ? "Değişiklikleri kaydet" : `${typeLabel(form.documentType)} kaydet`}
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
/*  Sipariş sayfasıyla aynı --fs-color-* değişkenleri ve aynı görsel   */
/*  dil kullanılır; sınıflar .fd önekiyle ayrıldığı için iki sayfa     */
/*  birbirini etkilemez.                                               */
/* ------------------------------------------------------------------ */

const CSS = `
.fd {
  --c-text: var(--fs-color-text, #1c2430);
  --c-muted: var(--fs-color-text-muted, #637083);
  --c-surface: var(--fs-color-surface, #ffffff);
  --c-soft: var(--fs-color-surface-soft, #f4f6f8);
  --c-border: var(--fs-color-border, #e1e6ec);
  --c-border-strong: var(--fs-color-border-strong, #c4ccd6);
  --c-primary: var(--fs-color-primary, #1f5f8b);
  --c-primary-strong: var(--fs-color-primary-strong, #174a6c);
  --t-warn: #b7791f;
  --t-bad: #c0392b;
  --t-good: #2f855a;
  --t-info: #2b6cb0;

  width: 100%;
  padding: 1rem 1.25rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  color: var(--c-text);
  font-variant-numeric: tabular-nums;
  box-sizing: border-box;
}
.fd *, .fd *::before, .fd *::after { box-sizing: border-box; }

/* ---- başlık ---- */
.fd-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }
.fd-title { margin: 0; font-size: 1.55rem; font-weight: 700; letter-spacing: -0.01em; }
.fd-sub { margin: 0.2rem 0 0; font-size: 0.85rem; color: var(--c-muted); }

/* ---- butonlar ve kontroller ---- */
.fd-btn { min-height: 40px; padding: 0 1rem; border-radius: 6px; border: 1px solid transparent; font: inherit; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
.fd-btn.primary { background: var(--c-primary); border-color: var(--c-primary-strong); color: #fff; }
.fd-btn.primary:hover { background: var(--c-primary-strong); }
.fd-btn.primary:disabled { opacity: 0.6; cursor: progress; }
.fd-btn.ghost { background: var(--c-surface); border-color: var(--c-border-strong); color: var(--c-text); }
.fd-btn.ghost:hover { background: var(--c-soft); }
.fd-btn.quiet { background: transparent; color: var(--c-muted); }
.fd-btn.quiet:hover { color: var(--c-text); background: var(--c-soft); }

.fd-control { width: 100%; min-height: 40px; padding: 0.5rem 0.65rem; border: 1px solid var(--c-border-strong); border-radius: 6px; background: var(--c-surface); color: var(--c-text); font: inherit; font-size: 0.92rem; }
.fd-control.fd-big { font-size: 1.1rem; font-weight: 700; min-height: 46px; }
.fd-control:focus-visible, .fd-btn:focus-visible, .fd-tabs button:focus-visible, .fd-seg button:focus-visible,
.fd-link:focus-visible, .fd-menu button:focus-visible { outline: 2px solid var(--c-primary); outline-offset: 2px; }

.fd-note { padding: 0.6rem 0.8rem; border-radius: 6px; font-size: 0.86rem; border: 1px solid; }
.fd-note.error { color: var(--t-bad); background: color-mix(in srgb, var(--t-bad) 9%, transparent); border-color: color-mix(in srgb, var(--t-bad) 40%, transparent); }

/* ---- sekmeler + toplamlar ---- */
.fd-bar { display: flex; justify-content: space-between; align-items: flex-end; gap: 1rem; flex-wrap: wrap; border-bottom: 1px solid var(--c-border-strong); }
.fd-tabs { display: flex; gap: 0.25rem; }
.fd-tabs button { padding: 0.6rem 1rem; border: 0; border-bottom: 3px solid transparent; margin-bottom: -1px; background: transparent; color: var(--c-muted); font: inherit; font-weight: 600; cursor: pointer; }
.fd-tabs button:hover { color: var(--c-text); }
.fd-tabs button[data-active="true"] { color: var(--c-text); border-bottom-color: var(--c-primary); }
.fd-tab-count { margin-left: 0.3rem; padding: 0.05rem 0.45rem; border-radius: 10px; background: var(--c-soft); font-size: 0.76rem; color: var(--c-muted); }

.fd-totals { display: flex; gap: 1.5rem; margin: 0 0 0.5rem; }
.fd-totals div { display: grid; gap: 0.05rem; justify-items: end; }
.fd-totals dt { font-size: 0.76rem; color: var(--c-muted); }
.fd-totals dd { margin: 0; font-size: 1.1rem; font-weight: 700; }

.fd-search-row { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
.fd-search-row .fd-control { flex: 1; min-width: 260px; max-width: 520px; }
.fd-hint { font-size: 0.8rem; color: var(--c-muted); }

/* ---- tablo ---- */
.fd-table-wrap { border: 1px solid var(--c-border); border-radius: 8px; background: var(--c-surface); overflow: auto; max-height: calc(100vh - 290px); }
.fd-table { width: 100%; min-width: 1040px; border-collapse: collapse; }
.fd-table th { position: sticky; top: 0; z-index: 1; padding: 0.7rem 0.8rem; text-align: left; font-size: 0.78rem; font-weight: 700; color: var(--c-muted); background: var(--c-soft); border-bottom: 1px solid var(--c-border-strong); white-space: nowrap; }
.fd-table td { padding: 0.6rem 0.8rem; font-size: 0.88rem; border-top: 1px solid var(--c-border); vertical-align: middle; white-space: nowrap; }
.fd-table tbody tr:hover { background: var(--c-soft); }
.fd-table .num { text-align: right; }
.fd-strong { font-weight: 700; }
.fd-cell-sub { font-size: 0.76rem; color: var(--c-muted); margin-top: 1px; }
.fd-unit { font-size: 0.76rem; color: var(--c-muted); }
.fd-empty { text-align: center; padding: 2rem 1rem !important; color: var(--c-muted); white-space: normal !important; }
.fd-row-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }
.fd-link { border: 0; background: transparent; padding: 0; font: inherit; font-size: 0.82rem; font-weight: 600; color: var(--c-primary); cursor: pointer; }
.fd-link:hover { text-decoration: underline; }
.fd-link.danger { color: var(--t-bad); }

/* ---- sağ tık menüsü ---- */
.fd-menu { position: fixed; z-index: 150; min-width: 170px; padding: 4px; display: flex; flex-direction: column; border: 1px solid var(--c-border-strong); border-radius: 8px; background: var(--c-surface); box-shadow: 0 12px 28px -12px rgba(15, 23, 42, 0.5); }
.fd-menu button { min-height: 34px; padding: 0 0.75rem; border: 0; border-radius: 5px; background: transparent; color: var(--c-text); font: inherit; font-size: 0.88rem; text-align: left; cursor: pointer; }
.fd-menu button:hover:not(:disabled) { background: var(--c-soft); }
.fd-menu button.danger { color: var(--t-bad); }
.fd-menu button:disabled { opacity: 0.4; cursor: not-allowed; }

/* ---- form paneli ---- */
.fd-overlay { position: fixed; inset: 0; z-index: 200; display: flex; justify-content: flex-end; background: rgba(15, 23, 42, 0.45); }
.fd-sheet { width: min(1040px, 100%); height: 100%; display: flex; flex-direction: column; background: var(--c-surface); border-left: 1px solid var(--c-border-strong); box-shadow: -18px 0 40px -24px rgba(15, 23, 42, 0.5); animation: fd-in 0.2s ease-out; }
@keyframes fd-in { from { transform: translateX(24px); opacity: 0; } to { transform: none; opacity: 1; } }
.fd-sheet-head { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem; border-bottom: 1px solid var(--c-border); }
.fd-sheet-head > div:first-child { flex: 1; }
.fd-sheet-title { margin: 0; font-size: 1.25rem; font-weight: 700; }
.fd-sheet-note { margin: 0.75rem 1.25rem 0; }
.fd-sheet-body { flex: 1; overflow-y: auto; display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 1.25rem; padding: 1rem 1.25rem; align-items: start; }
.fd-sheet-foot { display: flex; justify-content: flex-end; gap: 0.6rem; padding: 0.85rem 1.25rem; border-top: 1px solid var(--c-border); }

.fd-fields { display: flex; flex-direction: column; gap: 0.9rem; }
.fd-section { margin: 0; padding: 0.9rem 1rem 1rem; border: 1px solid var(--c-border); border-radius: 8px; min-width: 0; }
.fd-section legend { padding: 0 0.4rem; font-size: 0.88rem; font-weight: 700; }
.fd-grid { display: grid; gap: 0.75rem; }
.fd-grid.cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.fd-field { display: flex; flex-direction: column; gap: 0.3rem; min-width: 0; }
.fd-field.span-2 { grid-column: span 2; }
.fd-field.span-3 { grid-column: span 3; }
.fd-field.span-4 { grid-column: 1 / -1; }
.fd-field label { font-size: 0.82rem; font-weight: 600; color: var(--c-muted); }

.fd-qty { display: flex; gap: 0.6rem; align-items: stretch; }
.fd-qty-input { font-size: 1.3rem; font-weight: 700; min-height: 52px; }
.fd-seg { display: flex; border: 1px solid var(--c-border-strong); border-radius: 6px; overflow: hidden; flex: none; }
.fd-seg button { min-width: 64px; min-height: 38px; padding: 0 0.9rem; border: 0; background: var(--c-surface); color: var(--c-text); font: inherit; font-weight: 700; cursor: pointer; }
.fd-seg button + button { border-left: 1px solid var(--c-border-strong); }
.fd-seg button[data-active="true"] { background: var(--c-primary); color: #fff; }

/* ---- belge özeti ---- */
.fd-slip { position: sticky; top: 0; border: 1px solid var(--c-border-strong); border-radius: 8px; background: var(--c-soft); overflow: hidden; }
.fd-slip-top { display: grid; gap: 0.25rem; justify-items: start; padding: 0.9rem 1rem; border-bottom: 1px dashed var(--c-border-strong); }
.fd-slip-label { display: block; font-size: 0.78rem; color: var(--c-muted); }
.fd-slip-no { font-size: 1.4rem; font-weight: 800; line-height: 1.2; word-break: break-all; }
.fd-slip-meta { font-size: 0.82rem; color: var(--c-muted); }
.fd-badge { display: inline-block; margin-top: 0.2rem; padding: 0.15rem 0.55rem; border-radius: 4px; font-size: 0.78rem; font-weight: 700; color: var(--t-info); background: color-mix(in srgb, var(--t-info) 13%, transparent); }
.fd-slip-list { margin: 0; padding: 0.4rem 1rem; }
.fd-slip-list > div { display: flex; justify-content: space-between; gap: 0.75rem; padding: 0.45rem 0; border-bottom: 1px solid var(--c-border); font-size: 0.86rem; }
.fd-slip-list > div:last-child { border-bottom: 0; }
.fd-slip-list dt { color: var(--c-muted); }
.fd-slip-list dd { margin: 0; font-weight: 600; text-align: right; }
.fd-slip-list dd[data-empty="true"] { color: var(--c-muted); font-weight: 400; }
.fd-slip-qty { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; padding: 0.8rem 1rem; border-top: 1px dashed var(--c-border-strong); }
.fd-slip-big { display: block; font-size: 1.35rem; font-weight: 800; }
.fd-slip-big small { margin-left: 0.25rem; font-size: 0.85rem; font-weight: 600; color: var(--c-muted); }

.fd-balance { padding: 0.8rem 1rem; border-top: 1px dashed var(--c-border-strong); display: grid; gap: 0.5rem; }
.fd-balance-head { display: flex; justify-content: space-between; font-size: 0.84rem; font-weight: 700; }
.fd-meter { display: flex; height: 8px; border-radius: 4px; background: var(--c-border); overflow: hidden; }
.fd-meter .got { background: var(--t-good); }
.fd-meter .now { background: var(--c-primary); }
.fd-balance-list { margin: 0; display: grid; gap: 0.2rem; }
.fd-balance-list > div { display: flex; justify-content: space-between; font-size: 0.84rem; }
.fd-balance-list dt { color: var(--c-muted); }
.fd-balance-list dd { margin: 0; font-weight: 600; }
.fd-balance-list .after { margin-top: 0.2rem; padding-top: 0.35rem; border-top: 1px solid var(--c-border); }
.fd-balance-list .after dt { color: var(--c-text); font-weight: 600; }
.fd-balance-list .after[data-over="true"] dd { color: var(--t-bad); }
.fd-over { margin: 0; font-size: 0.8rem; font-weight: 600; color: var(--t-bad); }

.fd-slip-missing, .fd-slip-ready { margin: 0; padding: 0.6rem 1rem; font-size: 0.82rem; font-weight: 600; }
.fd-slip-missing { color: var(--t-warn); background: color-mix(in srgb, var(--t-warn) 10%, transparent); }
.fd-slip-ready { color: var(--t-good); background: color-mix(in srgb, var(--t-good) 10%, transparent); }

/* ---- duyarlı ---- */
@media (max-width: 900px) {
  .fd-sheet-body { grid-template-columns: 1fr; }
  .fd-slip { position: static; order: -1; }
  .fd-grid.cols-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fd-field.span-3 { grid-column: 1 / -1; }
  .fd-sheet-head { flex-wrap: wrap; }
}
@media (max-width: 560px) {
  .fd { padding: 0.75rem; }
  .fd-grid.cols-4 { grid-template-columns: 1fr; }
  .fd-field.span-2, .fd-field.span-3 { grid-column: 1 / -1; }
  .fd-totals { gap: 1rem; }
}
@media (prefers-reduced-motion: reduce) {
  .fd-sheet { animation: none; }
}
`;
