import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties,
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
      setError(parseApiError(loadError, "Kumas irsaliye/fatura verileri alinamadi."));
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
        setFormError("Aktarilacak kumas siparisi bulunamadi.");
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
      setFormError("Aktarilacak kumas siparisi bulunamadi.");
      return;
    }

    const quickList = fabricOrders
      .slice(0, 20)
      .map(
        (order) =>
          `${order.id} - ${order.orderNumber} - ${order.fabricName} / ${order.colorName} (Kalan: ${order.remainingQuantity} ${order.unitType})`
      )
      .join("\n");
    const promptText = `Aktarilacak kumas siparisi ID veya Siparis No girin:\n${quickList}`;
    const rawInput = window.prompt(promptText, String(fabricOrders[0].id)) || "";
    const trimmedInput = rawInput.trim();
    if (!trimmedInput) return;

    const numericValue = Number(trimmedInput);
    const matchedOrder =
      Number.isInteger(numericValue) && numericValue > 0
        ? fabricOrders.find((order) => order.id === numericValue || order.orderNumber === numericValue)
        : fabricOrders.find((order) => String(order.orderNumber) === trimmedInput);

    if (!matchedOrder) {
      setFormError("Girilen siparis bulunamadi.");
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
    if (!confirm("Bu belgeyi silmek istediginize emin misiniz?")) return;
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
        "FG no, belge no, tarih, kumas siparisi, kumas, renk ve pozitif miktar zorunludur."
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

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div>
          <h1 style={styles.title}>Kumas Irsaliyeleri ve Faturalari</h1>
          <p style={styles.subtitle}>
            Gelen kumasi siparise baglayin; kumas ve renk secimiyle siparis bakiyesi otomatik dusurulsun.
          </p>
        </div>
        <div style={styles.statRow}>
          <div style={styles.statBox}>
            <span style={styles.statLabel}>Kayit</span>
            <strong>{summary.count}</strong>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statLabel}>Miktar</span>
            <strong>{numberFormatter.format(summary.quantity)}</strong>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statLabel}>Toplam</span>
            <strong>{numberFormatter.format(summary.total)}</strong>
          </div>
        </div>
      </section>

      {error ? <div style={styles.errorBox}>{error}</div> : null}

      <section style={styles.panel}>
        <div style={styles.toolbar}>
          <div style={styles.tabs}>
            <button
              type="button"
              style={{ ...styles.tabBtn, ...(activeTab === "irsaliyeler" ? styles.tabBtnActive : {}) }}
              onClick={() => switchTab("irsaliyeler")}
            >
              Kumas Irsaliyeleri
            </button>
            <button
              type="button"
              style={{ ...styles.tabBtn, ...(activeTab === "faturalar" ? styles.tabBtnActive : {}) }}
              onClick={() => switchTab("faturalar")}
            >
              Kumas Faturalari
            </button>
          </div>
          <button type="button" style={styles.primaryBtn} onClick={() => openNewDocument()}>
            Yeni Belge
          </button>
        </div>

        <input
          type="text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="FG no, belge no, siparis no, kumas veya renk ara..."
          style={styles.searchInput}
        />

        <div style={styles.tableWrap} onContextMenu={(event) => handleContextMenu(event)}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>FG Turu</th>
                <th style={styles.th}>FG No</th>
                <th style={styles.th}>Tarih</th>
                <th style={styles.th}>Kumas Siparis No</th>
                <th style={styles.th}>Musteri Siparis No</th>
                <th style={styles.th}>Kumas</th>
                <th style={styles.th}>Renk</th>
                <th style={{ ...styles.th, ...styles.right }}>Miktar</th>
                <th style={styles.th}>Birim</th>
                <th style={styles.th}>Belge No</th>
                <th style={styles.th}>Cari Hesap</th>
                <th style={{ ...styles.th, ...styles.right }}>Toplam</th>
                <th style={styles.th}>Islem</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td style={styles.emptyCell} colSpan={13}>
                    Yukleniyor...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td style={styles.emptyCell} colSpan={13}>
                    {searchTerm ? "Arama kriterlerine uygun kayit bulunamadi." : "Bu sekmede henuz belge yok."}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} onContextMenu={(event) => handleContextMenu(event, row)}>
                    <td style={styles.td}>{row.fgType || "-"}</td>
                    <td style={styles.td}>{row.fgNumber || "-"}</td>
                    <td style={styles.td}>{toDisplayDate(row.date)}</td>
                    <td style={styles.td}>{row.fabricOrderNumber || "-"}</td>
                    <td style={styles.td}>{row.orderNo || "-"}</td>
                    <td style={styles.td}>{row.fabricName || "-"}</td>
                    <td style={styles.td}>{row.colorName || "-"}</td>
                    <td style={{ ...styles.td, ...styles.right }}>{numberFormatter.format(row.quantity)}</td>
                    <td style={styles.td}>{row.unitType}</td>
                    <td style={styles.td}>{row.documentNumber}</td>
                    <td style={styles.td}>{row.supplierName || "-"}</td>
                    <td style={{ ...styles.td, ...styles.right }}>{numberFormatter.format(row.total)}</td>
                    <td style={styles.td}>
                      <div style={styles.actionRow}>
                        <button type="button" style={styles.linkBtn} onClick={() => openEditDocument(row)}>
                          Duzenle
                        </button>
                        <button type="button" style={styles.linkBtnDanger} onClick={() => void handleDeleteDocument(row.id)}>
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
      </section>

      {contextMenu.visible ? (
        <div style={{ ...styles.contextMenu, top: contextMenu.y, left: contextMenu.x }}>
          <button type="button" style={styles.contextBtn} onClick={() => openNewDocument()}>
            Yeni
          </button>
          <button
            type="button"
            style={{ ...styles.contextBtn, ...(fabricOrders.length ? {} : styles.contextBtnDisabled) }}
            onClick={importFromOrder}
            disabled={!fabricOrders.length}
          >
            Siparisten Aktar
          </button>
          <button
            type="button"
            style={{ ...styles.contextBtn, ...(contextMenu.selectedRow ? {} : styles.contextBtnDisabled) }}
            onClick={handleCopyDocument}
            disabled={!contextMenu.selectedRow}
          >
            Kopyala
          </button>
          <button
            type="button"
            style={{ ...styles.contextBtn, ...styles.contextBtnDanger, ...(contextMenu.selectedRow ? {} : styles.contextBtnDisabled) }}
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

      {showForm ? (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>{form.id ? "Belge Duzenle" : "Yeni Belge"}</h2>
                <p style={styles.modalSubtitle}>
                  Belge kaydini siparisle eslestir, cari ve depo bilgisini tek ekranda yonet.
                </p>
              </div>
              <div style={styles.modalHeaderMeta}>
                <span style={styles.modalBadge}>
                  {form.documentType === "fatura" ? "Fatura" : "Irsaliye"}
                </span>
                <button type="button" style={styles.secondaryBtn} onClick={() => setShowForm(false)}>
                  Kapat
                </button>
              </div>
            </div>

            <div style={styles.formTabs}>
              <span style={{ ...styles.formTab, ...styles.formTabActive }}>Genel Bilgi</span>
              <span style={styles.formTab}>Cari / Depo</span>
              <span style={styles.formTab}>Tutar ve Ozet</span>
            </div>

            {formError ? <div style={styles.formError}>{formError}</div> : null}

            <form style={styles.erpForm} onSubmit={handleSubmit}>
              <div style={styles.formBody}>
                <section style={styles.formSection}>
                  <span style={styles.sectionLegend}>Genel Bilgi</span>
                  <div style={styles.sectionGrid}>
                    <label style={styles.label}>
                      Belge Tipi
                      <select
                        name="documentType"
                        value={form.documentType}
                        onChange={handleFormChange}
                        style={styles.input}
                      >
                        <option value="irsaliye">Irsaliye</option>
                        <option value="fatura">Fatura</option>
                      </select>
                    </label>
                    <label style={styles.label}>
                      FG Turu
                      <select name="fgType" value={form.fgType} onChange={handleFormChange} style={styles.input}>
                        {fgTypeOptions.map((label, index) => (
                          <option key={`${label}-${index}`} value={label}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={styles.label}>
                      FG Numarasi
                      <input
                        name="fgNumber"
                        value={form.fgNumber}
                        onChange={handleFormChange}
                        style={styles.input}
                        required
                      />
                    </label>
                    <label style={styles.label}>
                      Belge Tarihi
                      <input
                        type="date"
                        name="date"
                        value={form.date}
                        onChange={handleFormChange}
                        style={styles.input}
                        required
                      />
                    </label>
                    <label style={{ ...styles.label, ...styles.sectionSpan2 }}>
                      Belge Numarasi
                      <input
                        name="documentNumber"
                        value={form.documentNumber}
                        onChange={handleFormChange}
                        style={styles.input}
                        required
                      />
                    </label>
                  </div>
                </section>

                <section style={styles.formSection}>
                  <span style={styles.sectionLegend}>Siparis ve Urun Bilgileri</span>
                  <div style={styles.sectionGrid}>
                    <label style={{ ...styles.label, ...styles.sectionSpan2 }}>
                      Kumas Siparisi
                      <select
                        name="fabricOrderId"
                        value={form.fabricOrderId}
                        onChange={handleFormChange}
                        style={styles.input}
                        required
                      >
                        <option value="">Seciniz</option>
                        {fabricOrders.map((order) => (
                          <option key={order.id} value={order.id}>
                            {order.orderNumber} - {order.fabricName} / {order.colorName} (Kalan:{" "}
                            {order.remainingQuantity} {order.unitType})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={styles.label}>
                      Musteri Siparis No
                      <input
                        name="orderNo"
                        value={form.orderNo}
                        onChange={handleFormChange}
                        style={styles.input}
                      />
                    </label>
                    <label style={styles.label}>
                      Kumas
                      <select name="fabricId" value={form.fabricId} onChange={handleFormChange} style={styles.input} required>
                        <option value="">Seciniz</option>
                        {fabrics.map((fabric) => (
                          <option key={fabric.id} value={fabric.id}>
                            {fabric.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={styles.label}>
                      Renk
                      <select name="colorId" value={form.colorId} onChange={handleFormChange} style={styles.input} required>
                        <option value="">Seciniz</option>
                        {colors.map((color) => (
                          <option key={color.id} value={color.id}>
                            {color.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={styles.label}>
                      Miktar
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
                    </label>
                    <label style={styles.label}>
                      Birim
                      <select name="unitType" value={form.unitType} onChange={handleFormChange} style={styles.input}>
                        <option value="kg">kg</option>
                        <option value="m">m</option>
                      </select>
                    </label>
                  </div>
                </section>

                <section style={styles.formSection}>
                  <span style={styles.sectionLegend}>Cari ve Depo Bilgileri</span>
                  <div style={styles.sectionGrid}>
                    <label style={styles.label}>
                      Cari Hesap Kodu
                      <input
                        name="supplierCode"
                        value={form.supplierCode}
                        onChange={handleFormChange}
                        style={styles.input}
                      />
                    </label>
                    <label style={{ ...styles.label, ...styles.sectionSpan2 }}>
                      Cari Hesap Adi
                      <input
                        name="supplierName"
                        value={form.supplierName}
                        onChange={handleFormChange}
                        style={styles.input}
                      />
                    </label>
                    <label style={styles.label}>
                      Giris Depo
                      <input
                        name="entryWarehouseCode"
                        value={form.entryWarehouseCode}
                        onChange={handleFormChange}
                        style={styles.input}
                      />
                    </label>
                    <label style={styles.label}>
                      Cikis Depo
                      <input
                        name="exitWarehouseCode"
                        value={form.exitWarehouseCode}
                        onChange={handleFormChange}
                        style={styles.input}
                      />
                    </label>
                    <label style={styles.label}>
                      Toplam Tutar
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name="total"
                        value={form.total}
                        onChange={handleFormChange}
                        style={styles.input}
                        required
                      />
                    </label>
                  </div>
                </section>

                <section style={styles.formSection}>
                  <span style={styles.sectionLegend}>Entegrasyon ve Ozet</span>
                  <div style={styles.integrationGrid}>
                    <div style={styles.integrationCard}>
                      <span style={styles.integrationLabel}>Belge No</span>
                      <strong style={styles.integrationValue}>{form.documentNumber || "-"}</strong>
                    </div>
                    <div style={styles.integrationCard}>
                      <span style={styles.integrationLabel}>FG No</span>
                      <strong style={styles.integrationValue}>{form.fgNumber || "-"}</strong>
                    </div>
                    <div style={styles.integrationCard}>
                      <span style={styles.integrationLabel}>Cari</span>
                      <strong style={styles.integrationValue}>{form.supplierCode || "-"}</strong>
                    </div>
                    <div style={styles.integrationCard}>
                      <span style={styles.integrationLabel}>Durum</span>
                      <strong style={styles.integrationValue}>
                        {form.id ? "Guncellenecek" : "Yeni Kayit"}
                      </strong>
                    </div>
                  </div>

                  {selectedOrder ? (
                    <div style={styles.orderInfo}>
                      Secili siparis: {selectedOrder.orderNumber} | Miktar: {selectedOrder.quantity}{" "}
                      {selectedOrder.unitType} | Gelen: {selectedOrder.receivedQuantity}{" "}
                      {selectedOrder.unitType} | Kalan: {selectedOrder.remainingQuantity}{" "}
                      {selectedOrder.unitType}
                    </div>
                  ) : null}

                  <div style={styles.previewTableWrap}>
                    <table style={styles.previewTable}>
                      <thead>
                        <tr>
                          <th style={styles.previewTh}>Tip</th>
                          <th style={styles.previewTh}>Kumas</th>
                          <th style={styles.previewTh}>Renk</th>
                          <th style={{ ...styles.previewTh, ...styles.right }}>Miktar</th>
                          <th style={styles.previewTh}>Birim</th>
                          <th style={{ ...styles.previewTh, ...styles.right }}>Tutar</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={styles.previewTd}>Malzeme</td>
                          <td style={styles.previewTd}>
                            {selectedOrder?.fabricName || selectedFabric?.name || "-"}
                          </td>
                          <td style={styles.previewTd}>
                            {selectedOrder?.colorName || selectedColor?.name || "-"}
                          </td>
                          <td style={{ ...styles.previewTd, ...styles.right }}>
                            {Number.isFinite(Number(form.quantity))
                              ? numberFormatter.format(Number(form.quantity))
                              : "-"}
                          </td>
                          <td style={styles.previewTd}>{form.unitType}</td>
                          <td style={{ ...styles.previewTd, ...styles.right }}>
                            {Number.isFinite(Number(form.total))
                              ? numberFormatter.format(Number(form.total))
                              : "-"}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>

              <div style={styles.modalActions}>
                <button type="button" style={styles.secondaryBtn} onClick={() => setShowForm(false)}>
                  Vazgec
                </button>
                <button type="submit" style={styles.primaryBtn} disabled={saving}>
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
  page: { padding: "24px", background: "linear-gradient(180deg, #f7faf8 0%, #eef4f8 100%)", minHeight: "100vh", fontFamily: "'Segoe UI', Tahoma, sans-serif" },
  hero: { border: "1px solid #d9e5eb", borderRadius: "16px", padding: "18px", background: "#fff", marginBottom: "12px", display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" },
  title: { margin: 0, fontSize: "1.5rem", color: "#102b3b" },
  subtitle: { margin: "6px 0 0", color: "#46606d", fontSize: "0.92rem" },
  statRow: { display: "flex", gap: "8px", flexWrap: "wrap" },
  statBox: { minWidth: "110px", border: "1px solid #d8e6ee", borderRadius: "10px", padding: "8px 10px", display: "flex", flexDirection: "column", background: "#fbfeff" },
  statLabel: { fontSize: "0.74rem", color: "#597684", textTransform: "uppercase" },
  errorBox: { background: "#fff2f2", border: "1px solid #fecaca", borderRadius: "10px", color: "#b91c1c", padding: "9px 11px", marginBottom: "10px", fontWeight: 700 },
  panel: { border: "1px solid #d9e5eb", borderRadius: "16px", background: "#fff", padding: "12px" },
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "10px" },
  tabs: { display: "flex", gap: "8px", flexWrap: "wrap" },
  tabBtn: { border: "1px solid #c8d8e0", borderRadius: "999px", background: "#f8fcff", color: "#295466", minHeight: "36px", padding: "0 12px", fontWeight: 700, cursor: "pointer" },
  tabBtnActive: { background: "linear-gradient(120deg, #22c55e, #16a34a)", borderColor: "#15803d", color: "#fff" },
  searchInput: { width: "100%", minHeight: "40px", borderRadius: "10px", border: "1px solid #c4d8e3", padding: "0 10px", marginBottom: "10px" },
  tableWrap: { border: "1px solid #d4e2ea", borderRadius: "12px", overflow: "auto", maxHeight: "calc(100vh - 300px)" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: "1400px" },
  th: { position: "sticky", top: 0, zIndex: 2, background: "#eef5f9", borderBottom: "1px solid #d4e2ea", padding: "10px", textAlign: "left", fontSize: "0.78rem", textTransform: "uppercase", color: "#325363", whiteSpace: "nowrap" },
  td: { borderBottom: "1px solid #edf3f6", padding: "10px", fontSize: "0.88rem", color: "#16323f", whiteSpace: "nowrap" },
  emptyCell: { padding: "32px", textAlign: "center", color: "#5f7a88", fontSize: "0.9rem" },
  right: { textAlign: "right" },
  actionRow: { display: "flex", gap: "8px" },
  linkBtn: { border: "1px solid #bfd4df", background: "#f9fcfd", color: "#245064", borderRadius: "7px", minHeight: "28px", padding: "0 9px", fontSize: "0.8rem", cursor: "pointer", fontWeight: 700 },
  linkBtnDanger: { border: "1px solid #fbc6ce", background: "#fff5f6", color: "#be123c", borderRadius: "7px", minHeight: "28px", padding: "0 9px", fontSize: "0.8rem", cursor: "pointer", fontWeight: 700 },
  primaryBtn: { border: "1px solid #15803d", background: "linear-gradient(120deg, #22c55e, #16a34a)", color: "#fff", borderRadius: "9px", minHeight: "36px", padding: "0 12px", fontWeight: 700, cursor: "pointer" },
  secondaryBtn: { border: "1px solid #c7d8e1", background: "#fff", color: "#335766", borderRadius: "9px", minHeight: "36px", padding: "0 12px", fontWeight: 700, cursor: "pointer" },
  contextMenu: { position: "fixed", border: "1px solid #d2e1e8", background: "#fff", borderRadius: "8px", minWidth: "130px", padding: "5px", display: "flex", flexDirection: "column", gap: "4px", zIndex: 150, boxShadow: "0 10px 20px -12px rgba(15, 23, 42, 0.6)" },
  contextBtn: { border: "none", background: "#f7fafc", color: "#244b5d", borderRadius: "7px", minHeight: "30px", padding: "0 9px", textAlign: "left", fontWeight: 700, cursor: "pointer" },
  contextBtnDanger: { background: "#fff1f2", color: "#be123c" },
  contextBtnDisabled: { opacity: 0.45, cursor: "not-allowed" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(3,20,33,0.45)", display: "flex", justifyContent: "center", alignItems: "center", padding: "12px", zIndex: 200 },
  modalCard: { width: "100%", maxWidth: "1120px", maxHeight: "95vh", overflowY: "auto", border: "1px solid #c9d8e2", borderRadius: "12px", background: "#f6fafc", boxShadow: "0 30px 60px -35px rgba(15, 23, 42, 0.9)" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "14px 14px 10px", borderBottom: "1px solid #dce8ef", background: "linear-gradient(120deg, #e6f4ea, #ecf4fb)" },
  modalTitle: { margin: 0, color: "#103142", fontSize: "1.05rem" },
  modalSubtitle: { margin: "4px 0 0", color: "#4a6472", fontSize: "0.82rem" },
  modalHeaderMeta: { display: "flex", alignItems: "center", gap: "8px" },
  modalBadge: { border: "1px solid #b9d6c4", background: "#eaf8f0", color: "#0f5132", borderRadius: "999px", minHeight: "28px", display: "inline-flex", alignItems: "center", padding: "0 10px", fontSize: "0.76rem", fontWeight: 700 },
  formTabs: { display: "flex", gap: "6px", padding: "8px 14px", borderBottom: "1px solid #dde8ef", background: "#f9fcfe", flexWrap: "wrap" },
  formTab: { border: "1px solid #cad9e3", background: "#ffffff", borderRadius: "8px 8px 0 0", color: "#446170", fontSize: "0.78rem", fontWeight: 700, padding: "5px 10px", minWidth: "120px", textAlign: "center" },
  formTabActive: { borderColor: "#6abf8f", color: "#0f5132", background: "linear-gradient(120deg, #f4fff8, #eefcf5)" },
  formError: { margin: "10px 14px 0", border: "1px solid #fecaca", background: "#fff2f2", borderRadius: "9px", color: "#b91c1c", fontSize: "0.85rem", fontWeight: 700, padding: "8px 9px" },
  erpForm: { display: "flex", flexDirection: "column", gap: "10px", padding: "0 14px 14px" },
  formBody: { display: "grid", gap: "10px", marginTop: "2px" },
  formSection: { position: "relative", border: "1px solid #d0dde7", borderRadius: "10px", background: "#ffffff", padding: "14px 10px 10px" },
  sectionLegend: { position: "absolute", top: "-9px", left: "10px", background: "#f6fafc", color: "#2f4f60", padding: "0 6px", fontSize: "0.75rem", fontWeight: 700 },
  sectionGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "10px" },
  sectionSpan2: { gridColumn: "span 2" },
  label: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "0.76rem", color: "#355464", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em" },
  input: { width: "100%", minHeight: "35px", borderRadius: "7px", border: "1px solid #c3d4df", padding: "0 10px", fontSize: "0.86rem", color: "#153342", background: "#fbfeff" },
  integrationGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px" },
  integrationCard: { border: "1px solid #d0deea", background: "linear-gradient(180deg, #f8fcff, #f2f8fc)", borderRadius: "8px", padding: "8px 9px", display: "flex", flexDirection: "column", gap: "4px" },
  integrationLabel: { fontSize: "0.7rem", color: "#5a7483", textTransform: "uppercase", letterSpacing: "0.04em" },
  integrationValue: { fontSize: "0.84rem", color: "#163848", fontWeight: 700 },
  orderInfo: { marginTop: "8px", border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: "8px", padding: "8px 9px", fontSize: "0.82rem", fontWeight: 700 },
  previewTableWrap: { marginTop: "8px", border: "1px solid #d2dde6", borderRadius: "8px", overflowX: "auto" },
  previewTable: { width: "100%", borderCollapse: "collapse", minWidth: "540px", background: "#fff" },
  previewTh: { background: "#edf3f8", color: "#29485a", fontSize: "0.74rem", textTransform: "uppercase", letterSpacing: "0.03em", padding: "7px 8px", borderBottom: "1px solid #d2dde6", textAlign: "left" },
  previewTd: { padding: "8px", borderBottom: "1px solid #ecf2f6", fontSize: "0.84rem", color: "#173746", whiteSpace: "nowrap" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "2px", paddingTop: "10px", borderTop: "1px solid #dce8ef" },
};
