import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";

/* ============================================================
   TİPLER
============================================================ */
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
  orderNo?: string; modelNo?: string; productCode?: string;
  productName?: string; productColor?: string | null;
  customerName?: string; quantity?: number;
  sewingNotes?: string | null; createdAt?: string;
};

type ProductSource = {
  modelNo?: string;
  averageGrammage?: number | null;
  fabric?: { name?: string; width?: number | null; averageGrammage?: number | null } | null;
};

type ApiResponse<T> = { data?: T };

type ExitApiRow = {
  id?: number; fabricType?: string;
  productWeightKg?: number; productLengthMeter?: number;
  createdAt?: string; modelNo?: string; orderNo?: string;
  customerId?: string; color?: string; layerCount?: number;
  fabricWidth?: number | null; reportNumber?: string | null;
  grammage?: number | null; plannedLayers?: string | null;
  actualLayers?: string | null; unitType?: string;
  cuttingTable?: { name?: string };
  fabricEntry?: { fabric?: { name?: string; width?: number | null; averageGrammage?: number | null } };
};

type Filters = {
  fabricType: string;
  tableName: string;
  minKg: string;
  maxKg: string;
  minMeter: string;
  maxMeter: string;
  startDate: string;
  endDate: string;
};

type SavedFilter = { name: string; filters: Filters };

type Toast = { id: number; type: "success" | "error" | "info"; message: string };

/* ============================================================
   YARDIMCILAR
============================================================ */
const getAuthHeaders = (): { Authorization: string } | undefined => {
  if (typeof window === "undefined") return undefined;
  const token = window.localStorage.getItem("token") || window.localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};

const parseDate = (value?: string | null): number => {
  if (!value) return 0;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
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

const fmt = (n: number, digits = 0) =>
  Number.isFinite(n) ? n.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "-";

const EMPTY_FILTERS: Filters = {
  fabricType: "", tableName: "", minKg: "", maxKg: "",
  minMeter: "", maxMeter: "", startDate: "", endDate: "",
};

/* ============================================================
   KOLON TANIMLARI
============================================================ */
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

const DEFAULT_COL_WIDTHS: Record<string, number> = {
  orderNo: 120, modelNo: 110, customerId: 110, color: 90, fabricType: 130,
  tableName: 120, reportNumber: 130, fabricWidth: 100, quantityKg: 100,
  quantityMeter: 110, layerCount: 90, outputQuantity: 170, actualGrammage: 110,
  targetGrammage: 110, grammageStatus: 120, cuttingWastePercent: 110,
  planKat: 90, sizeDistribution: 160, totalOrderQuantity: 110, divideBy: 110,
};

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 500];

/* ============================================================
   CSS (tema + animasyonlar + sticky + responsive)
============================================================ */
const cssText = `
  :root {
    --fs-bg: #f8fafc;
    --fs-surface: #ffffff;
    --fs-surface-2: #f1f5f9;
    --fs-surface-3: #f8fafc;
    --fs-text: #0f172a;
    --fs-text-muted: #475569;
    --fs-text-soft: #94a3b8;
    --fs-border: #e2e8f0;
    --fs-border-strong: #cbd5e1;
    --fs-primary: #2563eb;
    --fs-primary-strong: #1d4ed8;
    --fs-primary-soft: #eff6ff;
    --fs-danger: #b91c1c;
    --fs-danger-soft: #fee2e2;
    --fs-success: #15803d;
    --fs-success-soft: #dcfce7;
    --fs-warn: #b45309;
    --fs-warn-soft: #fef3c7;
    --fs-row-odd: #ffffff;
    --fs-row-even: #fafbfc;
    --fs-row-hover: #eff6ff;
    --fs-row-dirty: #fffbeb;
    --fs-row-selected: #e0ecff;
    --fs-shadow-sm: 0 1px 2px rgba(15,23,42,0.04);
    --fs-shadow-md: 0 6px 16px rgba(15,23,42,0.08);
    --fs-shadow-lg: 0 10px 24px rgba(15,23,42,0.12);
  }
  .fs-dark {
    --fs-bg: #0f172a;
    --fs-surface: #1e293b;
    --fs-surface-2: #334155;
    --fs-surface-3: #0f172a;
    --fs-text: #f1f5f9;
    --fs-text-muted: #cbd5e1;
    --fs-text-soft: #64748b;
    --fs-border: #334155;
    --fs-border-strong: #475569;
    --fs-primary: #3b82f6;
    --fs-primary-strong: #60a5fa;
    --fs-primary-soft: #1e3a8a;
    --fs-danger: #f87171;
    --fs-danger-soft: #450a0a;
    --fs-success: #4ade80;
    --fs-success-soft: #052e16;
    --fs-warn: #fbbf24;
    --fs-warn-soft: #451a03;
    --fs-row-odd: #1e293b;
    --fs-row-even: #162032;
    --fs-row-hover: #1e3a8a;
    --fs-row-dirty: #422006;
    --fs-row-selected: #1e3a8a;
    --fs-shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
    --fs-shadow-md: 0 6px 16px rgba(0,0,0,0.4);
    --fs-shadow-lg: 0 10px 24px rgba(0,0,0,0.5);
  }

  .fs-page * { box-sizing: border-box; }
  .fs-table-row {
    background: var(--fs-row-odd);
    transition: background-color 0.12s ease;
  }
  .fs-table-row.fs-even { background: var(--fs-row-even); }
  .fs-table-row.fs-dirty { background: var(--fs-row-dirty); }
  .fs-table-row.fs-selected { background: var(--fs-row-selected); }
  .fs-table-row:hover { background: var(--fs-row-hover) !important; }
  .fs-table-row > td { background: inherit; }

  .fs-th {
    user-select: none;
    background: var(--fs-surface-2);
    transition: background-color 0.12s ease;
  }
  .fs-th:hover { background: var(--fs-border) !important; }

  .fs-btn { transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease; }
  .fs-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: var(--fs-shadow-md); }
  .fs-btn:active:not(:disabled) { transform: translateY(0); }
  .fs-btn:disabled { opacity: 0.55; cursor: not-allowed; }

  .fs-input:focus, .fs-btn:focus-visible, .fs-th:focus-visible {
    outline: 2px solid var(--fs-primary);
    outline-offset: 1px;
  }

  .fs-checkbox { width: 16px; height: 16px; accent-color: var(--fs-primary); cursor: pointer; }

  .fs-stat-card { transition: transform 0.18s ease, box-shadow 0.18s ease; }
  .fs-stat-card:hover { transform: translateY(-2px); box-shadow: var(--fs-shadow-md); }

  .fs-resizer { transition: opacity 0.12s ease, background 0.12s ease; opacity: 0.25; }
  .fs-resizer:hover, .fs-resizer:focus { opacity: 1; background: var(--fs-primary); outline: none; }

  .fs-spinner {
    width: 30px; height: 30px; border: 3px solid var(--fs-border);
    border-top-color: var(--fs-primary); border-radius: 50%;
    animation: fs-spin 0.8s linear infinite; margin: 0 auto 10px;
  }
  @keyframes fs-spin { to { transform: rotate(360deg); } }

  .fs-collapse { overflow: hidden; transition: max-height 0.3s ease, opacity 0.2s ease; }

  .fs-skeleton {
    background: linear-gradient(90deg, var(--fs-surface-2) 25%, var(--fs-border) 37%, var(--fs-surface-2) 63%);
    background-size: 400% 100%;
    animation: fs-shimmer 1.4s ease infinite;
    border-radius: 6px;
    display: inline-block;
  }
  @keyframes fs-shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }

  .fs-toast-container {
    position: fixed; top: 20px; right: 20px; z-index: 9999;
    display: flex; flex-direction: column; gap: 10px; pointer-events: none;
  }
  .fs-toast {
    min-width: 260px; max-width: 360px; padding: 12px 16px;
    border-radius: 10px; box-shadow: var(--fs-shadow-lg);
    font-size: 0.88rem; font-weight: 600;
    animation: fs-slide-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    pointer-events: auto; display: flex; align-items: center; gap: 8px;
  }
  .fs-toast.fs-success { background: var(--fs-success-soft); color: var(--fs-success); border: 1px solid var(--fs-success); }
  .fs-toast.fs-error   { background: var(--fs-danger-soft);  color: var(--fs-danger);  border: 1px solid var(--fs-danger); }
  .fs-toast.fs-info    { background: var(--fs-primary-soft); color: var(--fs-primary-strong); border: 1px solid var(--fs-primary); }
  @keyframes fs-slide-in { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

  .fs-mobile-cards { display: grid; gap: 12px; padding: 12px; }
  .fs-mobile-card {
    border: 1px solid var(--fs-border);
    border-radius: 12px;
    background: var(--fs-surface);
    padding: 12px;
    box-shadow: var(--fs-shadow-sm);
  }
  .fs-mobile-card-row { display: flex; justify-content: space-between; gap: 8px; padding: 4px 0; font-size: 0.85rem; }
  .fs-mobile-card-row > span:first-child { color: var(--fs-text-muted); font-weight: 600; }
  .fs-mobile-card-row > span:last-child { color: var(--fs-text); text-align: right; }

  .fs-pagination {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; padding: 10px 16px; border-top: 1px solid var(--fs-border);
    background: var(--fs-surface-3); flex-wrap: wrap; font-size: 0.85rem;
    color: var(--fs-text-muted);
  }
  .fs-pagination-btns { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }
  .fs-page-btn {
    min-width: 34px; height: 34px; border-radius: 8px;
    border: 1px solid var(--fs-border); background: var(--fs-surface);
    color: var(--fs-text); font-size: 0.85rem; font-weight: 600;
    cursor: pointer; transition: all 0.12s ease;
  }
  .fs-page-btn:hover:not(:disabled) { background: var(--fs-primary-soft); border-color: var(--fs-primary); color: var(--fs-primary-strong); }
  .fs-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .fs-page-btn.fs-page-active { background: var(--fs-primary); border-color: var(--fs-primary); color: #ffffff; }

  .fs-sticky-checkbox { position: sticky; left: 0; z-index: 5; }
  .fs-sticky-first { position: sticky; left: 44px; z-index: 4; }
  .fs-sticky-head { z-index: 6; }
  .fs-sticky-head-first { z-index: 7; }

  .fs-stripe {
    position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  }

  .fs-dirty-dot {
    display: inline-block; width: 8px; height: 8px; border-radius: 50%;
    background: var(--fs-warn); margin-right: 6px; vertical-align: middle;
  }

  .fs-grammage-badge {
    padding: 3px 10px; border-radius: 999px; font-weight: 700; font-size: 0.76rem;
    display: inline-block; white-space: nowrap;
  }
  .fs-badge-tuttu { background: var(--fs-success-soft); color: var(--fs-success); }
  .fs-badge-disi  { background: var(--fs-danger-soft);  color: var(--fs-danger); }
  .fs-badge-bekle { background: var(--fs-warn-soft);    color: var(--fs-warn); }
`;

/* ============================================================
   STİL OBJESİ
============================================================ */
const ui = {
  page: {
    width: "100%", minHeight: "100vh", margin: 0, padding: "20px",
    background: "var(--fs-bg)", color: "var(--fs-text)",
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
  } as const,
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    gap: "16px", marginBottom: "20px", flexWrap: "wrap" as const,
  },
  title: { margin: 0, fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.02em" },
  subtitle: { margin: 0, fontSize: "0.85rem", color: "var(--fs-text-muted)" },
  btnRow: { display: "flex", gap: "8px", flexWrap: "wrap" as const, alignItems: "center" },
  primaryBtn: {
    minHeight: "40px", borderRadius: "10px", border: "1px solid var(--fs-primary)",
    background: "var(--fs-primary-soft)", color: "var(--fs-primary-strong)",
    padding: "0 16px", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer",
    display: "inline-flex", alignItems: "center", gap: "6px",
  } as const,
  dangerBtn: {
    minHeight: "40px", borderRadius: "10px", border: "1px solid var(--fs-danger)",
    background: "var(--fs-danger-soft)", color: "var(--fs-danger)",
    padding: "0 16px", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer",
    display: "inline-flex", alignItems: "center", gap: "6px",
  } as const,
  ghostBtn: {
    minHeight: "40px", borderRadius: "10px", border: "1px solid var(--fs-border)",
    background: "var(--fs-surface)", color: "var(--fs-text-muted)",
    padding: "0 16px", fontWeight: 600, fontSize: "0.88rem", cursor: "pointer",
    display: "inline-flex", alignItems: "center", gap: "6px",
  } as const,
  smallBtn: {
    minHeight: "32px", borderRadius: "8px", border: "1px solid var(--fs-border)",
    background: "var(--fs-surface)", color: "var(--fs-text-muted)",
    padding: "0 12px", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer",
  } as const,
  card: {
    border: "1px solid var(--fs-border)", borderRadius: "14px",
    background: "var(--fs-surface)", padding: "16px",
    marginBottom: "16px", boxShadow: "var(--fs-shadow-sm)",
  } as const,
  cardTitle: { fontWeight: 700, fontSize: "0.92rem", color: "var(--fs-text)" },
  statsGrid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: "12px", marginBottom: "16px",
  },
  statCard: {
    background: "var(--fs-surface)", border: "1px solid var(--fs-border)",
    borderRadius: "14px", padding: "14px 16px",
    display: "flex", flexDirection: "column" as const, gap: "4px",
    boxShadow: "var(--fs-shadow-sm)",
  },
  statLabel: {
    fontSize: "0.72rem", color: "var(--fs-text-muted)", fontWeight: 700,
    letterSpacing: "0.04em", textTransform: "uppercase" as const,
  },
  statValue: { fontSize: "1.35rem", fontWeight: 800, color: "var(--fs-text)", lineHeight: 1.1 },
  statHint: { fontSize: "0.72rem", color: "var(--fs-text-soft)" },
  filterGrid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
  },
  label: {
    display: "block", fontSize: "0.78rem", marginBottom: "5px",
    color: "var(--fs-text-muted)", fontWeight: 700,
  },
  input: {
    width: "100%", minHeight: "40px", padding: "8px 12px",
    border: "1px solid var(--fs-border-strong)", borderRadius: "10px",
    background: "var(--fs-surface-3)", color: "var(--fs-text)",
    fontSize: "0.9rem", fontFamily: "inherit",
  } as const,
  rangeRow: { display: "flex", gap: "8px" },
  tableCard: {
    border: "1px solid var(--fs-border)", borderRadius: "14px",
    background: "var(--fs-surface)", overflow: "hidden",
    boxShadow: "var(--fs-shadow-sm)",
  } as const,
  tableScroll: { overflow: "auto", maxHeight: "calc(100vh - 340px)", minHeight: "260px" } as const,
  table: {
    width: "100%", borderCollapse: "separate" as const, borderSpacing: 0,
    minWidth: "1400px", tableLayout: "fixed" as const,
  } as const,
  th: {
    position: "sticky" as const, top: 0,
    padding: "11px 12px",
    borderBottom: "1px solid var(--fs-border)",
    borderRight: "1px solid var(--fs-border)",
    color: "var(--fs-text-muted)",
    fontSize: "0.74rem", letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    textAlign: "left" as const, fontWeight: 800,
    cursor: "pointer", whiteSpace: "nowrap" as const,
  } as const,
  td: {
    padding: "10px 12px",
    borderBottom: "1px solid var(--fs-border)",
    borderRight: "1px solid var(--fs-border)",
    fontSize: "0.88rem", color: "var(--fs-text)",
    whiteSpace: "nowrap" as const, verticalAlign: "middle" as const,
    position: "relative" as const,
  } as const,
  tdCenter: { textAlign: "center" as const, color: "var(--fs-text-muted)" },
  badgeMain: {
    padding: "3px 10px", borderRadius: "999px",
    background: "var(--fs-primary-soft)", color: "var(--fs-primary-strong)",
    fontWeight: 700, fontSize: "0.76rem",
  },
  badgeKg: {
    padding: "3px 9px", borderRadius: "8px",
    background: "var(--fs-success-soft)", color: "var(--fs-success)",
    fontWeight: 700, fontSize: "0.78rem",
  },
  badgeM: {
    padding: "3px 9px", borderRadius: "8px",
    background: "var(--fs-primary-soft)", color: "var(--fs-primary-strong)",
    fontWeight: 700, fontSize: "0.78rem",
  },
  columnManagerList: {
    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: "8px", marginTop: "12px", paddingTop: "12px",
    borderTop: "1px dashed var(--fs-border)",
  },
  columnManagerItem: {
    display: "flex", alignItems: "center", gap: "8px",
    fontSize: "0.86rem", color: "var(--fs-text-muted)",
    cursor: "pointer", padding: "4px 6px", borderRadius: "8px",
  },
};

/* ============================================================
   SORT DEĞERİ
============================================================ */
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

/* ============================================================
   ANA BİLEŞEN
============================================================ */
export default function FabricsPlanningPage() {
  /* ---------- State ---------- */
  const [rows, setRows] = useState<PlanningRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Set<number>>(new Set());
  const [dirtyRows, setDirtyRows] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: SortKey | ""; direction: SortDirection }>({
    key: "", direction: "asc",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    allColumnDefs.forEach((c) => { initial[c.key] = true; });
    return initial;
  });
  const [showColumns, setShowColumns] = useState(false);

  const [darkMode, setDarkMode] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("fs-saved-filters");
      return raw ? (JSON.parse(raw) as SavedFilter[]) : [];
    } catch { return []; }
  });
  const [newFilterName, setNewFilterName] = useState("");

  const resizeState = useRef<{ key: string; startX: number; startWidth: number } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  /* ---------- Toast ---------- */
  const addToast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  /* ---------- Responsive ---------- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => setIsMobile(window.innerWidth < 900);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /* ---------- Saved filters persistence ---------- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("fs-saved-filters", JSON.stringify(savedFilters));
    } catch { /* sessizce yut */ }
  }, [savedFilters]);

  /* ---------- Veri çekme ---------- */
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
          .map((v) => v?.trim())
          .filter((v): v is string => Boolean(v));
        keys.forEach((k) => orderMap.set(k.toLowerCase(), order));
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
              ? "Hedef tuttu" : "Hedef dışı"
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
          fabricType, tableName,
          reportNumber: item.reportNumber || "-",
          fabricWidth: item.fabricEntry?.fabric?.width ?? item.fabricWidth ?? null,
          quantityKg, quantityMeter, layerCount, outputQuantity, divideBy: unit,
          actualGrammage, targetGrammage, grammageStatus,
          cuttingWastePercent, cuttingWasteGramaj, planKat,
          createdAt: item.createdAt || workOrder?.createdAt || "",
          totalOrderQuantity,
          sizeDistribution: parsedSewing || "-",
        };
      });

      setRows(mapped);
      setDirtyRows(new Set());
      setSelectedIds(new Set());
    } catch (error) {
      console.error("Veri alınamadı:", error);
      setRows([]);
      addToast("Veriler alınamadı. Lütfen tekrar deneyin.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  /* ---------- Filtreleme + arama + sıralama (useMemo) ---------- */
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let result = rows.filter((row) => {
      if (filters.fabricType && !row.fabricType.toLowerCase().includes(filters.fabricType.toLowerCase())) return false;
      if (filters.tableName && !row.tableName.toLowerCase().includes(filters.tableName.toLowerCase())) return false;
      if (filters.minKg !== "" && row.quantityKg < Number(filters.minKg)) return false;
      if (filters.maxKg !== "" && row.quantityKg > Number(filters.maxKg)) return false;
      if (filters.minMeter !== "" && row.quantityMeter < Number(filters.minMeter)) return false;
      if (filters.maxMeter !== "" && row.quantityMeter > Number(filters.maxMeter)) return false;

      const created = parseDate(row.createdAt);
      if (filters.startDate && created < parseDate(filters.startDate)) return false;
      if (filters.endDate) {
        const end = parseDate(filters.endDate);
        // end gününün sonuna kadar dahil et
        if (created > end + 24 * 60 * 60 * 1000 - 1) return false;
      }

      if (q) {
        const haystack = [
          row.orderNo, row.modelNo, row.customerId, row.color, row.fabricType,
          row.tableName, row.reportNumber, row.grammageStatus, row.sizeDistribution,
        ].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    if (sortConfig.key) {
      const sortKey = sortConfig.key as SortKey;
      const dir = sortConfig.direction === "asc" ? 1 : -1;
      result = [...result].sort((a, b) => {
        const av = getSortValue(a, sortKey);
        const bv = getSortValue(b, sortKey);
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      });
    }
    return result;
  }, [rows, filters, sortConfig, searchQuery]);

  /* ---------- Sayfalama ---------- */
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(currentPage, pageCount);
  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, safePage, pageSize]);

  useEffect(() => {
    // filtre/arama/sort değişince sayfayı 1'e al
    setCurrentPage(1);
  }, [filters, searchQuery, sortConfig, pageSize]);

  /* ---------- Özet istatistikler ---------- */
  const stats = useMemo(() => {
    const total = filteredRows.length;
    const totalKg = filteredRows.reduce((s, r) => s + (r.quantityKg || 0), 0);
    const totalMeter = filteredRows.reduce((s, r) => s + (r.quantityMeter || 0), 0);
    const totalOutput = filteredRows.reduce((s, r) => s + (r.outputQuantity || 0), 0);
    const onTarget = filteredRows.filter((r) => r.grammageStatus === "Hedef tuttu").length;
    const ratio = total > 0 ? (onTarget / total) * 100 : 0;
    return { total, totalKg, totalMeter, totalOutput, onTarget, ratio };
  }, [filteredRows]);

  const visibleHeaders = useMemo(
    () => sortableHeaders.filter((h) => visibleColumns[h.key]),
    [visibleColumns]
  );

  const visibleColCount =
    visibleHeaders.length +
    (visibleColumns["totalOrderQuantity"] ? 1 : 0) +
    (visibleColumns["divideBy"] ? 1 : 0);

  /* ---------- Seçim ---------- */
  const pageAllSelected = paginatedRows.length > 0 && paginatedRows.every((r) => selectedIds.has(r.id));
  const pageSomeSelected = !pageAllSelected && paginatedRows.some((r) => selectedIds.has(r.id));

  const togglePageAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (pageAllSelected) {
        paginatedRows.forEach((r) => next.delete(r.id));
      } else {
        paginatedRows.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  const toggleRow = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  /* ---------- Satır güncelleme ---------- */
  const markDirty = (id: number) => {
    setDirtyRows((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleOutputChange = (id: number, rawValue: string) => {
    const value = Math.max(0, Number(rawValue) || 0);
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, outputQuantity: value } : row))
    );
    markDirty(id);
  };

  const handleLayerCountChange = (id: number, rawValue: string) => {
    const value = Math.max(0, Math.floor(Number(rawValue) || 0));
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const numerator = row.divideBy === "kg" ? row.quantityKg : row.quantityMeter;
        const newOutput = value > 0 && numerator > 0 ? Math.round(value * numerator) : row.outputQuantity;
        return { ...row, layerCount: value, outputQuantity: newOutput };
      })
    );
    markDirty(id);
  };

  const handleDivideByChange = (id: number, value: "kg" | "meter") => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const numerator = value === "kg" ? row.quantityKg : row.quantityMeter;
        const newOutput = row.layerCount > 0 && numerator > 0
          ? Math.round(row.layerCount * numerator)
          : row.outputQuantity;
        return { ...row, divideBy: value, outputQuantity: newOutput };
      })
    );
    markDirty(id);
  };

  /* ---------- Kaydetme ---------- */
  const saveRow = useCallback(async (row: PlanningRow, opts?: { silent?: boolean }) => {
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
      setDirtyRows((prev) => {
        const next = new Set(prev);
        next.delete(row.id!);
        return next;
      });
      if (!opts?.silent) addToast(`#${row.id} kaydedildi`, "success");
    } catch (error) {
      console.error("Save error:", error);
      addToast(`#${row.id} kaydedilemedi`, "error");
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(row.id!);
        return next;
      });
    }
  }, [addToast]);

  const saveAllDirty = useCallback(async () => {
    const targets = rows.filter((r) => dirtyRows.has(r.id));
    if (!targets.length) {
      addToast("Kaydedilecek değişiklik yok.", "info");
      return;
    }
    await Promise.all(targets.map((r) => saveRow(r, { silent: true })));
    addToast(`${targets.length} satır kaydedildi`, "success");
    void fetchData();
  }, [rows, dirtyRows, saveRow, addToast, fetchData]);

  /* ---------- Sıralama ---------- */
  const handleSort = (key: SortKey) => {
    const direction: SortDirection =
      sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
    setSortConfig({ key, direction });
  };

  /* ---------- Filtreler ---------- */
  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearchQuery("");
    setSortConfig({ key: "", direction: "asc" });
  };

  const saveCurrentFilter = () => {
    const name = newFilterName.trim();
    if (!name) {
      addToast("Filtre adı girin.", "info");
      return;
    }
    setSavedFilters((prev) => {
      const without = prev.filter((f) => f.name !== name);
      return [...without, { name, filters }];
    });
    setNewFilterName("");
    addToast(`"${name}" kaydedildi`, "success");
  };

  const applySavedFilter = (name: string) => {
    const found = savedFilters.find((f) => f.name === name);
    if (found) {
      setFilters(found.filters);
      addToast(`"${name}" uygulandı`, "info");
    }
  };

  const deleteSavedFilter = (name: string) => {
    setSavedFilters((prev) => prev.filter((f) => f.name !== name));
    addToast(`"${name}" silindi`, "info");
  };

  /* ---------- Kolon yeniden boyutlandırma ---------- */
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

  const handleResizeKey = (key: string, event: React.KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const delta = event.key === "ArrowLeft" ? -12 : 12;
    const current = columnWidths[key] ?? DEFAULT_COL_WIDTHS[key] ?? 140;
    setColumnWidths((prev) => ({ ...prev, [key]: Math.max(60, current + delta) }));
  };

  const getColumnWidth = (key: string, fallback?: number) =>
    columnWidths[key] ?? DEFAULT_COL_WIDTHS[key] ?? fallback ?? 140;

  /* ---------- Dışa aktarma ---------- */
  const exportToExcel = (onlySelected = false) => {
    const source = onlySelected
      ? filteredRows.filter((r) => selectedIds.has(r.id))
      : filteredRows;
    if (!source.length) {
      addToast(onlySelected ? "Seçili satır yok." : "Aktarılacak kayıt yok.", "info");
      return;
    }
    const exportData = source.map((row) => ({
      SiparişNo: row.orderNo, ModelNo: row.modelNo, Müşteri: row.customerId,
      Renk: row.color, KumaşTipi: row.fabricType, Masa: row.tableName,
      ÇıkışBelgeNo: row.reportNumber,
      KumaşEni: row.fabricWidth ? `${row.fabricWidth} cm` : "-",
      MiktarKg: row.quantityKg, MiktarMetre: row.quantityMeter,
      KatSayısı: row.layerCount, ÇıkanAdet: row.outputQuantity,
      FiiliGramaj: Number(row.actualGrammage.toFixed(1)),
      HedefGramaj: Number(row.targetGrammage.toFixed(1)),
      GramajDurumu: row.grammageStatus,
      KesimFiresi: Number(row.cuttingWastePercent.toFixed(1)),
      PlanKat: row.planKat, AsortiBeden: row.sizeDistribution,
      ToplamAdet: row.totalOrderQuantity,
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kesim Raporu");
    XLSX.writeFile(workbook, onlySelected ? "kesim_raporu_secili.xlsx" : "kesim_raporu.xlsx");
    addToast("Excel dosyası indirildi", "success");
  };

  const exportToPDF = (onlySelected = false) => {
    const source = onlySelected
      ? filteredRows.filter((r) => selectedIds.has(r.id))
      : filteredRows;
    if (!source.length) {
      addToast(onlySelected ? "Seçili satır yok." : "Aktarılacak kayıt yok.", "info");
      return;
    }
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.text("Kesim Raporu", 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Oluşturulma Tarihi: ${new Date().toLocaleDateString("tr-TR")}`, 14, 22);
    doc.text(`Toplam Kayıt: ${source.length}${onlySelected ? " (seçili)" : ""}`, 14, 28);

    const tableColumn = [
      "Sipariş No", "Model No", "Müşteri", "Renk", "Kumaş Tipi", "Masa",
      "Çıkış Belge No", "Kumaş Eni", "Miktar (kg)", "Miktar (metre)",
      "Kat Sayısı", "Çıkan Adet", "Fiili Gramaj", "Hedef Gramaj",
      "Gramaj Durumu", "Kesim Firesi", "Plan Kat", "Asorti / Beden", "Toplam Adet",
    ];
    const tableRows = source.map((row) => [
      row.orderNo, row.modelNo, row.customerId, row.color, row.fabricType, row.tableName,
      row.reportNumber, row.fabricWidth ? `${row.fabricWidth} cm` : "-",
      `${row.quantityKg} kg`, `${row.quantityMeter} m`,
      String(row.layerCount), String(row.outputQuantity),
      `${row.actualGrammage.toFixed(1)} g/m²`, `${row.targetGrammage.toFixed(1)} g/m²`,
      row.grammageStatus, `%${row.cuttingWastePercent.toFixed(1)}`,
      String(row.planKat), row.sizeDistribution, String(row.totalOrderQuantity),
    ]);

    const docWithTable = doc as jsPDF & { autoTable: (options: any) => void };
    docWithTable.autoTable({
      head: [tableColumn], body: tableRows, startY: 35, theme: "grid",
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    doc.save(onlySelected ? "kesim_raporu_secili.pdf" : "kesim_raporu.pdf");
    addToast("PDF dosyası indirildi", "success");
  };

  /* ---------- Gramaj badge ---------- */
  const grammageBadge = (status: string) => {
    const cls =
      status === "Hedef tuttu" ? "fs-badge-tuttu"
      : status === "Hedef dışı" ? "fs-badge-disi"
      : "fs-badge-bekle";
    return <span className={`fs-grammage-badge ${cls}`}>{status}</span>;
  };

  const grammageStripeColor = (status: string) => {
    if (status === "Hedef tuttu") return "var(--fs-success)";
    if (status === "Hedef dışı") return "var(--fs-danger)";
    return "var(--fs-warn)";
  };

  /* ---------- Yükleme iskeleti ---------- */
  const renderSkeletonRows = () =>
    Array.from({ length: 6 }).map((_, i) => (
      <tr key={`sk-${i}`} className={`fs-table-row ${i % 2 ? "fs-even" : ""}`}>
        <td colSpan={visibleColCount + 1} style={{ ...ui.td, padding: "14px 16px" }}>
          <span className="fs-skeleton" style={{ width: "100%", height: 14 }} />
        </td>
      </tr>
    ));

  /* ---------- Sayfa numaraları ---------- */
  const renderPageNumbers = () => {
    const pages: (number | "...")[] = [];
    const total = pageCount;
    const current = safePage;
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push("...");
      for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
      if (current < total - 2) pages.push("...");
      pages.push(total);
    }
    return pages.map((p, i) =>
      p === "..." ? (
        <span key={`d-${i}`} style={{ padding: "0 6px", color: "var(--fs-text-soft)" }}>…</span>
      ) : (
        <button
          key={p}
          className={`fs-page-btn ${p === current ? "fs-page-active" : ""}`}
          onClick={() => setCurrentPage(p)}
        >
          {p}
        </button>
      )
    );
  };

  /* ============================================================
     RENDER
  ============================================================ */
  return (
    <div className={`fs-page ${darkMode ? "fs-dark" : ""}`} style={ui.page}>
      <style>{cssText}</style>

      {/* Toast container */}
      <div className="fs-toast-container" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`fs-toast fs-${t.type}`}>
            <span>{t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Başlık */}
      <div style={ui.header}>
        <div>
          <h1 style={ui.title}>Kesim Raporu</h1>
          <p style={ui.subtitle}>Kumaş çıkışları, gramaj takibi ve kesim firesi özeti</p>
        </div>
        <div style={ui.btnRow}>
          {dirtyRows.size > 0 && (
            <button
              className="fs-btn"
              onClick={saveAllDirty}
              style={{ ...ui.primaryBtn, background: "var(--fs-primary)", color: "#fff" }}
            >
              💾 Tümünü Kaydet ({dirtyRows.size})
            </button>
          )}
          <button className="fs-btn" onClick={() => setDarkMode((d) => !d)} style={ui.ghostBtn} aria-label="Tema değiştir">
            {darkMode ? "☀️ Açık" : "🌙 Koyu"}
          </button>
          <button className="fs-btn" onClick={() => exportToExcel(false)} style={ui.primaryBtn}>
            <span>📊</span> Excel
          </button>
          <button className="fs-btn" onClick={() => exportToPDF(false)} style={ui.dangerBtn}>
            <span>📄</span> PDF
          </button>
        </div>
      </div>

      {/* Özet kartları */}
      <div style={ui.statsGrid}>
        <div className="fs-stat-card" style={ui.statCard}>
          <span style={ui.statLabel}>Toplam Kayıt</span>
          <span style={ui.statValue}>{fmt(stats.total)}</span>
          <span style={ui.statHint}>filtreye uyan</span>
        </div>
        <div className="fs-stat-card" style={ui.statCard}>
          <span style={ui.statLabel}>Toplam Kg</span>
          <span style={ui.statValue}>{fmt(stats.totalKg, 1)} kg</span>
          <span style={ui.statHint}>çıkış ağırlığı</span>
        </div>
        <div className="fs-stat-card" style={ui.statCard}>
          <span style={ui.statLabel}>Toplam Metre</span>
          <span style={ui.statValue}>{fmt(stats.totalMeter, 1)} m</span>
          <span style={ui.statHint}>çıkış uzunluğu</span>
        </div>
        <div className="fs-stat-card" style={ui.statCard}>
          <span style={ui.statLabel}>Toplam Çıkan Adet</span>
          <span style={ui.statValue}>{fmt(stats.totalOutput)}</span>
          <span style={ui.statHint}>kat × miktar</span>
        </div>
        <div className="fs-stat-card" style={ui.statCard}>
          <span style={ui.statLabel}>Hedef Tutan</span>
          <span style={{
            ...ui.statValue,
            color: stats.ratio >= 70 ? "var(--fs-success)" : stats.ratio >= 40 ? "var(--fs-warn)" : "var(--fs-danger)",
          }}>
            {fmt(stats.ratio, 1)}%
          </span>
          <span style={ui.statHint}>{stats.onTarget} / {stats.total} kayıt</span>
        </div>
      </div>

      {/* Filtreler */}
      <div style={ui.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <span style={ui.cardTitle}>🔎 Filtreler ve Arama</span>
          <button className="fs-btn" onClick={resetFilters} style={ui.ghostBtn}>Filtreleri Sıfırla</button>
        </div>

        <div style={ui.filterGrid}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={ui.label}>Genel Arama</label>
            <input
              className="fs-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Sipariş, model, müşteri, renk, kumaş…"
              style={ui.input}
            />
          </div>
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

        {/* Kaydedilmiş filtreler */}
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px dashed var(--fs-border)" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ ...ui.label, margin: 0, display: "inline-block" }}>Kayıtlı Filtreler:</span>
            {savedFilters.length === 0 && (
              <span style={{ fontSize: "0.82rem", color: "var(--fs-text-soft)" }}>henüz kayıt yok</span>
            )}
            {savedFilters.map((f) => (
              <span
                key={f.name}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "var(--fs-primary-soft)", color: "var(--fs-primary-strong)",
                  padding: "4px 10px", borderRadius: 999, fontSize: "0.82rem", fontWeight: 600,
                }}
              >
                <button
                  onClick={() => applySavedFilter(f.name)}
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit", fontWeight: 600, fontSize: "0.82rem", padding: 0 }}
                >
                  {f.name}
                </button>
                <button
                  onClick={() => deleteSavedFilter(f.name)}
                  aria-label={`${f.name} filtresini sil`}
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit", padding: 0, fontWeight: 700 }}
                >
                  ×
                </button>
              </span>
            ))}
            <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
              <input
                className="fs-input"
                type="text"
                value={newFilterName}
                onChange={(e) => setNewFilterName(e.target.value)}
                placeholder="Yeni filtre adı…"
                style={{ ...ui.input, minHeight: 34, padding: "4px 10px", width: 180 }}
              />
              <button className="fs-btn" onClick={saveCurrentFilter} style={ui.smallBtn}>Kaydet</button>
            </div>
          </div>
        </div>
      </div>

      {/* Kolon yönetimi (katlanabilir) */}
      <div style={ui.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={ui.cardTitle}>
            🧩 Kolon Yönetimi
            <span style={{ fontSize: "0.75rem", color: "var(--fs-text-soft)", fontWeight: 600, marginLeft: 8 }}>
              ({visibleColCount}/{allColumnDefs.length} görünür)
            </span>
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="fs-btn" onClick={() => setShowColumns((s) => !s)} style={ui.smallBtn}>
              {showColumns ? "▲ Gizle" : "▼ Göster"}
            </button>
            <button
              className="fs-btn"
              onClick={() => setVisibleColumns(Object.fromEntries(allColumnDefs.map((c) => [c.key, true])))}
              style={ui.smallBtn}
            >
              Tümünü Göster
            </button>
            <button
              className="fs-btn"
              onClick={() => setVisibleColumns(Object.fromEntries(allColumnDefs.map((c) => [c.key, false])))}
              style={ui.smallBtn}
            >
              Tümünü Gizle
            </button>
          </div>
        </div>

        <div className="fs-collapse" style={{ maxHeight: showColumns ? 700 : 0, opacity: showColumns ? 1 : 0 }}>
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

      {/* Seçili satır aksiyonları */}
      {selectedIds.size > 0 && (
        <div style={{ ...ui.card, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>
            <b>{selectedIds.size}</b> satır seçili
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="fs-btn" onClick={() => exportToExcel(true)} style={ui.primaryBtn}>📊 Seçilenleri Excel</button>
            <button className="fs-btn" onClick={() => exportToPDF(true)} style={ui.dangerBtn}>📄 Seçilenleri PDF</button>
            <button className="fs-btn" onClick={() => setSelectedIds(new Set())} style={ui.ghostBtn}>Seçimi Temizle</button>
          </div>
        </div>
      )}

      {/* Tablo / Mobil kartlar */}
      <div style={ui.tableCard} ref={tableRef}>
        {isMobile ? (
          <div className="fs-mobile-cards">
            {loading && Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="fs-mobile-card">
                <span className="fs-skeleton" style={{ width: "60%", height: 16, marginBottom: 10 }} />
                <span className="fs-skeleton" style={{ width: "100%", height: 12, marginBottom: 6 }} />
                <span className="fs-skeleton" style={{ width: "80%", height: 12 }} />
              </div>
            ))}
            {!loading && filteredRows.length === 0 && (
              <div className="fs-mobile-card" style={{ textAlign: "center", padding: 32 }}>
                <div style={{ fontSize: "2rem", marginBottom: 8 }}>🔍</div>
                <div style={{ fontWeight: 700 }}>Kayıt bulunamadı</div>
                <div style={{ fontSize: "0.85rem", color: "var(--fs-text-soft)" }}>Filtre kriterlerinize uygun kayıt yok.</div>
              </div>
            )}
            {!loading && paginatedRows.map((row) => (
              <div key={row.id} className="fs-mobile-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700 }}>
                    <input
                      className="fs-checkbox"
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={() => toggleRow(row.id)}
                    />
                    {row.orderNo}
                  </label>
                  {grammageBadge(row.grammageStatus)}
                </div>
                <div className="fs-mobile-card-row"><span>Model</span><span>{row.modelNo}</span></div>
                <div className="fs-mobile-card-row"><span>Müşteri</span><span>{row.customerId}</span></div>
                <div className="fs-mobile-card-row"><span>Kumaş</span><span>{row.fabricType}</span></div>
                <div className="fs-mobile-card-row"><span>Masa</span><span>{row.tableName}</span></div>
                <div className="fs-mobile-card-row"><span>Kg / m</span><span>{fmt(row.quantityKg, 1)} / {fmt(row.quantityMeter, 1)}</span></div>
                <div className="fs-mobile-card-row"><span>Kat / Çıkan</span><span>{row.layerCount} / {row.outputQuantity}</span></div>
                <div className="fs-mobile-card-row"><span>Kesim Firesi</span><span>%{row.cuttingWastePercent.toFixed(1)}</span></div>
                <div className="fs-mobile-card-row"><span>Asorti</span><span>{row.sizeDistribution}</span></div>
              </div>
            ))}
          </div>
        ) : (
          <div style={ui.tableScroll}>
            <table style={ui.table}>
              <thead>
                <tr>
                  {/* Checkbox kolonu (sticky) */}
                  <th
                    className="fs-th fs-sticky-checkbox fs-sticky-head-first"
                    style={{ ...ui.th, width: 44, textAlign: "center", cursor: "default" }}
                  >
                    <input
                      className="fs-checkbox"
                      type="checkbox"
                      checked={pageAllSelected}
                      ref={(el) => { if (el) el.indeterminate = pageSomeSelected; }}
                      onChange={togglePageAll}
                      aria-label="Sayfadaki tümünü seç"
                    />
                  </th>

                  {visibleHeaders.map((head, idx) => {
                    const isFirstData = idx === 0;
                    const ariaSort =
                      sortConfig.key === head.key
                        ? sortConfig.direction === "asc" ? "ascending" : "descending"
                        : "none";
                    return (
                      <th
                        key={head.key}
                        className={`fs-th ${isFirstData ? "fs-sticky-first fs-sticky-head-first" : "fs-sticky-head"}`}
                        onClick={() => handleSort(head.key)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSort(head.key);
                          }
                        }}
                        tabIndex={0}
                        role="columnheader"
                        aria-sort={ariaSort as any}
                        style={{
                          ...ui.th,
                          width: getColumnWidth(head.key),
                          minWidth: 90,
                          maxWidth: 520,
                        }}
                      >
                        {head.label}
                        {sortConfig.key === head.key ? (sortConfig.direction === "asc" ? " ↑" : " ↓") : ""}
                        <span
                          className="fs-resizer"
                          role="separator"
                          aria-orientation="vertical"
                          aria-label={`${head.label} kolon genişliği`}
                          tabIndex={0}
                          onMouseDown={(e) => handleResizeStart(head.key, e)}
                          onKeyDown={(e) => handleResizeKey(head.key, e)}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: "absolute", right: 0, top: 0, bottom: 0, width: 6,
                            cursor: "col-resize", background: "transparent",
                            borderRight: "2px solid var(--fs-border-strong)",
                          }}
                        />
                      </th>
                    );
                  })}

                  {visibleColumns["totalOrderQuantity"] && (
                    <th
                      className="fs-th fs-sticky-head"
                      style={{ ...ui.th, width: getColumnWidth("totalOrderQuantity"), minWidth: 90 }}
                    >
                      Toplam Adet
                      <span
                        className="fs-resizer"
                        role="separator"
                        aria-orientation="vertical"
                        tabIndex={0}
                        onMouseDown={(e) => handleResizeStart("totalOrderQuantity", e)}
                        onKeyDown={(e) => handleResizeKey("totalOrderQuantity", e)}
                        style={{
                          position: "absolute", right: 0, top: 0, bottom: 0, width: 6,
                          cursor: "col-resize", background: "transparent",
                          borderRight: "2px solid var(--fs-border-strong)",
                        }}
                      />
                    </th>
                  )}

                  {visibleColumns["divideBy"] && (
                    <th
                      className="fs-th fs-sticky-head"
                      style={{ ...ui.th, width: getColumnWidth("divideBy"), minWidth: 90, cursor: "default" }}
                    >
                      Bölünecek Birim
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {loading && renderSkeletonRows()}

                {!loading && filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={visibleColCount + 1} style={{ ...ui.td, ...ui.tdCenter, padding: "48px 16px" }}>
                      <div style={{ fontSize: "2rem", marginBottom: 8 }}>🔍</div>
                      <div style={{ fontWeight: 700, color: "var(--fs-text)", marginBottom: 4 }}>Kayıt bulunamadı</div>
                      <div style={{ fontSize: "0.85rem", color: "var(--fs-text-soft)" }}>
                        Filtre kriterlerinize uygun kayıt yok.
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && paginatedRows.map((row, index) => {
                  const isSelected = selectedIds.has(row.id);
                  const isDirty = dirtyRows.has(row.id);
                  const rowCls = [
                    "fs-table-row",
                    index % 2 ? "fs-even" : "",
                    isSelected ? "fs-selected" : "",
                    isDirty ? "fs-dirty" : "",
                  ].filter(Boolean).join(" ");

                  return (
                    <tr key={row.id} className={rowCls}>
                      {/* Checkbox (sticky) */}
                      <td
                        className="fs-sticky-checkbox"
                        style={{ ...ui.td, width: 44, textAlign: "center" }}
                      >
                        <input
                          className="fs-checkbox"
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(row.id)}
                          aria-label={`${row.orderNo} satırını seç`}
                        />
                      </td>

                      {visibleHeaders.map((head, idx) => {
                        const isFirstData = idx === 0;
                        const cls = isFirstData ? "fs-sticky-first" : "";
                        const cellStyle = {
                          ...ui.td,
                          width: getColumnWidth(head.key),
                        };
                        return (
                          <td
                            key={head.key}
                            className={cls}
                            style={cellStyle}
                          >
                            {isFirstData && (
                              <span
                                className="fs-stripe"
                                style={{ background: grammageStripeColor(row.grammageStatus) }}
                              />
                            )}
                            {head.key === "orderNo" && (
                              <>
                                {isDirty && <span className="fs-dirty-dot" title="Kaydedilmemiş değişiklik" />}
                                <span style={{ fontWeight: 600 }}>{row.orderNo}</span>
                              </>
                            )}
                            {head.key === "modelNo" && row.modelNo}
                            {head.key === "customerId" && row.customerId}
                            {head.key === "color" && row.color}
                            {head.key === "fabricType" && <span style={ui.badgeMain}>{row.fabricType}</span>}
                            {head.key === "tableName" && row.tableName}
                            {head.key === "reportNumber" && row.reportNumber}
                            {head.key === "fabricWidth" && (row.fabricWidth ? `${row.fabricWidth} cm` : "-")}
                            {head.key === "quantityKg" && <span style={ui.badgeKg}>{fmt(row.quantityKg, 1)} kg</span>}
                            {head.key === "quantityMeter" && <span style={ui.badgeM}>{fmt(row.quantityMeter, 1)} m</span>}
                            {head.key === "layerCount" && (
                              <input
                                className="fs-input"
                                type="number"
                                min={0}
                                value={row.layerCount}
                                onChange={(e) => handleLayerCountChange(row.id, e.target.value)}
                                style={{
                                  width: 72, padding: "4px 8px", border: "1px solid var(--fs-border-strong)",
                                  borderRadius: 8, fontSize: "0.85rem", background: "var(--fs-surface-3)",
                                  color: "var(--fs-text)", textAlign: "center",
                                }}
                              />
                            )}
                            {head.key === "outputQuantity" && (
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <input
                                  className="fs-input"
                                  type="number"
                                  min={0}
                                  value={row.outputQuantity}
                                  onChange={(e) => handleOutputChange(row.id, e.target.value)}
                                  style={{
                                    width: 82, padding: "5px 8px",
                                    border: "1px solid var(--fs-border-strong)", borderRadius: 8,
                                    fontSize: "0.85rem", background: "var(--fs-surface-3)",
                                    color: "var(--fs-text)",
                                  }}
                                />
                                <button
                                  className="fs-btn"
                                  onClick={() => saveRow(row)}
                                  disabled={saving.has(row.id) || !isDirty}
                                  style={{
                                    padding: "5px 10px", fontSize: 12, fontWeight: 700,
                                    borderRadius: 8,
                                    border: `1px solid ${isDirty ? "var(--fs-primary)" : "var(--fs-border)"}`,
                                    background: saving.has(row.id) ? "var(--fs-surface-2)" : (isDirty ? "var(--fs-primary)" : "var(--fs-surface)"),
                                    color: isDirty ? "#fff" : "var(--fs-text-soft)",
                                    cursor: isDirty ? "pointer" : "not-allowed",
                                  }}
                                >
                                  {saving.has(row.id) ? "…" : "Kaydet"}
                                </button>
                              </div>
                            )}
                            {head.key === "actualGrammage" && (row.actualGrammage ? `${row.actualGrammage.toFixed(1)} g/m²` : "-")}
                            {head.key === "targetGrammage" && (row.targetGrammage ? `${row.targetGrammage.toFixed(1)} g/m²` : "-")}
                            {head.key === "grammageStatus" && grammageBadge(row.grammageStatus)}
                            {head.key === "cuttingWastePercent" && (
                              <span style={{
                                color: row.cuttingWastePercent > 10 ? "var(--fs-danger)" : "var(--fs-text)",
                                fontWeight: 600,
                              }}>
                                %{row.cuttingWastePercent.toFixed(1)}
                              </span>
                            )}
                            {head.key === "planKat" && <span style={{ textAlign: "center", display: "block" }}>{row.planKat}</span>}
                            {head.key === "sizeDistribution" && row.sizeDistribution}
                          </td>
                        );
                      })}

                      {visibleColumns["totalOrderQuantity"] && (
                        <td style={{ ...ui.td, width: getColumnWidth("totalOrderQuantity") }}>
                          {fmt(row.totalOrderQuantity)}
                        </td>
                      )}

                      {visibleColumns["divideBy"] && (
                        <td style={{ ...ui.td, width: getColumnWidth("divideBy") }}>
                          <select
                            className="fs-input"
                            value={row.divideBy}
                            onChange={(e) => handleDivideByChange(row.id, e.target.value as "kg" | "meter")}
                            style={{
                              padding: "5px 8px", border: "1px solid var(--fs-border-strong)",
                              borderRadius: 8, fontSize: "0.85rem",
                              background: "var(--fs-surface-3)", color: "var(--fs-text)",
                            }}
                          >
                            <option value="kg">kg</option>
                            <option value="meter">metre</option>
                          </select>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Sayfalama */}
        {!loading && filteredRows.length > 0 && (
          <div className="fs-pagination">
            <div>
              Toplam <b style={{ color: "var(--fs-text)" }}>{filteredRows.length}</b> kayıt
              {pageSize < filteredRows.length && (
                <> · sayfa {safePage} / {pageCount}</>
              )}
              {dirtyRows.size > 0 && (
                <span style={{ marginLeft: 12, color: "var(--fs-warn)", fontWeight: 700 }}>
                  · {dirtyRows.size} kaydedilmemiş
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                Sayfa boyutu:
                <select
                  className="fs-input"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  style={{
                    padding: "4px 8px", border: "1px solid var(--fs-border-strong)",
                    borderRadius: 8, fontSize: "0.82rem",
                    background: "var(--fs-surface-3)", color: "var(--fs-text)",
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>

              {pageCount > 1 && (
                <div className="fs-pagination-btns">
                  <button className="fs-page-btn" onClick={() => setCurrentPage(1)} disabled={safePage === 1} aria-label="İlk sayfa">«</button>
                  <button className="fs-page-btn" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} aria-label="Önceki sayfa">‹</button>
                  {renderPageNumbers()}
                  <button className="fs-page-btn" onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))} disabled={safePage === pageCount} aria-label="Sonraki sayfa">›</button>
                  <button className="fs-page-btn" onClick={() => setCurrentPage(pageCount)} disabled={safePage === pageCount} aria-label="Son sayfa">»</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}