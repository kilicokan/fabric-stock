import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";

type PlanningRow = {
  id: number;
  orderNo: string;
  modelNo: string;
  customerId: string;
  color: string;
  fabricType: string;
  tableName: string;
  reportNumber: string;
  fabricWidth: number | null;
  quantityKg: number;
  quantityMeter: number;
  layerCount: number;
  outputQuantity: number;
  divideBy: "kg" | "meter";
  actualGrammage: number;
  targetGrammage: number;
  grammageStatus: string;
  cuttingWastePercent: number;
  cuttingWasteGramaj: number;
  planKat: number;
  createdAt: string;
  totalOrderQuantity: number;
  sizeDistribution: string;
};

type SortKey =
  | "orderNo" | "modelNo" | "customerId" | "color" | "fabricType"
  | "tableName" | "reportNumber" | "fabricWidth" | "quantityKg"
  | "quantityMeter" | "layerCount" | "outputQuantity" | "actualGrammage"
  | "targetGrammage" | "grammageStatus" | "cuttingWastePercent"
  | "planKat" | "sizeDistribution";

type SortDirection = "asc" | "desc";

type WorkOrderSource = {
  orderNo?: string;
  modelNo?: string;
  productCode?: string;
  productName?: string;
  productColor?: string | null;
  customerName?: string;
  quantity?: number;
  sewingNotes?: string | null;
  createdAt?: string;
};

type ProductSource = {
  modelNo?: string;
  averageGrammage?: number | null;
  fabric?: {
    name?: string;
    width?: number | null;
    averageGrammage?: number | null;
  } | null;
};

type ApiResponse<T> = { data?: T };

type ExitApiRow = {
  id?: number;
  fabricType?: string;
  productWeightKg?: number;
  productLengthMeter?: number;
  createdAt?: string;
  modelNo?: string;
  orderNo?: string;
  customerId?: string;
  color?: string;
  layerCount?: number;
  fabricWidth?: number | null;
  reportNumber?: string | null;
  grammage?: number | null;
  plannedLayers?: string | null;
  actualLayers?: string | null;
  unitType?: string;
  cuttingTable?: { name?: string };
  fabricEntry?: { fabric?: { name?: string; width?: number | null; averageGrammage?: number | null } };
};

const getAuthHeaders = (): { Authorization: string } | undefined => {
  if (typeof window === "undefined") return undefined;
  const token = window.localStorage.getItem("token") || window.localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};

const parseSewingNotesForSizes = (notes?: string | null): string => {
  if (!notes) return "-";
  const trimmed = notes.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
      if (Array.isArray(parsed.sizeChart) && parsed.sizeChart.length > 0) {
        const sizes = parsed.sizeChart.map((item: any) => item.size).filter(Boolean).join(" ");
        if (sizes) return `Asorti: ${sizes}`;
      }
      if (parsed.asortiCount) return `Asorti: ${parsed.asortiCount} beden`;
      if (parsed.cuttingReport?.asortiCount) return `Asorti: ${parsed.cuttingReport.asortiCount} beden`;
    }
  } catch { /* JSON değil */ }

  const slashMatch = trimmed.match(/^(\d+)\s*\/\s*(.+)$/);
  if (slashMatch) {
    const sizes = slashMatch[2].split(/[\s,]+/).map((p) => p.trim()).filter(Boolean);
    if (sizes.length) return `${slashMatch[1]} / ${sizes.join(" ")}`;
  }
  return trimmed;
};

/* ---------- Kolon tanımları ---------- */
const sortableHeaders: Array<{ key: SortKey; label: string }> = [
  { key: "orderNo", label: "Sipariş No" },
  { key: "modelNo", label: "Model No" },
  { key: "customerId", label: "Müşteri" },
  { key: "color", label: "Renk" },
  { key: "fabricType", label: "Kumaş Tipi" },
  { key: "tableName", label: "Masa" },
  { key: "reportNumber", label: "Çıkış Belge No" },
  { key: "fabricWidth", label: "Kumaş Eni" },
  { key: "quantityKg", label: "Miktar (kg)" },
  { key: "quantityMeter", label: "Miktar (metre)" },
  { key: "layerCount", label: "Kat Sayısı" },
  { key: "outputQuantity", label: "Çıkan Adet" },
  { key: "actualGrammage", label: "Fiili Gramaj" },
  { key: "targetGrammage", label: "Hedef Gramaj" },
  { key: "grammageStatus", label: "Gramaj Durumu" },
  { key: "cuttingWastePercent", label: "Kesim Firesi" },
  { key: "planKat", label: "Plan Kat" },
  { key: "sizeDistribution", label: "Asorti / Beden" },
];

const allColumnDefs: Array<{ key: string; label: string; sortable: boolean }> = [
  ...sortableHeaders.map((h) => ({ key: h.key, label: h.label, sortable: true })),
  { key: "totalOrderQuantity", label: "Toplam Adet", sortable: false },
  { key: "divideBy", label: "Bölünecek Birim", sortable: false },
];

/* ---------- CSS (hover, animasyon, focus) ---------- */
const cssText = `
  .fs-table-row { transition: background-color 0.12s ease; }
  .fs-table-row:hover { background-color: rgba(37,99,235,0.05) !important; }
  .fs-th { user-select: none; transition: background-color 0.12s ease; }
  .fs-th:hover { background-color: #e2e8f0 !important; }
  .fs-btn { transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease; }
  .fs-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(15,23,42,0.12); }
  .fs-btn:active:not(:disabled) { transform: translateY(0); }
  .fs-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .fs-input:focus { outline: 2px solid #93c5fd; outline-offset: 1px; border-color: #60a5fa; }
  .fs-checkbox { width: 16px; height: 16px; accent-color: #2563eb; cursor: pointer; }
  .fs-stat-card { transition: transform 0.18s ease, box-shadow 0.18s ease; }
  .fs-stat-card:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(15,23,42,0.08); }
  .fs-resizer { transition: opacity 0.12s ease, background 0.12s ease; opacity: 0.25; }
  .fs-resizer:hover { opacity: 1; background: #2563eb; }
  .fs-spinner {
    width: 30px; height: 30px; border: 3px solid #e2e8f0;
    border-top-color: #2563eb; border-radius: 50%;
    animation: fs-spin 0.8s linear infinite; margin: 0 auto 10px;
  }
  @keyframes fs-spin { to { transform: rotate(360deg); } }
  .fs-collapse { overflow: hidden; transition: max-height 0.25s ease, opacity 0.2s ease; }
`;

/* ---------- Stiller ---------- */
const ui = {
  page: {
    width: "100%",
    maxWidth: "100%",
    minHeight: "100vh",
    margin: 0,
    padding: "24px",
    background: "var(--fs-color-bg, #f8fafc)",
    color: "var(--fs-color-text, #0f172a)",
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
    boxSizing: "border-box" as const,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "20px",
    flexWrap: "wrap" as const,
  },
  headerTitleWrap: { display: "flex", flexDirection: "column" as const, gap: "2px" },
  title: { margin: 0, fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.02em" },
  subtitle: { margin: 0, fontSize: "0.85rem", color: "var(--fs-color-text-muted, #64748b)" },
  btnRow: { display: "flex", gap: "8px", flexWrap: "wrap" as const },
  primaryBtn: {
    minHeight: "40px",
    borderRadius: "10px",
    border: "1px solid #93c5fd",
    background: "#eff6ff",
    color: "var(--fs-color-primary-strong, #1d4ed8)",
    padding: "0 16px",
    fontWeight: 700,
    fontSize: "0.88rem",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
  } as const,
  dangerBtn: {
    minHeight: "40px",
    borderRadius: "10px",
    border: "1px solid #fecaca",
    background: "#fee2e2",
    color: "var(--fs-color-danger, #b91c1c)",
    padding: "0 16px",
    fontWeight: 700,
    fontSize: "0.88rem",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
  } as const,
  ghostBtn: {
    minHeight: "40px",
    borderRadius: "10px",
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    color: "#334155",
    padding: "0 16px",
    fontWeight: 600,
    fontSize: "0.88rem",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
  } as const,
  /* Özet kartları */
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
    marginBottom: "16px",
  },
  statCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
    boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
  },
  statLabel: { fontSize: "0.75rem", color: "#64748b", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" as const },
  statValue: { fontSize: "1.35rem", fontWeight: 800, color: "#0f172a", lineHeight: 1.1 },
  statHint: { fontSize: "0.72rem", color: "#94a3b8" },
  /* Filtre kartı */
  filterCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    background: "#ffffff",
    padding: "16px",
    marginBottom: "16px",
    boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
  },
  filterHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
    flexWrap: "wrap" as const,
    gap: "8px",
  },
  filterTitle: { fontWeight: 700, fontSize: "0.92rem", color: "#0f172a" },
  filterGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
  },
  label: { display: "block", fontSize: "0.78rem", marginBottom: "5px", color: "#475569", fontWeight: 700, letterSpacing: "0.01em" },
  input: {
    width: "100%",
    minHeight: "40px",
    padding: "8px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    background: "#f8fafc",
    color: "#0f172a",
    fontSize: "0.9rem",
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
  },
  rangeRow: { display: "flex", gap: "8px" },
  /* Kolon yöneticisi */
  columnManager: {
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    background: "#ffffff",
    padding: "12px 16px",
    marginBottom: "16px",
    boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
  },
  columnManagerHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap" as const,
    gap: "8px",
  },
  columnManagerTitle: { fontWeight: 700, fontSize: "0.92rem", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" },
  columnManagerBtn: {
    minHeight: "32px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    color: "#334155",
    padding: "0 12px",
    fontWeight: 600,
    fontSize: "0.8rem",
    cursor: "pointer",
  } as const,
  columnManagerList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: "8px",
    marginTop: "12px",
    paddingTop: "12px",
    borderTop: "1px dashed #e2e8f0",
  },
  columnManagerItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "0.86rem",
    color: "#334155",
    cursor: "pointer",
    padding: "4px 6px",
    borderRadius: "8px",
  },
  /* Tablo */
  tableCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    background: "#ffffff",
    overflow: "hidden",
    boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
  },
  tableScroll: {
    overflow: "auto",
    maxHeight: "calc(100vh - 380px)",
    minHeight: "240px",
  },
  table: {
    width: "100%",
    borderCollapse: "separate" as const,
    borderSpacing: 0,
    minWidth: "1400px",
    tableLayout: "fixed" as const,
  },
  th: {
    position: "sticky" as const,
    top: 0,
    zIndex: 2,
    padding: "11px 12px",
    background: "#f1f5f9",
    borderBottom: "1px solid #e2e8f0",
    borderRight: "1px solid #e2e8f0",
    color: "#475569",
    fontSize: "0.74rem",
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    textAlign: "left" as const,
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
  td: {
    padding: "10px 12px",
    borderBottom: "1px solid #f1f5f9",
    borderRight: "1px solid #f1f5f9",
    fontSize: "0.88rem",
    color: "#0f172a",
    whiteSpace: "nowrap" as const,
    verticalAlign: "middle" as const,
  },
  tdCenter: { textAlign: "center" as const, color: "#64748b" },
  badgeMain: { padding: "3px 10px", borderRadius: "999px", background: "#eef2ff", color: "#3730a3", fontWeight: 700, fontSize: "0.76rem" },
  badgeKg: { padding: "3px 9px", borderRadius: "8px", background: "#ecfdf5", color: "#047857", fontWeight: 700, fontSize: "0.78rem" },
  badgeM: { padding: "3px 9px", borderRadius: "8px", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, fontSize: "0.78rem" },
  summary: {
    padding: "10px 16px",
    background: "#f8fafc",
    color: "#475569",
    fontSize: "0.84rem",
    borderTop: "1px solid #e2e8f0",
    fontWeight: 600,
  },
};

const getSortValue = (row: PlanningRow, key: SortKey): string | number => {
  switch (key) {
    case "fabricType": return row.fabricType || "";
    case "tableName": return row.tableName || "";
    case "quantityKg": return row.quantityKg;
    case "quantityMeter": return row.quantityMeter;
    case "layerCount": return row.layerCount;
    case "fabricWidth": return row.fabricWidth ?? 0;
    case "outputQuantity": return row.outputQuantity;
    case "actualGrammage": return row.actualGrammage;
    case "targetGrammage": return row.targetGrammage;
    case "grammageStatus": return row.grammageStatus || "";
    case "cuttingWastePercent": return row.cuttingWastePercent;
    case "planKat": return row.planKat;
    case "sizeDistribution": return row.sizeDistribution || "";
    case "orderNo": return row.orderNo || "";
    case "modelNo": return row.modelNo || "";
    case "customerId": return row.customerId || "";
    case "color": return row.color || "";
    case "reportNumber": return row.reportNumber || "";
    default: return "";
  }
};

/* Küçük yardımcı */
const fmt = (n: number, digits = 0) =>
  Number.isFinite(n) ? n.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "-";

export default function FabricsPlanningPage() {
  const [rows, setRows] = useState<PlanningRow[]>([]);
  const [filteredRows, setFilteredRows] = useState<PlanningRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Set<number>>(new Set());
  const [showColumns, setShowColumns] = useState(false);
  const [filters, setFilters] = useState({
    fabricType: "",
    tableName: "",
    minKg: "",
    maxKg: "",
    minMeter: "",
    maxMeter: "",
    startDate: "",
    endDate: "",
  });
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    allColumnDefs.forEach((c) => { initial[c.key] = true; });
    return initial;
  });
  const resizeState = useRef<{ key: string; startX: number; startWidth: number } | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey | ""; direction: SortDirection }>({
    key: "",
    direction: "asc",
  });
  const tableRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [exitRes, orderRes, productRes] = await Promise.all([
        axios.get<ExitApiRow[]>("/api/fabric-exits"),
        axios.get<ApiResponse<WorkOrderSource[]>>("/api/fason/work-orders?limit=500").catch(() => ({ data: { data: [] } })),
        axios.get<ProductSource[]>("/api/products", { headers: getAuthHeaders() }).catch(() => ({ data: [] })),
      ]);

      const exits = (Array.isArray(exitRes.data) ? exitRes.data : []).filter((item): item is ExitApiRow => item != null);
      const orders = Array.isArray(orderRes.data?.data) ? orderRes.data.data : [];
      const products = Array.isArray(productRes.data) ? productRes.data : [];
      const productMap = new Map<string, ProductSource>();
      products.forEach((product) => {
        const modelNo = product.modelNo?.trim();
        if (modelNo) productMap.set(modelNo.toLowerCase(), product);
      });
      const orderMap = new Map<string, WorkOrderSource>();
      orders.forEach((order) => {
        const keys = [order.orderNo, order.modelNo, order.productCode]
          .map((value) => value?.trim())
          .filter((value): value is string => Boolean(value));
        keys.forEach((key) => orderMap.set(key.toLowerCase(), order));
      });

      const mapped: PlanningRow[] = exits.map((item, index) => {
        const quantityKg = Number(item.productWeightKg || 0);
        const quantityMeter = Number(item.productLengthMeter || 0);
        const layerCount = Number(item.layerCount || 0);
        const fabricType = item.fabricType || item.fabricEntry?.fabric?.name || "Bilinmiyor";
        const tableName = item.cuttingTable?.name || "Bilinmiyor";

        const unit: "kg" | "meter" = quantityMeter > 0 && quantityKg === 0 ? "meter" : "kg";
        const numerator = unit === "kg" ? quantityKg : quantityMeter;
        const outputQuantity = layerCount > 0 && numerator > 0 ? Math.round(layerCount * numerator) : 0;
        const actualGrammage = Number(item.grammage || 0);
        const planKat = Number(item.plannedLayers || layerCount || 0);

        const orderKey = (item.orderNo || item.modelNo || "").trim().toLowerCase();
        const workOrder = orderMap.get(orderKey);
        const product = productMap.get(
          (item.modelNo || workOrder?.productCode || workOrder?.modelNo || "").trim().toLowerCase()
        );
        const totalOrderQuantity = Number(workOrder?.quantity || 0);
        const parsedSewing = workOrder?.sewingNotes ? parseSewingNotesForSizes(workOrder.sewingNotes) : null;
        const targetGrammage = Number(product?.averageGrammage ?? item.fabricEntry?.fabric?.averageGrammage ?? 0);
        const grammageStatus =
          actualGrammage > 0 && targetGrammage > 0
            ? Math.abs(actualGrammage - targetGrammage) <= targetGrammage * 0.05
              ? "Hedef tuttu"
              : "Hedef dışı"
            : "Bekleniyor";
        const cuttingWastePercent =
          targetGrammage > 0 && actualGrammage > 0
            ? Math.max(0, ((targetGrammage - actualGrammage) / targetGrammage) * 100)
            : 0;
        const cuttingWasteGramaj = targetGrammage > 0 && actualGrammage > 0 ? targetGrammage - actualGrammage : 0;

        return {
          id: item.id || index + 1,
          orderNo: item.orderNo || workOrder?.orderNo || "-",
          modelNo: item.modelNo || workOrder?.modelNo || "-",
          customerId: item.customerId || workOrder?.customerName || "-",
          color: item.color || workOrder?.productColor || "-",
          fabricType,
          tableName,
          reportNumber: item.reportNumber || "-",
          fabricWidth: item.fabricEntry?.fabric?.width ?? item.fabricWidth ?? null,
          quantityKg,
          quantityMeter,
          layerCount,
          outputQuantity,
          divideBy: unit,
          actualGrammage,
          targetGrammage,
          grammageStatus,
          cuttingWastePercent,
          cuttingWasteGramaj,
          planKat,
          createdAt: item.createdAt || workOrder?.createdAt || "",
          totalOrderQuantity,
          sizeDistribution: parsedSewing || "-",
        };
      });

      setRows(mapped);
      setFilteredRows(mapped);
    } catch (error) {
      console.error("Veri alınamadı:", error);
      setRows([]);
      setFilteredRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  useEffect(() => {
    let result = rows.filter((row) => {
      return (
        (filters.fabricType === "" || row.fabricType.toLowerCase().includes(filters.fabricType.toLowerCase())) &&
        (filters.tableName === "" || row.tableName.toLowerCase().includes(filters.tableName.toLowerCase())) &&
        (filters.minKg === "" || row.quantityKg >= Number(filters.minKg)) &&
        (filters.maxKg === "" || row.quantityKg <= Number(filters.maxKg)) &&
        (filters.minMeter === "" || row.quantityMeter >= Number(filters.minMeter)) &&
        (filters.maxMeter === "" || row.quantityMeter <= Number(filters.maxMeter)) &&
        (filters.startDate === "" || new Date(row.createdAt) >= new Date(filters.startDate)) &&
        (filters.endDate === "" || new Date(row.createdAt) <= new Date(filters.endDate))
      );
    });

    if (sortConfig?.key) {
      const sortKey = sortConfig.key as SortKey;
      result = [...result].sort((a, b) => {
        const aValue = getSortValue(a, sortKey);
        const bValue = getSortValue(b, sortKey);
        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    setFilteredRows(result);
  }, [rows, filters, sortConfig]);

  /* Özet istatistikler */
  const stats = useMemo(() => {
    const total = filteredRows.length;
    const totalKg = filteredRows.reduce((s, r) => s + (r.quantityKg || 0), 0);
    const totalMeter = filteredRows.reduce((s, r) => s + (r.quantityMeter || 0), 0);
    const totalOutput = filteredRows.reduce((s, r) => s + (r.outputQuantity || 0), 0);
    const onTarget = filteredRows.filter((r) => r.grammageStatus === "Hedef tuttu").length;
    const ratio = total > 0 ? (onTarget / total) * 100 : 0;
    return { total, totalKg, totalMeter, totalOutput, onTarget, ratio };
  }, [filteredRows]);

  const handleFilterChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleOutputChange = (id: number, value: number) => {
    setRows((prev) =>
      prev.map((row) => (row.id !== id ? row : { ...row, outputQuantity: value }))
    );
  };

  const handleDivideByChange = (id: number, value: "kg" | "meter") => {
    setRows((prev) =>
      prev.map((row) => (row.id !== id ? row : { ...row, divideBy: value }))
    );
  };

  const handleSaveRow = async (row: PlanningRow) => {
    if (!row.id || row.id === 0) return;
    const layerCount = Number(row.layerCount || 1);
    const quantity = layerCount > 0 ? row.outputQuantity / layerCount : row.outputQuantity;
    const body: Record<string, unknown> = { layerCount };

    if (row.divideBy === "kg") {
      body.productionKg = quantity;
      body.unitType = "kg";
    } else {
      body.productionMeters = quantity;
      body.unitType = "m";
    }

    setSaving((prev) => new Set([...prev, row.id!]));
    try {
      await axios.put(`/api/fabric-exits/${row.id}`, body);
      void fetchData();
    } catch (error) {
      console.error("Save error:", error);
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(row.id!);
        return next;
      });
    }
  };

  const handleSort = (key: SortKey) => {
    const direction: SortDirection = sortConfig?.key === key && sortConfig?.direction === "asc" ? "desc" : "asc";
    setSortConfig({ key, direction });
  };

  const resetFilters = () => {
    setFilters({
      fabricType: "", tableName: "", minKg: "", maxKg: "",
      minMeter: "", maxMeter: "", startDate: "", endDate: "",
    });
    setSortConfig({ key: "", direction: "asc" });
  };

  const handleResizeStart = (key: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget as HTMLElement;
    const th = handle.parentElement as HTMLElement | null;
    if (!th) return;
    const startWidth = th.getBoundingClientRect().width;
    resizeState.current = { key, startX: event.clientX, startWidth };
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeState.current?.key) return;
      const diff = moveEvent.clientX - resizeState.current.startX;
      const newWidth = Math.max(60, resizeState.current.startWidth + diff);
      setColumnWidths((prev) => ({ ...prev, [resizeState.current!.key]: newWidth }));
    };
    const handleMouseUp = () => {
      resizeState.current = null;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const getColumnWidth = (key: string, fallback: number) => columnWidths[key] ?? fallback;

  const exportToExcel = () => {
    const exportData = filteredRows.map((row) => ({
      SiparişNo: row.orderNo,
      ModelNo: row.modelNo,
      Müşteri: row.customerId,
      Renk: row.color,
      KumaşTipi: row.fabricType,
      Masa: row.tableName,
      ÇıkışBelgeNo: row.reportNumber,
      KumaşEni: row.fabricWidth ? `${row.fabricWidth} cm` : "-",
      MiktarKg: row.quantityKg,
      MiktarMetre: row.quantityMeter,
      KatSayısı: row.layerCount,
      ÇıkanAdet: row.outputQuantity,
      FiiliGramaj: Number(row.actualGrammage.toFixed(1)),
      HedefGramaj: Number(row.targetGrammage.toFixed(1)),
      GramajDurumu: row.grammageStatus,
      KesimFiresi: Number(row.cuttingWastePercent.toFixed(1)),
      PlanKat: row.planKat,
      AsortiBeden: row.sizeDistribution,
      ToplamAdet: row.totalOrderQuantity,
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kesim Raporu");
    XLSX.writeFile(workbook, "kesim_raporu.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.text("Kesim Raporu", 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Oluşturulma Tarihi: ${new Date().toLocaleDateString("tr-TR")}`, 14, 22);
    doc.text(`Toplam Kayıt: ${filteredRows.length}`, 14, 28);

    const tableColumn = [
      "Sipariş No", "Model No", "Müşteri", "Renk", "Kumaş Tipi", "Masa",
      "Çıkış Belge No", "Kumaş Eni", "Miktar (kg)", "Miktar (metre)",
      "Kat Sayısı", "Çıkan Adet", "Fiili Gramaj", "Hedef Gramaj",
      "Gramaj Durumu", "Kesim Firesi", "Plan Kat", "Asorti / Beden", "Toplam Adet",
    ];
    const tableRows = filteredRows.map((row) => [
      row.orderNo, row.modelNo, row.customerId, row.color, row.fabricType, row.tableName,
      row.reportNumber, row.fabricWidth ? `${row.fabricWidth} cm` : "-",
      `${row.quantityKg} kg`, `${row.quantityMeter} m`,
      String(row.layerCount), String(row.outputQuantity),
      `${row.actualGrammage.toFixed(1)} g/m²`, `${row.targetGrammage.toFixed(1)} g/m²`,
      row.grammageStatus, `%${row.cuttingWastePercent.toFixed(1)}`,
      String(row.planKat), row.sizeDistribution, String(row.totalOrderQuantity),
    ]);

    const docWithTable = doc as jsPDF & {
      autoTable: (options: any) => void;
    };

    docWithTable.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    doc.save("kesim_raporu.pdf");
  };

  const grammageBadge = (status: string) => {
    const map: Record<string, { bg: string; color: string }> = {
      "Hedef tuttu": { bg: "#dcfce7", color: "#15803d" },
      "Hedef dışı": { bg: "#fee2e2", color: "#b91c1c" },
      "Bekleniyor": { bg: "#fef3c7", color: "#92400e" },
    };
    const s = map[status] ?? { bg: "#e2e8f0", color: "#475569" };
    return (
      <span style={{ padding: "3px 10px", borderRadius: "999px", background: s.bg, color: s.color, fontWeight: 700, fontSize: "0.76rem" }}>
        {status}
      </span>
    );
  };

  const visibleColCount = Object.values(visibleColumns).filter(Boolean).length;

  return (
    <div style={ui.page}>
      <style>{cssText}</style>

      {/* Başlık */}
      <div style={ui.header}>
        <div style={ui.headerTitleWrap}>
          <h1 style={ui.title}>Kesim Raporu</h1>
          <p style={ui.subtitle}>Kumaş çıkışları, gramaj takibi ve kesim firesi özeti</p>
        </div>
        <div style={ui.btnRow}>
          <button className="fs-btn" onClick={exportToExcel} style={ui.primaryBtn}>
            <span>📊</span> Excel&apos;e Aktar
          </button>
          <button className="fs-btn" onClick={exportToPDF} style={ui.dangerBtn}>
            <span>📄</span> PDF&apos;e Aktar
          </button>
        </div>
      </div>

      {/* Özet kartları */}
      <div style={ui.statsGrid}>
        <div className="fs-stat-card" style={ui.statCard}>
          <span style={ui.statLabel}>Toplam Kayıt</span>
          <span style={ui.statValue}>{fmt(stats.total)}</span>
          <span style={ui.statHint}>filtreye uyan kayıt sayısı</span>
        </div>
        <div className="fs-stat-card" style={ui.statCard}>
          <span style={ui.statLabel}>Toplam Kg</span>
          <span style={ui.statValue}>{fmt(stats.totalKg, 1)} kg</span>
          <span style={ui.statHint}>çıkış ağırlığı toplamı</span>
        </div>
        <div className="fs-stat-card" style={ui.statCard}>
          <span style={ui.statLabel}>Toplam Metre</span>
          <span style={ui.statValue}>{fmt(stats.totalMeter, 1)} m</span>
          <span style={ui.statHint}>çıkış uzunluğu toplamı</span>
        </div>
        <div className="fs-stat-card" style={ui.statCard}>
          <span style={ui.statLabel}>Toplam Çıkan Adet</span>
          <span style={ui.statValue}>{fmt(stats.totalOutput)}</span>
          <span style={ui.statHint}>kat × miktar</span>
        </div>
        <div className="fs-stat-card" style={ui.statCard}>
          <span style={ui.statLabel}>Hedef Tutan</span>
          <span style={{ ...ui.statValue, color: stats.ratio >= 70 ? "#15803d" : stats.ratio >= 40 ? "#b45309" : "#b91c1c" }}>
            {fmt(stats.ratio, 1)}%
          </span>
          <span style={ui.statHint}>{stats.onTarget} / {stats.total} kayıt</span>
        </div>
      </div>

      {/* Filtreler */}
      <div style={ui.filterCard}>
        <div style={ui.filterHeader}>
          <span style={ui.filterTitle}>🔎 Filtreler</span>
          <button className="fs-btn" onClick={resetFilters} style={ui.ghostBtn}>Filtreleri Sıfırla</button>
        </div>
        <div style={ui.filterGrid}>
          <div>
            <label style={ui.label}>Kumaş Tipi</label>
            <input className="fs-input" type="text" name="fabricType" value={filters.fabricType} onChange={handleFilterChange} placeholder="Kumaş tipi ara..." style={ui.input} />
          </div>
          <div>
            <label style={ui.label}>Masa Adı</label>
            <input className="fs-input" type="text" name="tableName" value={filters.tableName} onChange={handleFilterChange} placeholder="Masa adı ara..." style={ui.input} />
          </div>
          <div>
            <label style={ui.label}>Kg Aralığı</label>
            <div style={ui.rangeRow}>
              <input className="fs-input" type="number" name="minKg" value={filters.minKg} onChange={handleFilterChange} placeholder="Min" style={ui.input} />
              <input className="fs-input" type="number" name="maxKg" value={filters.maxKg} onChange={handleFilterChange} placeholder="Max" style={ui.input} />
            </div>
          </div>
          <div>
            <label style={ui.label}>Metre Aralığı</label>
            <div style={ui.rangeRow}>
              <input className="fs-input" type="number" name="minMeter" value={filters.minMeter} onChange={handleFilterChange} placeholder="Min" style={ui.input} />
              <input className="fs-input" type="number" name="maxMeter" value={filters.maxMeter} onChange={handleFilterChange} placeholder="Max" style={ui.input} />
            </div>
          </div>
          <div>
            <label style={ui.label}>Tarih Aralığı</label>
            <div style={ui.rangeRow}>
              <input className="fs-input" type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} style={ui.input} />
              <input className="fs-input" type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} style={ui.input} />
            </div>
          </div>
        </div>
      </div>

      {/* Kolon yönetimi (katlanabilir) */}
      <div style={ui.columnManager}>
        <div style={ui.columnManagerHeader}>
          <span style={ui.columnManagerTitle}>
            🧩 Kolon Yönetimi
            <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>
              ({visibleColCount}/{allColumnDefs.length} görünür)
            </span>
          </span>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" as const }}>
            <button className="fs-btn" onClick={() => setShowColumns((s) => !s)} style={ui.columnManagerBtn}>
              {showColumns ? "▲ Gizle" : "▼ Göster"}
            </button>
            <button
              className="fs-btn"
              onClick={() => setVisibleColumns(Object.fromEntries(allColumnDefs.map((c) => [c.key, true])))}
              style={ui.columnManagerBtn}
            >
              Tümünü Göster
            </button>
            <button
              className="fs-btn"
              onClick={() => setVisibleColumns(Object.fromEntries(allColumnDefs.map((c) => [c.key, false])))}
              style={ui.columnManagerBtn}
            >
              Tümünü Gizle
            </button>
          </div>
        </div>

        <div className="fs-collapse" style={{ maxHeight: showColumns ? 600 : 0, opacity: showColumns ? 1 : 0 }}>
          <div style={ui.columnManagerList}>
            {allColumnDefs.map((col) => (
              <label key={col.key} style={ui.columnManagerItem}>
                <input
                  className="fs-checkbox"
                  type="checkbox"
                  checked={visibleColumns[col.key] ?? true}
                  onChange={(e) => setVisibleColumns((prev) => ({ ...prev, [col.key]: e.target.checked }))}
                />
                <span>{col.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Tablo */}
      <div style={ui.tableCard} ref={tableRef}>
        <div style={ui.tableScroll}>
          <table style={ui.table}>
            <thead>
              <tr>
                {sortableHeaders.map((head) => {
                  if (!visibleColumns[head.key]) return null;
                  return (
                    <th
                      key={head.key}
                      className="fs-th"
                      onClick={() => handleSort(head.key)}
                      style={{
                        ...ui.th,
                        width: getColumnWidth(head.key, 140),
                        minWidth: 90,
                        maxWidth: 480,
                      }}
                    >
                      {head.label}
                      {sortConfig.key === head.key ? (sortConfig.direction === "asc" ? " ↑" : " ↓") : ""}
                      <span
                        className="fs-resizer"
                        onMouseDown={(e) => handleResizeStart(head.key, e)}
                        style={{
                          position: "absolute",
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: 6,
                          cursor: "col-resize",
                          background: "transparent",
                          borderRight: "2px solid rgba(100,116,139,0.4)",
                        }}
                      />
                    </th>
                  );
                })}
                {visibleColumns["totalOrderQuantity"] && (
                  <th className="fs-th" style={{ ...ui.th, width: getColumnWidth("totalOrderQuantity", 110), minWidth: 90 }}>
                    Toplam Adet
                    <span
                      className="fs-resizer"
                      onMouseDown={(e) => handleResizeStart("totalOrderQuantity", e)}
                      style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 6, cursor: "col-resize", background: "transparent", borderRight: "2px solid rgba(100,116,139,0.4)" }}
                    />
                  </th>
                )}
                {visibleColumns["divideBy"] && (
                  <th className="fs-th" style={{ ...ui.th, width: getColumnWidth("divideBy", 110), minWidth: 90, cursor: "default" }}>
                    Bölünecek Birim
                    <span
                      className="fs-resizer"
                      onMouseDown={(e) => handleResizeStart("divideBy", e)}
                      style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 6, cursor: "col-resize", background: "transparent", borderRight: "2px solid rgba(100,116,139,0.4)" }}
                    />
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={Math.max(visibleColCount, 1)} style={{ ...ui.td, ...ui.tdCenter, padding: "48px 16px" }}>
                    <div className="fs-spinner" />
                    <div>Veriler yükleniyor…</div>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(visibleColCount, 1)} style={{ ...ui.td, ...ui.tdCenter, padding: "48px 16px" }}>
                    <div style={{ fontSize: "2rem", marginBottom: 8 }}>🔍</div>
                    <div style={{ fontWeight: 700, color: "#334155", marginBottom: 4 }}>Kayıt bulunamadı</div>
                    <div style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Filtreleme kriterlerinize uygun kayıt yok.</div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, index) => (
                  <tr
                    key={row.id}
                    className="fs-table-row"
                    style={{ background: index % 2 ? "#fafbfc" : "#ffffff" }}
                  >
                    {visibleColumns["orderNo"] && <td style={{ ...ui.td, width: getColumnWidth("orderNo", 120), fontWeight: 600 }}>{row.orderNo}</td>}
                    {visibleColumns["modelNo"] && <td style={{ ...ui.td, width: getColumnWidth("modelNo", 110) }}>{row.modelNo}</td>}
                    {visibleColumns["customerId"] && <td style={{ ...ui.td, width: getColumnWidth("customerId", 110) }}>{row.customerId}</td>}
                    {visibleColumns["color"] && <td style={{ ...ui.td, width: getColumnWidth("color", 90) }}>{row.color}</td>}
                    {visibleColumns["fabricType"] && <td style={{ ...ui.td, width: getColumnWidth("fabricType", 130) }}><span style={ui.badgeMain}>{row.fabricType}</span></td>}
                    {visibleColumns["tableName"] && <td style={{ ...ui.td, width: getColumnWidth("tableName", 120) }}>{row.tableName}</td>}
                    {visibleColumns["reportNumber"] && <td style={{ ...ui.td, width: getColumnWidth("reportNumber", 130) }}>{row.reportNumber}</td>}
                    {visibleColumns["fabricWidth"] && <td style={{ ...ui.td, width: getColumnWidth("fabricWidth", 100) }}>{row.fabricWidth ? `${row.fabricWidth} cm` : "-"}</td>}
                    {visibleColumns["quantityKg"] && <td style={{ ...ui.td, width: getColumnWidth("quantityKg", 100) }}><span style={ui.badgeKg}>{fmt(row.quantityKg, 1)} kg</span></td>}
                    {visibleColumns["quantityMeter"] && <td style={{ ...ui.td, width: getColumnWidth("quantityMeter", 110) }}><span style={ui.badgeM}>{fmt(row.quantityMeter, 1)} m</span></td>}
                    {visibleColumns["layerCount"] && <td style={{ ...ui.td, width: getColumnWidth("layerCount", 90), textAlign: "center", fontWeight: 600 }}>{row.layerCount}</td>}
                    {visibleColumns["actualGrammage"] && <td style={{ ...ui.td, width: getColumnWidth("actualGrammage", 110) }}>{row.actualGrammage ? `${row.actualGrammage.toFixed(1)} g/m²` : "-"}</td>}
                    {visibleColumns["targetGrammage"] && <td style={{ ...ui.td, width: getColumnWidth("targetGrammage", 110) }}>{row.targetGrammage ? `${row.targetGrammage.toFixed(1)} g/m²` : "-"}</td>}
                    {visibleColumns["grammageStatus"] && <td style={{ ...ui.td, width: getColumnWidth("grammageStatus", 120) }}>{grammageBadge(row.grammageStatus)}</td>}
                    {visibleColumns["cuttingWastePercent"] && (
                      <td style={{ ...ui.td, width: getColumnWidth("cuttingWastePercent", 110), color: row.cuttingWastePercent > 10 ? "#b91c1c" : "#0f172a", fontWeight: 600 }}>
                        %{row.cuttingWastePercent.toFixed(1)}
                      </td>
                    )}
                    {visibleColumns["planKat"] && <td style={{ ...ui.td, width: getColumnWidth("planKat", 90), textAlign: "center" }}>{row.planKat}</td>}
                    {visibleColumns["sizeDistribution"] && <td style={{ ...ui.td, width: getColumnWidth("sizeDistribution", 160) }}>{row.sizeDistribution}</td>}
                    {visibleColumns["totalOrderQuantity"] && <td style={{ ...ui.td, width: getColumnWidth("totalOrderQuantity", 110) }}>{fmt(row.totalOrderQuantity)}</td>}
                    {visibleColumns["outputQuantity"] && (
                      <td style={{ ...ui.td, width: getColumnWidth("outputQuantity", 150) }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <input
                            className="fs-input"
                            type="number"
                            value={row.outputQuantity}
                            onChange={(e) => handleOutputChange(row.id, Number(e.target.value))}
                            style={{
                              width: 78,
                              padding: "5px 8px",
                              border: "1px solid #cbd5e1",
                              borderRadius: 8,
                              fontSize: "0.85rem",
                              background: "#f8fafc",
                            }}
                          />
                          <button
                            className="fs-btn"
                            onClick={() => handleSaveRow(row)}
                            disabled={saving.has(row.id)}
                            style={{
                              padding: "5px 10px",
                              fontSize: 12,
                              fontWeight: 700,
                              borderRadius: 8,
                              border: "1px solid #93c5fd",
                              background: saving.has(row.id) ? "#e2e8f0" : "#eff6ff",
                              color: "#1d4ed8",
                              cursor: "pointer",
                            }}
                          >
                            {saving.has(row.id) ? "…" : "Kaydet"}
                          </button>
                        </div>
                      </td>
                    )}
                    {visibleColumns["divideBy"] && (
                      <td style={{ ...ui.td, width: getColumnWidth("divideBy", 110) }}>
                        <select
                          className="fs-input"
                          value={row.divideBy}
                          onChange={(e) => handleDivideByChange(row.id, e.target.value as "kg" | "meter")}
                          style={{
                            padding: "5px 8px",
                            border: "1px solid #cbd5e1",
                            borderRadius: 8,
                            fontSize: "0.85rem",
                            background: "#f8fafc",
                          }}
                        >
                          <option value="kg">kg</option>
                          <option value="meter">metre</option>
                        </select>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && filteredRows.length > 0 && (
          <div style={ui.summary}>
            Toplam <b style={{ color: "#0f172a" }}>{filteredRows.length}</b> kayıt listeleniyor
          </div>
        )}
      </div>
    </div>
  );
}