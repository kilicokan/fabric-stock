import { useEffect, useRef, useState, useCallback } from "react";
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
  | "orderNo"
  | "modelNo"
  | "customerId"
  | "color"
  | "fabricType"
  | "tableName"
  | "reportNumber"
  | "fabricWidth"
  | "quantityKg"
  | "quantityMeter"
  | "layerCount"
  | "outputQuantity"
  | "actualGrammage"
  | "targetGrammage"
  | "grammageStatus"
  | "cuttingWastePercent"
  | "planKat"
  | "sizeDistribution";

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

type ApiResponse<T> = {
  data?: T;
};

type SortDirection = "asc" | "desc";

const getAuthHeaders = (): { Authorization: string } | undefined => {
  if (typeof window === "undefined") return undefined;
  const token = window.localStorage.getItem("token") || window.localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};

const parseSewingNotesForSizes = (notes?: string | null): string => {
  if (!notes) return "-";
  const trimmed = notes.trim();
  
  // Try to parse as JSON first
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') {
      // Check for sizeChart array
      if (Array.isArray(parsed.sizeChart) && parsed.sizeChart.length > 0) {
        const sizes = parsed.sizeChart
          .map((item: any) => item.size)
          .filter(Boolean)
          .join(" ");
        if (sizes) return `Asorti: ${sizes}`;
      }
      // Check for asortiCount
      if (parsed.asortiCount) {
        return `Asorti: ${parsed.asortiCount} beden`;
      }
      // Check for cuttingReport.asortiCount
      if (parsed.cuttingReport?.asortiCount) {
        return `Asorti: ${parsed.cuttingReport.asortiCount} beden`;
      }
    }
  } catch {
    // Not JSON, continue with original logic
  }
  
  const slashMatch = trimmed.match(/^(\d+)\s*\/\s*(.+)$/);
  if (slashMatch) {
    const sizes = slashMatch[2]
      .split(/[\s,]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (sizes.length) {
      return `${slashMatch[1]} / ${sizes.join(" ")}`;
    }
  }
  return trimmed;
};

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

const ui = {
  page: {
    width: "100%",
    maxWidth: "100%",
    minHeight: "100vh",
    margin: 0,
    padding: "16px",
    borderRadius: 0,
    border: "none",
    background: "var(--fs-color-bg)",
    boxShadow: "none",
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
    color: "var(--fs-color-text)",
    boxSizing: "border-box" as const,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "14px",
    flexWrap: "wrap" as const,
    width: "100%",
    boxSizing: "border-box" as const,
  },
  title: { margin: 0, fontSize: "1.55rem", fontWeight: 700 },
  btnRow: { display: "flex", gap: "8px", flexWrap: "wrap" as const },
  primaryBtn: {
    minHeight: "38px",
    borderRadius: "10px",
    border: "1px solid #93c5fd",
    background: "#eff6ff",
    color: "var(--fs-color-primary-strong)",
    padding: "0 14px",
    fontWeight: 700,
    fontSize: "0.9rem",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
  },
  dangerBtn: {
    minHeight: "38px",
    borderRadius: "10px",
    border: "1px solid #fecaca",
    background: "#fee2e2",
    color: "var(--fs-color-danger)",
    padding: "0 14px",
    fontWeight: 700,
    fontSize: "0.9rem",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
  },
  filterCard: {
    border: "1px solid var(--fs-color-border)",
    borderRadius: "12px",
    background: "var(--fs-color-surface)",
    padding: "12px",
    marginBottom: "12px",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  filterGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "10px",
  },
  label: { display: "block", fontSize: "0.82rem", marginBottom: "4px", color: "var(--fs-color-text-muted)", fontWeight: 600 },
  input: {
    width: "100%",
    minHeight: "38px",
    padding: "8px 10px",
    border: "1px solid var(--fs-color-border-strong)",
    borderRadius: "10px",
    background: "var(--fs-color-surface-soft)",
    color: "var(--fs-color-text)",
    fontSize: "0.9rem",
  },
  rangeRow: { display: "flex", gap: "8px" },
  tableCard: {
    border: "1px solid var(--fs-color-border)",
    borderRadius: "12px",
    background: "var(--fs-color-surface)",
    overflow: "hidden",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  table: { width: "100%", borderCollapse: "collapse" as const, minWidth: "1400px", tableLayout: "fixed" as const },
  th: {
    padding: "9px 10px",
    background: "var(--fs-color-surface-soft)",
    borderBottom: "1px solid var(--fs-color-border)",
    borderRight: "1px solid var(--fs-color-border)",
    color: "var(--fs-color-text-muted)",
    fontSize: "0.78rem",
    letterSpacing: "0.02em",
    textTransform: "uppercase" as const,
    textAlign: "left" as const,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
  td: {
    padding: "9px 10px",
    borderBottom: "1px solid var(--fs-color-border)",
    borderRight: "1px solid var(--fs-color-border)",
    fontSize: "0.88rem",
    color: "var(--fs-color-text)",
    whiteSpace: "nowrap" as const,
  },
  tdCenter: { textAlign: "center" as const, color: "var(--fs-color-text-muted)" },
  badgeMain: { padding: "2px 10px", borderRadius: "999px", background: "var(--fs-color-primary-soft)", color: "var(--fs-color-primary-strong)", fontWeight: 700, fontSize: "0.76rem" },
  badgeKg: { padding: "2px 8px", borderRadius: "8px", background: "#ecfdf3", color: "var(--fs-color-success)", fontWeight: 700, fontSize: "0.76rem" },
  badgeM: { padding: "2px 8px", borderRadius: "8px", background: "#eff6ff", color: "var(--fs-color-primary-strong)", fontWeight: 700, fontSize: "0.76rem" },
  badgeGram: { padding: "2px 8px", borderRadius: "8px", background: "#fef3c7", color: "#92400e", fontWeight: 700, fontSize: "0.76rem" },
  summary: {
    padding: "9px 12px",
    background: "var(--fs-color-surface-soft)",
    color: "var(--fs-color-text-muted)",
    fontSize: "0.85rem",
    borderTop: "1px solid var(--fs-color-border)",
  },
  columnManager: {
    border: "1px solid var(--fs-color-border)",
    borderRadius: "12px",
    background: "var(--fs-color-surface)",
    padding: "12px",
    marginBottom: "12px",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  columnManagerHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
    flexWrap: "wrap" as const,
    gap: "8px",
  },
  columnManagerTitle: { fontWeight: 700, fontSize: "0.9rem", color: "var(--fs-color-text)" },
  columnManagerBtn: {
    minHeight: "32px",
    borderRadius: "8px",
    border: "1px solid var(--fs-color-border-strong)",
    background: "var(--fs-color-surface-soft)",
    color: "var(--fs-color-text)",
    padding: "0 12px",
    fontWeight: 600,
    fontSize: "0.8rem",
    cursor: "pointer",
  },
  columnManagerList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: "6px",
  },
  columnManagerItem: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "0.85rem",
    color: "var(--fs-color-text)",
    cursor: "pointer",
  },
  columnManagerCheckbox: { width: 16, height: 16, accentColor: "var(--fs-color-primary)" },
};

const getSortValue = (row: PlanningRow, key: SortKey): string | number => {
  switch (key) {
    case "fabricType":
      return row.fabricType || "";
    case "tableName":
      return row.tableName || "";
    case "quantityKg":
      return row.quantityKg;
    case "quantityMeter":
      return row.quantityMeter;
    case "layerCount":
      return row.layerCount;
    case "fabricWidth":
      return row.fabricWidth ?? 0;
    case "outputQuantity":
      return row.outputQuantity;
    case "actualGrammage":
      return row.actualGrammage;
    case "targetGrammage":
      return row.targetGrammage;
    case "grammageStatus":
      return row.grammageStatus || "";
    case "cuttingWastePercent":
      return row.cuttingWastePercent;
    case "planKat":
      return row.planKat;
    case "sizeDistribution":
      return row.sizeDistribution || "";
    case "orderNo":
      return row.orderNo || "";
    case "modelNo":
      return row.modelNo || "";
    case "customerId":
      return row.customerId || "";
    case "color":
      return row.color || "";
    case "reportNumber":
      return row.reportNumber || "";
    default:
      return "";
  }
};

export default function FabricsPlanningPage() {
  const [rows, setRows] = useState<PlanningRow[]>([]);
  const [filteredRows, setFilteredRows] = useState<PlanningRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Set<number>>(new Set());
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
    sortableHeaders.forEach((h) => {
      if (h && h.key) { initial[h.key] = true; }
    });
    initial["outputQuantity"] = true;
    initial["divideBy"] = true;
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

        const unit = quantityMeter > 0 && quantityKg === 0 ? "meter" : "kg";
        const numerator = unit === "kg" ? quantityKg : quantityMeter;
        const outputQuantity = layerCount > 0 && numerator > 0 ? Math.round(layerCount * numerator) : 0;
        const actualGrammage = Number(item.grammage || 0);
        const planKat = Number(item.plannedLayers || layerCount || 0);

        const orderKey = (item.orderNo || item.modelNo || "").trim().toLowerCase();
        const workOrder = orderMap.get(orderKey);
        const product = productMap.get(
          (item.modelNo || workOrder?.productCode || workOrder?.modelNo || "")
            .trim()
            .toLowerCase()
        );
        const totalOrderQuantity = Number(workOrder?.quantity || 0);
        const parsedSewing = workOrder?.sewingNotes ? parseSewingNotesForSizes(workOrder.sewingNotes) : null;
        const targetGrammage = Number(product?.averageGrammage ?? item.fabricEntry?.fabric?.averageGrammage ?? 0);
        const grammageStatus = actualGrammage > 0 && targetGrammage > 0
          ? Math.abs(actualGrammage - targetGrammage) <= targetGrammage * 0.05
            ? "Hedef tuttu"
            : "Hedef dışı"
          : "Bekleniyor";
        const cuttingWastePercent = targetGrammage > 0 && actualGrammage > 0
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

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

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

        if (aValue < bValue) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }

    setFilteredRows(result);
  }, [rows, filters, sortConfig]);

  const handleFilterChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleOutputChange = (id: number, value: number) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        return { ...row, outputQuantity: value };
      })
    );
  };

  const handleDivideByChange = (id: number, value: "kg" | "meter") => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        return { ...row, divideBy: value };
      })
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
      fabricType: "",
      tableName: "",
      minKg: "",
      maxKg: "",
      minMeter: "",
      maxMeter: "",
      startDate: "",
      endDate: "",
    });
    setSortConfig({ key: "", direction: "asc" });
  };

  const handleResizeStart = (key: string, event: React.MouseEvent) => {
    event.preventDefault();
    const th = event.currentTarget as HTMLElement | null;
    if (!th) return;
    const startWidth = th.getBoundingClientRect().width;
    resizeState.current = { key, startX: event.clientX, startWidth };
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeState.current || !resizeState.current.key) return;
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
    const exportData = filteredRows.filter((row): row is PlanningRow => row != null).map((row) => ({
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
      "Sipariş No",
      "Model No",
      "Müşteri",
      "Renk",
      "Kumaş Tipi",
      "Masa",
      "Çıkış Belge No",
      "Kumaş Eni",
      "Miktar (kg)",
      "Miktar (metre)",
      "Kat Sayısı",
      "Çıkan Adet",
      "Fiili Gramaj",
      "Hedef Gramaj",
      "Gramaj Durumu",
      "Kesim Firesi",
      "Plan Kat",
      "Asorti / Beden",
      "Toplam Adet",
    ];

    const tableRows = filteredRows.filter((row): row is PlanningRow => row != null).map((row) => [
      row.orderNo,
      row.modelNo,
      row.customerId,
      row.color,
      row.fabricType,
      row.tableName,
      row.reportNumber,
      row.fabricWidth ? `${row.fabricWidth} cm` : "-",
      `${row.quantityKg} kg`,
      `${row.quantityMeter} m`,
      String(row.layerCount),
      String(row.outputQuantity),
      `${row.actualGrammage.toFixed(1)} g/m²`,
      `${row.targetGrammage.toFixed(1)} g/m²`,
      row.grammageStatus,
      `%${row.cuttingWastePercent.toFixed(1)}`,
      String(row.planKat),
      row.sizeDistribution,
      String(row.totalOrderQuantity),
    ]);

    const docWithTable = doc as jsPDF & {
      autoTable: (options: {
        head: string[][];
        body: string[][];
        startY: number;
        theme: "grid";
        styles: { fontSize: number; cellPadding: number };
        headStyles: { fillColor: number[]; textColor: number; fontStyle: "bold" };
        alternateRowStyles: { fillColor: number[] };
      }) => void;
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

  return (
    <div style={ui.page}>
      <div style={ui.header}>
        <h1 style={ui.title}>Kesim Raporu</h1>
        <div style={ui.btnRow}>
          <button onClick={exportToExcel} style={ui.primaryBtn}>
            Excel&apos;e Aktar
          </button>
          <button onClick={exportToPDF} style={ui.dangerBtn}>
            PDF&apos;e Aktar
          </button>
        </div>
      </div>

      <div style={ui.filterCard}>
        <div style={ui.filterGrid}>
          <div>
            <label style={ui.label}>Kumaş Tipi</label>
            <input type="text" name="fabricType" value={filters.fabricType} onChange={handleFilterChange} placeholder="Kumaş tipi ara..." style={ui.input} />
          </div>
          <div>
            <label style={ui.label}>Masa Adı</label>
            <input type="text" name="tableName" value={filters.tableName} onChange={handleFilterChange} placeholder="Masa adı ara..." style={ui.input} />
          </div>
          <div>
            <label style={ui.label}>Kg Aralığı</label>
            <div style={ui.rangeRow}>
              <input type="number" name="minKg" value={filters.minKg} onChange={handleFilterChange} placeholder="Min" style={ui.input} />
              <input type="number" name="maxKg" value={filters.maxKg} onChange={handleFilterChange} placeholder="Max" style={ui.input} />
            </div>
          </div>
          <div>
            <label style={ui.label}>Metre Aralığı</label>
            <div style={ui.rangeRow}>
              <input type="number" name="minMeter" value={filters.minMeter} onChange={handleFilterChange} placeholder="Min" style={ui.input} />
              <input type="number" name="maxMeter" value={filters.maxMeter} onChange={handleFilterChange} placeholder="Max" style={ui.input} />
            </div>
          </div>
          <div>
            <label style={ui.label}>Tarih Aralığı</label>
            <div style={ui.rangeRow}>
              <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} style={ui.input} />
              <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} style={ui.input} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "end" }}>
            <button onClick={resetFilters} style={ui.primaryBtn}>
              Filtreleri Sıfırla
            </button>
          </div>
        </div>
      </div>

      <div style={ui.tableCard} ref={tableRef}>
        <div style={ui.columnManager}>
          <div style={ui.columnManagerHeader}>
            <span style={ui.columnManagerTitle}>Kolon Yönetimi</span>
            <button onClick={() => setVisibleColumns(Object.fromEntries(Object.keys(visibleColumns).map(k => [k, true]))) } style={ui.columnManagerBtn}>Tümünü Göster</button>
            <button onClick={() => { const v = {...visibleColumns}; Object.keys(v).forEach(k => v[k] = false); setVisibleColumns(v); }} style={ui.columnManagerBtn}>Tümünü Gizle</button>
          </div>
          <div style={ui.columnManagerList}>
            {[
              ...sortableHeaders.filter(Boolean).map((h) => ({ key: h.key, label: h.label })),
              { key: "outputQuantity", label: "Çıktı Miktarı" },
              { key: "divideBy", label: "Bölünecek Birim" },
            ].map((col) => (
              <label key={col.key} style={ui.columnManagerItem}>
                <input
                  type="checkbox"
                  checked={visibleColumns[col.key] ?? true}
                  onChange={(e) => setVisibleColumns(prev => ({ ...prev, [col.key]: e.target.checked }))}
                  style={ui.columnManagerCheckbox}
                />
                <span>{col.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={ui.table}>
            <thead>
              <tr>
                {sortableHeaders.filter(Boolean).map((head) => {
                  if (!visibleColumns[head.key]) return null;
                  if (!head.key) return null;
                  const headerKey = head.key || head?.label || `header-${Math.random()}`;
                  return (
                    <th
                      key={headerKey}
                      onClick={() => head.key ? handleSort(head.key) : undefined}
                      onMouseDown={(event) => head.key ? handleResizeStart(head.key, event) : undefined}
                      style={{
                        ...ui.th,
                        width: getColumnWidth(head.key ?? headerKey, 140),
                        minWidth: 90,
                        maxWidth: 400,
                        resize: "horizontal",
                        overflow: "hidden",
                      }}
                    >
                      {head?.label ?? ""}
                      <span
                        style={{
                          display: "inline-block",
                          width: 6,
                          height: 14,
                          marginLeft: 6,
                          cursor: "col-resize",
                          background: "currentColor",
                          opacity: 0.4,
                          verticalAlign: "middle",
                        }}
                      />
                      {sortConfig?.key === head?.key ? (sortConfig?.direction === "asc" ? " ↑" : " ↓") : ""}
                    </th>
                  );
                })}
                {visibleColumns["divideBy"] && (
                  <th
                    onMouseDown={(event) => handleResizeStart("divideBy", event)}
                    style={{ ...ui.th, width: getColumnWidth("divideBy", 110), minWidth: 80, maxWidth: 220, cursor: "col-resize", resize: "horizontal", overflow: "hidden" }}
                  >
                    Bölünecek Birim
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(Boolean).length} style={{ ...ui.td, ...ui.tdCenter, padding: "16px" }}>
                    Yükleniyor...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(Boolean).length} style={{ ...ui.td, ...ui.tdCenter, padding: "16px" }}>
                    Filtreleme kriterlerinize uygun kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredRows.filter((row): row is PlanningRow => row != null).map((row, index) => (
                  <tr key={row.id} style={{ background: index % 2 ? "var(--fs-color-surface-soft)" : "var(--fs-color-surface)" }}>
                    {visibleColumns["orderNo"] && <td style={{ ...ui.td, width: getColumnWidth("orderNo", 120) }}>{row.orderNo}</td>}
                    {visibleColumns["modelNo"] && <td style={{ ...ui.td, width: getColumnWidth("modelNo", 110) }}>{row.modelNo}</td>}
                    {visibleColumns["customerId"] && <td style={{ ...ui.td, width: getColumnWidth("customerId", 110) }}>{row.customerId}</td>}
                    {visibleColumns["color"] && <td style={{ ...ui.td, width: getColumnWidth("color", 90) }}>{row.color}</td>}
                    {visibleColumns["fabricType"] && <td style={{ ...ui.td, width: getColumnWidth("fabricType", 130) }}><span style={ui.badgeMain}>{row.fabricType}</span></td>}
                    {visibleColumns["tableName"] && <td style={{ ...ui.td, width: getColumnWidth("tableName", 120) }}>{row.tableName}</td>}
                    {visibleColumns["reportNumber"] && <td style={{ ...ui.td, width: getColumnWidth("reportNumber", 130) }}>{row.reportNumber}</td>}
                    {visibleColumns["fabricWidth"] && <td style={{ ...ui.td, width: getColumnWidth("fabricWidth", 100) }}>{row.fabricWidth ? `${row.fabricWidth} cm` : "-"}</td>}
                    {visibleColumns["quantityKg"] && <td style={{ ...ui.td, width: getColumnWidth("quantityKg", 100) }}><span style={ui.badgeKg}>{row.quantityKg} kg</span></td>}
                    {visibleColumns["quantityMeter"] && <td style={{ ...ui.td, width: getColumnWidth("quantityMeter", 110) }}><span style={ui.badgeM}>{row.quantityMeter} m</span></td>}
                    {visibleColumns["layerCount"] && <td style={{ ...ui.td, width: getColumnWidth("layerCount", 90) }}>{row.layerCount}</td>}
                    {visibleColumns["actualGrammage"] && <td style={{ ...ui.td, width: getColumnWidth("actualGrammage", 110) }}>{row.actualGrammage ? `${row.actualGrammage.toFixed(1)} g/m²` : "-"}</td>}
                    {visibleColumns["targetGrammage"] && <td style={{ ...ui.td, width: getColumnWidth("targetGrammage", 110) }}>{row.targetGrammage ? `${row.targetGrammage.toFixed(1)} g/m²` : "-"}</td>}
                    {visibleColumns["grammageStatus"] && <td style={{ ...ui.td, width: getColumnWidth("grammageStatus", 110) }}>{row.grammageStatus}</td>}
                    {visibleColumns["cuttingWastePercent"] && <td style={{ ...ui.td, width: getColumnWidth("cuttingWastePercent", 110) }}>%{row.cuttingWastePercent.toFixed(1)}</td>}
                    {visibleColumns["planKat"] && <td style={{ ...ui.td, width: getColumnWidth("planKat", 90) }}>{row.planKat}</td>}
                    {visibleColumns["sizeDistribution"] && <td style={{ ...ui.td, width: getColumnWidth("sizeDistribution", 160) }}>{row.sizeDistribution}</td>}
                    {visibleColumns["totalOrderQuantity"] && <td style={{ ...ui.td, width: getColumnWidth("totalOrderQuantity", 110) }}>{row.totalOrderQuantity}</td>}
                    {visibleColumns["outputQuantity"] && (
                      <td style={{ ...ui.td, width: getColumnWidth("outputQuantity", 110) }}>
                        <input
                          type="number"
                          value={row.outputQuantity}
                          onChange={(e) => handleOutputChange(row.id, Number(e.target.value))}
                          style={{ width: 70, padding: 4 }}
                        />
                        <button
                          onClick={() => handleSaveRow(row)}
                          disabled={saving.has(row.id)}
                          style={{ marginLeft: 4, padding: "2px 6px", fontSize: 11 }}
                        >
                          {saving.has(row.id) ? "Kaydediliyor…" : "Kaydet"}
                        </button>
                      </td>
                    )}
                    {visibleColumns["divideBy"] && <td style={{ ...ui.td, width: getColumnWidth("divideBy", 110) }}><select value={row.divideBy} onChange={(e) => handleDivideByChange(row.id, e.target.value as "kg" | "meter")} style={{ padding: 4 }}><option value="kg">kg</option><option value="meter">metre</option></select></td>}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && filteredRows.length > 0 && <div style={ui.summary}>Toplam {filteredRows.length} kayıt bulundu</div>}
      </div>
    </div>
  );
}
