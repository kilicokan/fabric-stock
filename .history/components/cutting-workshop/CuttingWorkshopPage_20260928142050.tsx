"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AuthGuard from "../../components/AuthGuard";
import { readParameterSettings } from "../../lib/parameters";
import { connectScale, readScaleWeight } from "../../lib/scale";
import type { ScaleReading, WebSerialPort } from "../../lib/scale";

/* ================================================================== */
/* TİPLER                                                              */
/* ================================================================== */
interface CuttingReportData {
  asortiCount: string;
  planKat: string;
  atilanKat: string;
  fiiliOrtalamaKumasEni: string;
  fiiliOrtalamaGramaj: string;
  fiiliToplamBasi: string;
  fiiliKirpinti: string;
  fiiliToplamAtılanKat: string;
  fabricExitQuantity: string;
  fabricExitUnit: string;
  aciklama: string;
}
interface FabricExitInfo {
  quantity: number;
  unit: 'kg' | 'm' | 'mixed';
  reportNumber?: string | null;
  quantityKg?: number;
  quantityM?: number;
}
interface WorkOrderTracking {
  id: number;
  processType: string;
  status: string;
  notes: string;
  createdAt: string;
  workshop?: { name: string } | null;
}
interface CuttingOrder {
  id: number;
  orderNo: string;
  productCode: string;
  productName: string;
  productColor?: string | null;
  colorVariants?: string[];
  quantity: number;
  customerName: string;
  deliveryDate?: string | null;
  status: string;
  sewingNotes?: string | null;
  notes?: string | null;
  assignedToMobile: boolean;
  fasonTrackings: WorkOrderTracking[];
}
interface MtkSpreadingRun {
  id: number;
  machine: string;
  status: string;
  layerSet: number | null;
  currentLayer: number | null;
  pastelMeter: number | null;
  pastelPositionMeter: number | null;
  widthCm: number | null;
  tension: number | null;
  forwardSpeed: number | null;
  reverseSpeed: number | null;
  sourceUpdatedAt: string | null;
  machineId?: number | null;
  cuttingTableId?: number | null;
}
interface SpreadingMachine {
  id: number;
  code: string;
  name: string;
  cuttingTable: { id: number; name: string };
}
interface SpreadingLayerInput {
  color: string;
  layerNumber: number;
  weightKg: number;
  pieceCount: number;
}
type SpreadingMode = 'weight-first' | 'spread-then-weight';
interface RollEntry {
  id: string;
  color: string;
  rollNumber: number;
  weightKg: number;
  calculatedLayers: number;
  pieceCount: number;
  createdAt: string;
}
interface WeightCalcInputs {
  gramaje: number;
  widthCm: number;
  lengthM: number;
}
interface RollTotals {
  weightKg: number;
  layers: number;
  pieceCount: number;
  rolls: number;
}
interface ChecklistItem {
  text: string;
  checkedBy?: string;
  checkedAt?: string;
}
interface FabricInfo {
  width: number | null;
  name: string;
  averageGrammage?: number | null;
  productAverageGrammage?: number | null;
}
interface CuttingTable {
  id: number;
  name: string;
}
interface ProductAsortiInfo {
  sizeChart: string[];
  defaultAsortiCount: number;
  fabricWidth: number | null;
  fabricName: string;
  fabricUnit: string;
  fabricStockQuantity: number | null;
}
interface FabricExitDetail {
  pastelEni: number;
  pastelBoyu: number;
  metreKareAgirlik: number;
  pastelAgirlik: number;
  grammage: number;
  layerCount: number;
  productWeightKg: number;
  productLengthMeter: number;
  unitType: string;
  color: string | null;
  reportNumber: string | null;
  cuttingTable: { name: string } | null;
  fabricEntry?: {
    fabric?: {
      width: number | null;
      name: string;
      averageGrammage?: number | null;
    } | null;
  } | null;
}
interface LayRow {
  color: string;
  kat: number;
  value: number;
  unit: 'kg' | 'm';
  kg: number;
}

/* ====== YENİ TİPLER ====== */
interface TelemetryPoint {
  t: number;
  forward: number;
  reverse: number;
  tension: number;
}
interface PhotoAttachment {
  id: string;
  dataUrl: string;
  createdAt: string;
  label: string;
}
interface OfflineItem {
  id: string;
  url: string;
  method: string;
  body: string;
  headers: Record<string, string>;
  createdAt: string;
  label: string;
}
interface SessionStats {
  startedAt: string;
  completedOrders: number;
  totalKgCut: number;
  totalWasteKg: number;
  totalDefectiveKg: number;
  totalOrdersWorked: Set<number>;
}
type PriorityLevel = 'overdue' | 'urgent' | 'soon' | 'normal';

/* ================================================================== */
/* SABİTLER                                                            */
/* ================================================================== */
const MOCK_SPREADING_RUN: MtkSpreadingRun = {
  id: 0,
  machine: 'Serim Makinesi 01',
  status: 'HAZIR',
  layerSet: 120,
  currentLayer: 0,
  pastelMeter: 9.42,
  pastelPositionMeter: 9.42,
  widthCm: 180,
  tension: 90,
  forwardSpeed: 80,
  reverseSpeed: 60,
  sourceUpdatedAt: new Date().toISOString(),
};
const defaultCuttingReport: CuttingReportData = {
  asortiCount: '',
  planKat: '',
  atilanKat: '',
  fiiliOrtalamaKumasEni: '',
  fiiliOrtalamaGramaj: '',
  fiiliToplamBasi: '',
  fiiliKirpinti: '',
  fiiliToplamAtılanKat: '',
  fabricExitQuantity: '',
  fabricExitUnit: '',
  aciklama: '',
};
const DEFAULT_SIZE_DISTRIBUTION = ['S', 'M', 'L', 'XL'];
const DEFAULT_ASSORTI_TOTAL = 4;
const QUICK_NOTES = [
  'Kalite uygun',
  'En dar — dikkat',
  'Kat eksik',
  'Gramaj hedef dışı',
  'Serim tamam',
  'Kumaş hatası',
];
const OFFLINE_QUEUE_KEY = 'cutting_offline_queue_v1';
const IDLE_LOCK_MS = 5 * 60 * 1000;
const TELEMETRY_MAX = 60;

/* ================================================================== */
/* YARDIMCI FONKSİYONLAR                                               */
/* ================================================================== */
const parseProductSewingNotes = (sewingNotes: string | null | undefined): ProductAsortiInfo => {
  const result: ProductAsortiInfo = {
    sizeChart: DEFAULT_SIZE_DISTRIBUTION,
    defaultAsortiCount: DEFAULT_ASSORTI_TOTAL,
    fabricWidth: null,
    fabricName: '',
    fabricUnit: '',
    fabricStockQuantity: null,
  };
  if (!sewingNotes) return result;
  try {
    const parsed = JSON.parse(sewingNotes);
    if (parsed && typeof parsed === 'object') {
      const sewingData = parsed as {
        sizeChart?: { size: string }[];
        modelInfo?: { fabricWidth?: number; fabricName?: string };
      };
      if (Array.isArray(sewingData.sizeChart) && sewingData.sizeChart.length > 0) {
        const sizes = sewingData.sizeChart.map(s => s.size?.trim()).filter(Boolean) as string[];
        if (sizes.length > 0) {
          result.sizeChart = sizes;
          result.defaultAsortiCount = sizes.length;
        }
      }
    }
  } catch {}
  return result;
};

const parseSewingNotes = (
  source?: string | null
): { cuttingReport: CuttingReportData; checklist: ChecklistItem[] } => {
  if (!source) return { cuttingReport: defaultCuttingReport, checklist: [] };
  try {
    const parsed = JSON.parse(source);
    if (parsed && typeof parsed === "object") {
      const report = parsed.cuttingReport
        ? { ...defaultCuttingReport, ...(parsed.cuttingReport as CuttingReportData) }
        : defaultCuttingReport;
      const checklist: ChecklistItem[] = Array.isArray(parsed.checklist)
        ? parsed.checklist.map((item: unknown) => {
            if (typeof item === "string") return { text: item };
            if (item && typeof item === "object") {
              const obj = item as { text?: unknown; checkedBy?: unknown; checkedAt?: unknown };
              return {
                text: typeof obj.text === "string" ? obj.text : "",
                checkedBy: typeof obj.checkedBy === "string" ? obj.checkedBy : undefined,
                checkedAt: typeof obj.checkedAt === "string" ? obj.checkedAt : undefined,
              };
            }
            return { text: "" };
          })
        : [];
      return { cuttingReport: report, checklist };
    }
  } catch {}
  return { cuttingReport: defaultCuttingReport, checklist: [] };
};

const mergeSewingNotes = (
  source: string | null | undefined,
  cuttingReport: CuttingReportData,
  checklist: ChecklistItem[],
  spreading?: {
    machine: string;
    cuttingTable: string;
    layers: SpreadingLayerInput[];
    mode?: SpreadingMode;
    rolls?: RollEntry[];
    photos?: PhotoAttachment[];
    signature?: string | null;
  }
) => {
  let parsed: Record<string, unknown> = { cuttingReport, checklist };
  if (source) {
    try {
      const existing = JSON.parse(source);
      if (existing && typeof existing === 'object') {
        parsed = { ...(existing as Record<string, unknown>), cuttingReport, checklist };
      }
    } catch {
      parsed = { legacyNotes: source, cuttingReport, checklist };
    }
  }
  if (spreading) {
    const rollColorTotals =
      spreading.rolls && spreading.rolls.length > 0
        ? Object.fromEntries(
            Array.from(
              spreading.rolls.reduce((totals, roll) => {
                const color = roll.color.trim() || 'Renk bekleniyor';
                const current = totals.get(color) || { rolls: 0, weightKg: 0, layers: 0, pieceCount: 0 };
                current.rolls += 1;
                current.weightKg += Number(roll.weightKg) || 0;
                current.layers += Number(roll.calculatedLayers) || 0;
                current.pieceCount += Number(roll.pieceCount) || 0;
                totals.set(color, current);
                return totals;
              }, new Map<string, RollTotals>())
            )
          )
        : {};
    parsed.spreading = {
      machine: spreading.machine,
      cuttingTable: spreading.cuttingTable,
      layers: spreading.layers,
      mode: spreading.mode ?? 'weight-first',
      rolls: spreading.rolls ?? [],
      rollTotals: rollColorTotals,
      photos: spreading.photos ?? [],
      signature: spreading.signature ?? null,
      totalRolls: spreading.rolls ? spreading.rolls.length : 0,
      totalRollWeightKg: spreading.rolls
        ? spreading.rolls.reduce((sum, roll) => sum + (Number(roll.weightKg) || 0), 0)
        : 0,
      totalRollLayers: spreading.rolls
        ? spreading.rolls.reduce((sum, roll) => sum + (Number(roll.calculatedLayers) || 0), 0)
        : 0,
      totalRollMeters: spreading.rolls
        ? spreading.rolls.reduce((sum, roll) => sum + (Number(roll.pieceCount) || 0), 0)
        : 0,
      colorTotals: Object.fromEntries(
        Array.from(
          spreading.layers.reduce((totals, layer) => {
            const current = totals.get(layer.color.trim() || 'Renk bekleniyor') || {
              weightKg: 0,
              pieceCount: 0,
              layers: 0,
            };
            current.weightKg += Number(layer.weightKg) || 0;
            current.pieceCount += Number(layer.pieceCount) || 0;
            current.layers += 1;
            totals.set(layer.color.trim() || 'Renk bekleniyor', current);
            return totals;
          }, new Map<string, { weightKg: number; pieceCount: number; layers: number }>())
        )
      ),
      totalWeightKg: spreading.layers.reduce((sum, l) => sum + (Number(l.weightKg) || 0), 0),
      totalPieceCount: spreading.layers.reduce((sum, l) => sum + (Number(l.pieceCount) || 0), 0),
    };
  }
  return JSON.stringify(parsed);
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const calculatePlanKat = (orderQuantity: number, asortiCount: string, atilanKat?: string): string => {
  const asortiNum = parseFloat(asortiCount);
  if (!asortiNum || asortiNum <= 0 || !orderQuantity || orderQuantity <= 0) return '';
  const layerValue = Number.parseFloat(atilanKat || '');
  if (Number.isFinite(layerValue) && layerValue > 0) {
    return String(Math.round(layerValue * asortiNum));
  }
  return String(Math.ceil(orderQuantity / asortiNum));
};

const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
};

const exitToKg = (exit: FabricExitDetail): number => {
  if (exit.unitType === 'kg') return Number(exit.productWeightKg || 0);
  if (exit.unitType === 'm') {
    const lengthM = Number(exit.productLengthMeter || 0);
    const grammage = Number(exit.grammage || 0);
    if (lengthM > 0 && grammage > 0) {
      const pastelEniCm = Number(exit.pastelEni || 0);
      const widthM = pastelEniCm > 0 ? pastelEniCm / 100 : 1;
      return Number(((lengthM * widthM * grammage) / 1000).toFixed(3));
    }
    return 0;
  }
  return 0;
};

const buildLayBreakdown = (
  exits: FabricExitDetail[],
  fallbackColor: string | null | undefined
): { rows: LayRow[]; totalKg: number } => {
  const rows: LayRow[] = [];
  let totalKg = 0;
  exits.forEach(exit => {
    const color = (exit.color && exit.color.trim()) || fallbackColor || 'Renksiz';
    const kat = Number(exit.layerCount || 0);
    if (exit.unitType === 'kg') {
      const kg = Number(exit.productWeightKg || 0);
      totalKg += kg;
      rows.push({ color, kat, value: kg, unit: 'kg', kg });
    } else {
      const kg = exitToKg(exit);
      if (kg > 0) {
        totalKg += kg;
        rows.push({ color, kat, value: kg, unit: 'kg', kg });
      } else {
        rows.push({ color, kat, value: Number(exit.productLengthMeter || 0), unit: 'm', kg: 0 });
      }
    }
  });
  return { rows, totalKg };
};

const formatLayNumber = (n: number): string =>
  Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const calculateLayersFromWeight = (
  weightKg: number,
  gramaje: number,
  widthCm: number,
  lengthM: number
): number => {
  if (gramaje <= 0 || widthCm <= 0 || lengthM <= 0 || weightKg <= 0) return 0;
  const widthM = widthCm / 100;
  const areaPerLayerM2 = widthM * lengthM;
  if (areaPerLayerM2 <= 0) return 0;
  const weightPerLayerKg = (areaPerLayerM2 * gramaje) / 1000;
  if (weightPerLayerKg <= 0) return 0;
  return Math.floor(weightKg / weightPerLayerKg);
};

const calculateRollTotalsByColor = (rolls: RollEntry[]): Map<string, RollTotals> => {
  const totals = new Map<string, RollTotals>();
  rolls.forEach(roll => {
    const color = roll.color.trim() || 'Renk bekleniyor';
    const current = totals.get(color) || { weightKg: 0, layers: 0, pieceCount: 0, rolls: 0 };
    current.weightKg += Number(roll.weightKg) || 0;
    current.layers += Number(roll.calculatedLayers) || 0;
    current.pieceCount += Number(roll.pieceCount) || 0;
    current.rolls += 1;
    totals.set(color, current);
  });
  return totals;
};

/* ====== YENİ YARDIMCI FONKSİYONLAR ====== */

// 3) Sesli geri bildirim
const playBeep = (type: 'ok' | 'error' | 'warn' = 'ok') => {
  if (typeof window === 'undefined') return;
  try {
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = 'sine';
    const freq = type === 'ok' ? 880 : type === 'error' ? 220 : 440;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (type === 'ok') {
      o.frequency.setValueAtTime(freq * 1.25, ctx.currentTime + 0.08);
    }
    g.gain.setValueAtTime(0.14, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    o.start();
    o.stop(ctx.currentTime + 0.24);
    setTimeout(() => ctx.close().catch(() => {}), 400);
  } catch {}
};

// 9) İş emri öncelik seviyesi
const getPriorityLevel = (deliveryDate?: string | null): PriorityLevel => {
  if (!deliveryDate) return 'normal';
  const t = new Date(deliveryDate).getTime();
  if (Number.isNaN(t)) return 'normal';
  const days = (t - Date.now()) / 86400000;
  if (days < 0) return 'overdue';
  if (days < 1) return 'urgent';
  if (days < 3) return 'soon';
  return 'normal';
};

const priorityColors: Record<PriorityLevel, { bg: string; border: string; text: string; label: string }> = {
  overdue: { bg: 'rgba(239,68,68,0.18)', border: '#ef4444', text: '#fca5a5', label: 'GECİKMİŞ' },
  urgent: { bg: 'rgba(245,158,11,0.18)', border: '#f59e0b', text: '#fcd34d', label: 'ACİL' },
  soon: { bg: 'rgba(59,130,246,0.14)', border: '#3b82f6', text: '#93c5fd', label: 'YAKIN' },
  normal: { bg: 'transparent', border: 'transparent', text: '#94a3b8', label: '' },
};

// 10) Offline kuyruk
const readOfflineQueue = (): OfflineItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
};
const writeOfflineQueue = (items: OfflineItem[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items));
  } catch {}
};

// 6) İmza / çizim → dataURL
const captureSignatureDataUrl = (canvas: HTMLCanvasElement | null): string | null => {
  if (!canvas) return null;
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
};

// 2) Top barkod parser: "KOD|KG" veya sadece sayı
const parseRollBarcode = (raw: string): number | null => {
  const s = raw.trim();
  if (!s) return null;
  const m = s.match(/([0-9]+(?:[.,][0-9]+)?)\s*(?:kg)?\s*$/i);
  if (m) {
    const n = Number(m[1].replace(',', '.'));
    if (Number.isFinite(n) && n > 0) return n;
  }
  const parts = s.split('|');
  if (parts.length >= 2) {
    const n = Number(parts[1].replace(',', '.'));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
};

/* ================================================================== */
/* YENİ BİLEŞENLER                                                     */
/* ================================================================== */

// 1) Sparkline
function Sparkline({
  data,
  width = 240,
  height = 56,
  color = '#3b82f6',
  min = 0,
  max = 120,
  label,
  unit,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  min?: number;
  max?: number;
  label?: string;
  unit?: string;
}) {
  const safe = data.length >= 2 ? data : [0, 0];
  const range = max - min || 1;
  const step = width / (safe.length - 1);
  const points = safe
    .map((v, i) => `${i * step},${height - ((Math.min(Math.max(v, min), max) - min) / range) * height}`)
    .join(' ');
  const last = safe[safe.length - 1] ?? 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        {label && <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>}
        <span style={{ fontSize: 12, fontWeight: 800, color }}>
          {last.toFixed(0)}
          {unit ? ` ${unit}` : ''}
        </span>
      </div>
      <svg width={width} height={height} style={{ display: 'block', background: '#0b1220', borderRadius: 6 }}>
        <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// 5) Vardiya KPI paneli
function KPIPanel({
  open,
  stats,
  onClose,
  onReset,
}: {
  open: boolean;
  stats: SessionStats;
  onClose: () => void;
  onReset: () => void;
}) {
  if (!open) return null;
  const startedAt = new Date(stats.startedAt);
  const durationMin = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 60000));
  const hours = Math.floor(durationMin / 60);
  const mins = durationMin % 60;
  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={{ ...S.lockCard, maxWidth: 520, textAlign: 'left' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ ...S.lockTitle, margin: 0 }}>Vardiya Özeti</h2>
          <button onClick={onClose} style={S.topIconButton} aria-label="Kapat">✕</button>
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>
          Başlangıç: {startedAt.toLocaleString('tr-TR')} · Süre: {hours}s {mins}dk
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <div style={S.kpiTile}>
            <span style={S.kpiLabel}>Tamamlanan iş emri</span>
            <strong style={S.kpiValue}>{stats.completedOrders}</strong>
          </div>
          <div style={S.kpiTile}>
            <span style={S.kpiLabel}>İşlenen iş emri</span>
            <strong style={S.kpiValue}>{stats.totalOrdersWorked.size}</strong>
          </div>
          <div style={S.kpiTile}>
            <span style={S.kpiLabel}>Toplam kesilen</span>
            <strong style={{ ...S.kpiValue, color: '#6ee7b7' }}>{stats.totalKgCut.toFixed(1)} kg</strong>
          </div>
          <div style={S.kpiTile}>
            <span style={S.kpiLabel}>Fire (gramaj)</span>
            <strong style={{ ...S.kpiValue, color: '#fcd34d' }}>{stats.totalWasteKg.toFixed(1)} kg</strong>
          </div>
          <div style={S.kpiTile}>
            <span style={S.kpiLabel}>Hatalı kumaş</span>
            <strong style={{ ...S.kpiValue, color: '#fca5a5' }}>{stats.totalDefectiveKg.toFixed(1)} kg</strong>
          </div>
          <div style={S.kpiTile}>
            <span style={S.kpiLabel}>Ortalama fire %</span>
            <strong style={S.kpiValue}>
              {stats.totalKgCut > 0 ? ((stats.totalWasteKg / stats.totalKgCut) * 100).toFixed(1) : '0.0'}%
            </strong>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <BigButton tone="ghost" onClick={onReset} style={{ flex: 1 }}>Sıfırla</BigButton>
          <BigButton tone="primary" onClick={onClose} style={{ flex: 1 }}>Kapat</BigButton>
        </div>
      </div>
    </div>
  );
}

// 6) İmza pad
function SignaturePad({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (dataUrl: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.clientWidth, c.clientHeight);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [open]);

  if (!open) return null;

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = true;
    lastRef.current = getPos(e);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const p = getPos(e);
    const last = lastRef.current || p;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
  };
  const end = () => {
    drawingRef.current = false;
    lastRef.current = null;
  };
  const clear = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.clientWidth, c.clientHeight);
  };
  const save = () => {
    const c = canvasRef.current;
    const data = captureSignatureDataUrl(c);
    onSave(data);
    onClose();
  };

  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={{ ...S.lockCard, maxWidth: 620, textAlign: 'left' }} onClick={e => e.stopPropagation()}>
        <h2 style={{ ...S.lockTitle, margin: 0, marginBottom: 12 }}>İmza / Onay</h2>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#94a3b8' }}>Parmak veya kalemle imzalayın.</p>
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}
          style={{
            width: '100%',
            height: 240,
            borderRadius: 12,
            border: '1px solid #334155',
            touchAction: 'none',
            cursor: 'crosshair',
            background: '#fff',
          }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <BigButton tone="ghost" onClick={clear} style={{ flex: 1 }}>Temizle</BigButton>
          <BigButton tone="ghost" onClick={onClose} style={{ flex: 1 }}>İptal</BigButton>
          <BigButton tone="success" onClick={save} style={{ flex: 2 }}>✓ Onayla ve Kaydet</BigButton>
        </div>
      </div>
    </div>
  );
}

// 4) Fotoğraf ekleme
function PhotoCapture({
  photos,
  onAdd,
  onRemove,
  disabled,
}: {
  photos: PhotoAttachment[];
  onAdd: (photo: PhotoAttachment) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const pick = () => inputRef.current?.click();

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : '';
        if (dataUrl) {
          onAdd({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            dataUrl,
            createdAt: new Date().toISOString(),
            label: file.name || 'Fotoğraf',
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={e => handleFiles(e.target.files)}
        style={{ display: 'none' }}
      />
      <button type="button" onClick={pick} disabled={disabled} style={S.photoAddBtn}>
        📷 Fotoğraf ekle ({photos.length})
      </button>
      {photos.length > 0 && (
        <div style={S.photoGrid}>
          {photos.map(p => (
            <div key={p.id} style={S.photoThumb}>
              <img src={p.dataUrl} alt={p.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button type="button" onClick={() => onRemove(p.id)} style={S.photoRemove} aria-label="Sil">
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 10) Offline banner
function OfflineBanner({
  isOnline,
  queuedCount,
  onFlush,
  syncing,
}: {
  isOnline: boolean;
  queuedCount: number;
  onFlush: () => void;
  syncing: boolean;
}) {
  if (isOnline && queuedCount === 0) return null;
  return (
    <div style={{ ...S.offlineBanner, background: isOnline ? 'rgba(245,158,11,0.14)' : 'rgba(220,38,38,0.18)' }}>
      <span style={{ fontSize: 16 }}>{isOnline ? '⚠' : '📡'}</span>
      <div style={{ flex: 1 }}>
        <strong style={{ display: 'block', fontSize: 13, color: isOnline ? '#fcd34d' : '#fca5a5' }}>
          {isOnline ? 'Senkronize edilmemiş kayıtlar var' : 'Çevrimdışı mod'}
        </strong>
        <span style={{ fontSize: 11, color: '#cbd5e1' }}>
          {queuedCount > 0 ? `${queuedCount} işlem kuyrukta` : 'Yeni işlemler kuyruğa alınacak'}
        </span>
      </div>
      {isOnline && queuedCount > 0 && (
        <SmallBtn onClick={onFlush} tone="primary" disabled={syncing}>
          {syncing ? 'Senkronize ediliyor...' : 'Şimdi senkronize et'}
        </SmallBtn>
      )}
    </div>
  );
}
// yardımcı: SmallBtn yerine inline buton (yukarıda tanımlı olduğu için placeholder ismi değiştir)
function SmallButton_V2_placeholder() { return null; }

/* ================================================================== */
/* YARDIMCI UFAK BİLEŞENLER                                            */
/* ================================================================== */
function StatusPill({
  children,
  tone = 'gray',
  icon,
}: {
  children: React.ReactNode;
  tone?: 'gray' | 'green' | 'blue' | 'amber' | 'red';
  icon?: string;
}) {
  const map: Record<string, React.CSSProperties> = {
    gray: { background: 'rgba(148,163,184,0.14)', color: '#cbd5e1' },
    green: { background: 'rgba(16,185,129,0.16)', color: '#6ee7b7' },
    blue: { background: 'rgba(59,130,246,0.16)', color: '#93c5fd' },
    amber: { background: 'rgba(245,158,11,0.16)', color: '#fcd34d' },
    red: { background: 'rgba(239,68,68,0.16)', color: '#fca5a5' },
  };
  return (
    <span style={{ ...S.statusPill, ...map[tone] }}>
      {icon && <span style={{ marginRight: 6 }}>{icon}</span>}
      {children}
    </span>
  );
}

function SmallBtn({
  children,
  tone = 'primary',
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  tone?: 'primary' | 'success' | 'danger' | 'ghost';
  disabled?: boolean;
  onClick?: () => void;
}) {
  const map: Record<string, React.CSSProperties> = {
    primary: { background: '#2563eb', color: '#fff', border: 'none' },
    success: { background: '#059669', color: '#fff', border: 'none' },
    danger: { background: '#dc2626', color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: '#cbd5e1', border: '1px solid #475569' },
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{ ...S.smallBtn, ...map[tone], ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
    >
      {children}
    </button>
  );
}

function BigButton({
  children,
  tone = 'primary',
  disabled,
  onClick,
  style,
}: {
  children: React.ReactNode;
  tone?: 'primary' | 'success' | 'danger' | 'warning' | 'ghost';
  disabled?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  const tones: Record<string, React.CSSProperties> = {
    primary: { background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff', border: 'none' },
    success: { background: 'linear-gradient(135deg,#059669,#10b981)', color: '#fff', border: 'none' },
    danger: { background: 'linear-gradient(135deg,#dc2626,#ef4444)', color: '#fff', border: 'none' },
    warning: { background: 'linear-gradient(135deg,#d97706,#f59e0b)', color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: '#cbd5e1', border: '1px solid #334155' },
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        ...S.bigButton,
        ...tones[tone],
        ...(disabled ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function ProgressRing({
  percent,
  size = 140,
  stroke = 12,
  color = '#3b82f6',
}: {
  percent: number;
  size?: number;
  stroke?: number;
  color?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(Math.max(percent, 0), 100) / 100) * c;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(148,163,184,0.18)" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={off}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 600ms ease' }}
      />
    </svg>
  );
}

function MetricTile({
  label,
  value,
  unit,
  tone = 'default',
  onClick,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: 'default' | 'blue' | 'green' | 'amber' | 'red';
  onClick?: () => void;
}) {
  const toneMap: Record<string, { bg: string; border: string; value: string }> = {
    default: { bg: '#1e293b', border: '#334155', value: '#f1f5f9' },
    blue: { bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.45)', value: '#93c5fd' },
    green: { bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.45)', value: '#6ee7b7' },
    amber: { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.45)', value: '#fcd34d' },
    red: { bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.45)', value: '#fca5a5' },
  };
  const t = toneMap[tone];
  const Comp: any = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      style={{
        ...S.metricTile,
        background: t.bg,
        borderColor: t.border,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <span style={S.metricTileLabel}>{label}</span>
      <div style={S.metricTileRow}>
        <strong style={{ ...S.metricTileValue, color: t.value }}>{value}</strong>
        {unit && <span style={S.metricTileUnit}>{unit}</span>}
      </div>
    </Comp>
  );
}

function Numpad({
  open,
  title,
  unit,
  value,
  decimal = true,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  unit?: string;
  value: string;
  decimal?: boolean;
  onClose: () => void;
  onConfirm: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => {
    if (open) setLocal(value);
  }, [open, value]);
  if (!open) return null;
  const press = (k: string) => {
    if (k === 'C') return setLocal('');
    if (k === '⌫') return setLocal(local.slice(0, -1));
    if (k === '.' && (!decimal || local.includes('.'))) return;
    setLocal(local + k);
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];
  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={S.numpad} onClick={e => e.stopPropagation()}>
        <div style={S.numpadHeader}>
          <span style={S.numpadTitle}>{title}</span>
          {unit && <span style={S.numpadUnit}>{unit}</span>}
        </div>
        <div style={S.numpadDisplay}>{local || '0'}</div>
        <div style={S.numpadGrid}>
          {keys.map(k => (
            <button key={k} type="button" onClick={() => press(k)} style={S.numpadKey}>
              {k}
            </button>
          ))}
        </div>
        <div style={S.numpadActions}>
          <button type="button" onClick={onClose} style={{ ...S.numpadBtn, ...S.numpadBtnGhost }}>
            İptal
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(local);
              onClose();
            }}
            style={{ ...S.numpadBtn, ...S.numpadBtnPrimary }}
          >
            Onayla
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickEntry({
  label,
  value,
  unit,
  onOpen,
}: {
  label: string;
  value: string;
  unit?: string;
  onOpen: () => void;
}) {
  return (
    <button type="button" onClick={onOpen} style={S.quickEntry}>
      <span style={S.quickEntryLabel}>{label}</span>
      <div style={S.quickEntryValueRow}>
        <strong style={S.quickEntryValue}>{value || '0'}</strong>
        {unit && <span style={S.quickEntryUnit}>{unit}</span>}
      </div>
    </button>
  );
}

function FieldTouch({
  label,
  value,
  unit,
  auto,
  readOnly,
  onOpen,
}: {
  label: string;
  value: string;
  unit?: string;
  auto?: boolean;
  readOnly?: boolean;
  onOpen?: () => void;
}) {
  return (
    <div style={S.fieldTouch}>
      <div style={S.fieldLabelRow}>
        <span style={S.fieldLabel}>{label}</span>
        {auto && <span style={S.autoBadge}>oto</span>}
      </div>
      <button
        type="button"
        onClick={onOpen}
        disabled={readOnly}
        style={{
          ...S.fieldTouchInput,
          ...(readOnly ? S.fieldTouchInputRO : {}),
          ...(auto ? S.fieldTouchInputAuto : {}),
        }}
      >
        <span style={S.fieldTouchValue}>{value || '—'}</span>
        {unit && <span style={S.fieldTouchUnit}>{unit}</span>}
      </button>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={S.group}>
      <div style={S.groupTitle}>{title}</div>
      <div style={S.groupBody}>{children}</div>
    </div>
  );
}

function DetailItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'red' | 'green';
}) {
  return (
    <div style={S.detailItem}>
      <span style={S.detailLabel}>{label}</span>
      <strong
        style={{
          ...S.detailValue,
          ...(tone === 'red' ? { color: '#fca5a5' } : tone === 'green' ? { color: '#6ee7b7' } : {}),
        }}
      >
        {value}
      </strong>
    </div>
  );
}

/* ================================================================== */
/* ANA BİLEŞEN                                                         */
/* ================================================================== */
const CuttingWorkshopPage = () => {
  /* ------- Durum ------- */
  const [orders, setOrders] = useState<CuttingOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [draftReport, setDraftReport] = useState<CuttingReportData>(defaultCuttingReport);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingOrderId, setSavingOrderId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [fabricExitInfo, setFabricExitInfo] = useState<FabricExitInfo | null>(null);
  const [fabricExitDetails, setFabricExitDetails] = useState<FabricExitDetail | null>(null);
  const [fabricExits, setFabricExits] = useState<FabricExitDetail[]>([]);
  const [fabricExitLoading, setFabricExitLoading] = useState(false);
  const [fabricExitCreating, setFabricExitCreating] = useState(false);
  const [cuttingTables, setCuttingTables] = useState<CuttingTable[]>([]);
  const [fabricExitUnit, setFabricExitUnit] = useState<'kg' | 'm'>('kg');
  const [fabricExitQuantityDraft, setFabricExitQuantityDraft] = useState('');
  const [productFabrics, setProductFabrics] = useState<Map<string, FabricInfo>>(new Map());
  const [productAsortiMap, setProductAsortiMap] = useState<Map<string, ProductAsortiInfo>>(new Map());
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isOperatorLocked, setIsOperatorLocked] = useState(false);
  const fabricExitRequestId = useRef(0);
  const latestOrderIds = useRef<number[]>([]);
  const [scalePort, setScalePort] = useState<WebSerialPort | null>(null);
  const [scaleReading, setScaleReading] = useState<ScaleReading | null>(null);
  const [scaleReadings, setScaleReadings] = useState<{ reading: ScaleReading; time: string; usedFor?: string }[]>([]);
  const [scaleConnecting, setScaleConnecting] = useState(false);
  const [mtkRun, setMtkRun] = useState<MtkSpreadingRun>(MOCK_SPREADING_RUN);
  const [spreadingRunsByOrder, setSpreadingRunsByOrder] = useState<Record<number, MtkSpreadingRun>>({});
  const [mtkError, setMtkError] = useState<string | null>(null);
  const [spreadingMachines, setSpreadingMachines] = useState<SpreadingMachine[]>([]);
  const [selectedMachineId, setSelectedMachineId] = useState<number | null>(null);
  const [spreadingStarted, setSpreadingStarted] = useState(false);
  const [spreadingMode, setSpreadingMode] = useState<SpreadingMode>('weight-first');
  const [rollEntries, setRollEntries] = useState<RollEntry[]>([]);
  const [weightCalcInputs, setWeightCalcInputs] = useState<WeightCalcInputs>({ gramaje: 0, widthCm: 0, lengthM: 0 });
  const [spreadingLayers, setSpreadingLayers] = useState<SpreadingLayerInput[]>([
    { color: '', layerNumber: 1, weightKg: 0, pieceCount: 0 },
  ]);
  const [showSpreadingConfirm, setShowSpreadingConfirm] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [defectiveQuantityDraft, setDefectiveQuantityDraft] = useState('');
  const [defectiveReasonDraft, setDefectiveReasonDraft] = useState('');
  const [defectiveSubmitting, setDefectiveSubmitting] = useState(false);
  const [selectedColorVariant, setSelectedColorVariant] = useState<string>('');
  const [defectiveColorVariant, setDefectiveColorVariant] = useState<string>('');
  const [sizeCounts, setSizeCounts] = useState<Record<string, number>>({});
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isDemoMode] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [spreadingPanelOpen, setSpreadingPanelOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [numpad, setNumpad] = useState<{
    open: boolean;
    key: keyof CuttingReportData | 'fabricExit' | 'defective' | null;
    title: string;
    unit?: string;
    decimal?: boolean;
  }>({ open: false, key: null, title: '' });
  const [mobileView, setMobileView] = useState<'orders' | 'work' | 'report'>('work');
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);

  /* ====== YENİ STATE ====== */
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [kpiOpen, setKpiOpen] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PhotoAttachment[]>([]);
  const [rollBarcodeInput, setRollBarcodeInput] = useState('');
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [queuedCount, setQueuedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    startedAt: new Date().toISOString(),
    completedOrders: 0,
    totalKgCut: 0,
    totalWasteKg: 0,
    totalDefectiveKg: 0,
    totalOrdersWorked: new Set<number>(),
  });
  const rollBarcodeInputRef = useRef<HTMLInputElement | null>(null);

  /* ------- Türetilmiş değerler ------- */
  const selectedOrder = orders.find(o => o.id === selectedOrderId) || null;
  const spreadingCompleted =
    mtkRun.status === 'SERİM TAMAMLANDI' ||
    (spreadingStarted &&
      mtkRun.layerSet !== null &&
      mtkRun.currentLayer !== null &&
      mtkRun.currentLayer >= mtkRun.layerSet);
  const selectedMachine = spreadingMachines.find(m => m.id === selectedMachineId);

  const colorTotals = spreadingLayers.reduce((totals, layer) => {
    const color = layer.color.trim() || 'Renk bekleniyor';
    const current = totals.get(color) || { weightKg: 0, pieceCount: 0, layers: 0 };
    current.weightKg += Number(layer.weightKg) || 0;
    current.pieceCount += Number(layer.pieceCount) || 0;
    current.layers += 1;
    totals.set(color, current);
    return totals;
  }, new Map<string, { weightKg: number; pieceCount: number; layers: number }>());
  const totalSpreadingWeightKg = Array.from(colorTotals.values()).reduce((s, v) => s + v.weightKg, 0);
  const totalSpreadingPieces = Array.from(colorTotals.values()).reduce((s, v) => s + v.pieceCount, 0);

  const rollTotalsByColor = calculateRollTotalsByColor(rollEntries);
  const totalRolls = rollEntries.length;
  const totalRollWeightKg = Array.from(rollTotalsByColor.values()).reduce((s, v) => s + v.weightKg, 0);
  const totalRollLayers = Array.from(rollTotalsByColor.values()).reduce((s, v) => s + v.layers, 0);
  const totalRollMeters = Array.from(rollTotalsByColor.values()).reduce((s, v) => s + v.pieceCount, 0);

  /* ====== 10) OFFLINE: fetch wrapper ====== */
  const performFetch = useCallback(
    async (
      url: string,
      options: RequestInit & { label?: string; queueable?: boolean } = {}
    ): Promise<Response | null> => {
      const method = (options.method || 'GET').toUpperCase();
      const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
      const queueable = options.queueable ?? true;
      if (!isOnline && isMutation && queueable) {
        const item: OfflineItem = {
          id:
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? (crypto as any).randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          url,
          method,
          body: typeof options.body === 'string' ? options.body : '',
          headers: (options.headers as Record<string, string>) || {},
          createdAt: new Date().toISOString(),
          label: options.label || `${method} ${url}`,
        };
        const q = readOfflineQueue();
        q.push(item);
        writeOfflineQueue(q);
        setQueuedCount(q.length);
        playBeep('warn');
        setInfoMessage('Çevrimdışı: işlem kuyruğa alındı.');
        return null;
      }
      try {
        const r = await fetch(url, options);
        if (!r.ok && isMutation && queueable && (r.status >= 500 || r.status === 0)) {
          const item: OfflineItem = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            url,
            method,
            body: typeof options.body === 'string' ? options.body : '',
            headers: (options.headers as Record<string, string>) || {},
            createdAt: new Date().toISOString(),
            label: options.label || `${method} ${url}`,
          };
          const q = readOfflineQueue();
          q.push(item);
          writeOfflineQueue(q);
          setQueuedCount(q.length);
        }
        return r;
      } catch (err) {
        if (isMutation && queueable) {
          const item: OfflineItem = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            url,
            method,
            body: typeof options.body === 'string' ? options.body : '',
            headers: (options.headers as Record<string, string>) || {},
            createdAt: new Date().toISOString(),
            label: options.label || `${method} ${url}`,
          };
          const q = readOfflineQueue();
          q.push(item);
          writeOfflineQueue(q);
          setQueuedCount(q.length);
          playBeep('warn');
          setInfoMessage('Bağlantı hatası: işlem kuyruğa alındı.');
          return null;
        }
        throw err;
      }
    },
    [isOnline]
  );

  const flushOfflineQueue = useCallback(async () => {
    const q = readOfflineQueue();
    if (!q.length) return;
    setSyncing(true);
    const remaining: OfflineItem[] = [];
    let success = 0;
    for (const item of q) {
      try {
        const r = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body,
        });
        if (r.ok || r.status < 500) success += 1;
        else remaining.push(item);
      } catch {
        remaining.push(item);
      }
    }
    writeOfflineQueue(remaining);
    setQueuedCount(remaining.length);
    setSyncing(false);
    if (success > 0) {
      playBeep('ok');
      setInfoMessage(`${success} işlem senkronize edildi.`);
    }
    if (remaining.length > 0) setError(`${remaining.length} işlem hâlâ kuyrukta.`);
  }, []);

  /* ====== Online durumu ====== */
  useEffect(() => {
    const on = () => {
      setIsOnline(true);
      flushOfflineQueue();
    };
    const off = () => {
      setIsOnline(false);
      playBeep('warn');
    };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    setQueuedCount(readOfflineQueue().length);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [flushOfflineQueue]);

  /* ====== 8) Otomatik kilit ====== */
  useEffect(() => {
    if (isOperatorLocked) return;
    let timer: number | undefined;
    const reset = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setIsOperatorLocked(true);
        playBeep('warn');
        setInfoMessage('Hareketsizlik nedeniyle ekran kilitlendi.');
      }, IDLE_LOCK_MS);
    };
    reset();
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart', 'wheel'];
    events.forEach(e => window.addEventListener(e, reset));
    return () => {
      if (timer) window.clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [isOperatorLocked]);

  /* ====== 1) Telemetri toplama ====== */
  useEffect(() => {
    if (!spreadingStarted) return;
    const point: TelemetryPoint = {
      t: Date.now(),
      forward: Number(mtkRun.forwardSpeed || 0),
      reverse: Number(mtkRun.reverseSpeed || 0),
      tension: Number(mtkRun.tension || 0),
    };
    setTelemetry(prev => {
      const next = [...prev, point];
      return next.length > TELEMETRY_MAX ? next.slice(next.length - TELEMETRY_MAX) : next;
    });
  }, [mtkRun, spreadingStarted]);

  /* ------- Hook'lar ------- */
  const loadMtkRun = useCallback(async () => {
    if (!selectedOrderId || !spreadingStarted) return;
    await new Promise(r => window.setTimeout(r, 150));
    setMtkRun(prev => {
      const nextLayer = Math.min((prev.currentLayer || 0) + 1, prev.layerSet || 120);
      const nextRun = {
        ...prev,
        currentLayer: nextLayer,
        status: nextLayer >= (prev.layerSet || 120) ? 'SERİM TAMAMLANDI' : 'SERİM DEVAM EDİYOR',
        sourceUpdatedAt: new Date().toISOString(),
      };
      setSpreadingRunsByOrder(runs => ({ ...runs, [selectedOrderId]: nextRun }));
      return nextRun;
    });
    setMtkError(null);
  }, [selectedOrderId, spreadingStarted]);

  const loadCuttingTables = async () => {
    try {
      const r = await fetch('/api/cutting-tables');
      if (!r.ok) return;
      const d = await r.json();
      const tables = Array.isArray(d) ? d : Array.isArray(d.data) ? d.data : [];
      setCuttingTables(tables.map((t: CuttingTable) => ({ id: Number(t.id), name: String(t.name) })));
    } catch (e) {
      console.error(e);
    }
  };

  const loadSpreadingMachines = async () => {
    try {
      const r = await fetch('/api/spreading-machines');
      if (!r.ok) throw new Error('Serim makineleri yüklenemedi.');
      const d = await r.json();
      setSpreadingMachines(Array.isArray(d.data) ? d.data : []);
    } catch (e) {
      console.error(e);
      setMtkError('Serim makineleri yüklenemedi.');
    }
  };

  const loadOrders = async (showNotifications = false): Promise<CuttingOrder[]> => {
    try {
      const r = await fetch('/api/fason/work-orders?limit=100&processType=KESIM&excludeProcessStatus=TESLIM_EDILDI');
      if (!r.ok) throw new Error('Kesim iş emirleri yüklenemiyor.');
      const d = await r.json();
      const items: CuttingOrder[] = (d.data || d || [])
        .filter((o: CuttingOrder) => Array.isArray(o.fasonTrackings))
        .map((o: CuttingOrder) => ({
          ...o,
          productColor: o.productColor || o.notes || 'Bilinmiyor',
        }));
      const currentIds = items.map(i => i.id);
      if (showNotifications && latestOrderIds.current.length > 0) {
        const added = currentIds.filter(id => !latestOrderIds.current.includes(id));
        if (added.length) setInfoMessage(`${added.length} yeni kesim emri kesim ekranına düştü.`);
      }
      latestOrderIds.current = currentIds;
      setOrders(items);
      return items;
    } catch (e) {
      console.error(e);
      setError('Kesim iş emirleri alınırken hata oluştu.');
      return [];
    }
  };

  const loadProductFabrics = async () => {
    const token = getAuthToken();
    if (!token) {
      setProductsLoaded(true);
      return;
    }
    try {
      const r = await fetch('/api/products', { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error('Ürünler yüklenemiyor.');
      const d = await r.json();
      const products = Array.isArray(d) ? d : d.products || [];
      const map = new Map<string, FabricInfo>();
      products.forEach((p: any) => {
        if (p.modelNo && p.fabric) {
          map.set(p.modelNo, {
            width: p.fabric.width ?? null,
            name: p.fabric.name || '',
            averageGrammage: p.averageGrammage ?? p.fabric.averageGrammage ?? null,
            productAverageGrammage: p.averageGrammage ?? null,
          });
        }
      });
      setProductFabrics(map);
    } catch (e) {
      console.error(e);
    } finally {
      setProductsLoaded(true);
    }
  };

  const loadProductAsortiDefaults = async (orderList: CuttingOrder[]) => {
    const token = getAuthToken();
    if (!token) return;
    const uniqueCodes = Array.from(new Set(orderList.map(o => o.productCode).filter(Boolean)));
    if (uniqueCodes.length === 0) {
      setProductAsortiMap(new Map());
      return;
    }
    const map = new Map<string, ProductAsortiInfo>();
    await Promise.all(
      uniqueCodes.map(async code => {
        try {
          const r = await fetch(`/api/fason/product-by-model?modelNo=${encodeURIComponent(code)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!r.ok) return;
          const p = await r.json();
          const info = parseProductSewingNotes(p.sewingNotes);
          if (p.fabric) {
            if (p.fabric.width) {
              info.fabricWidth = p.fabric.width;
              info.fabricName = p.fabric.name || '';
            }
            info.fabricUnit = p.fabric.unit || '';
            info.fabricStockQuantity = p.fabric.stockQuantity ?? null;
          }
          map.set(code, info);
        } catch (e) {
          console.error(e);
        }
      })
    );
    setProductAsortiMap(map);
  };

  const refreshFabricExitsForOrder = async (orderNo: string) => {
    setFabricExitLoading(true);
    try {
      const r = await fetch(`/api/fabric-exits?orderNo=${encodeURIComponent(orderNo.trim())}`);
      if (!r.ok) {
        setFabricExitInfo(null);
        setFabricExitDetails(null);
        setFabricExits([]);
        return;
      }
      const exits = await r.json();
      const rows: FabricExitDetail[] = Array.isArray(exits) ? exits : Array.isArray(exits.data) ? exits.data : [];
      if (!rows.length) {
        setFabricExitInfo(null);
        setFabricExitDetails(null);
        setFabricExits([]);
        return;
      }
      const unit = rows[0]?.unitType === 'm' ? 'm' : 'kg';
      const total = rows.reduce(
        (s, row) =>
          row.unitType === 'm' ? s + Number(row.productLengthMeter || 0) : s + Number(row.productWeightKg || 0),
        0
      );
      const latest = rows[0];
      setFabricExitInfo({ quantity: total, unit, reportNumber: latest?.reportNumber || null });
      setFabricExitDetails(latest || null);
      setFabricExits(rows);
      setDraftReport(prev => ({
        ...prev,
        fabricExitQuantity: String(total || prev.fabricExitQuantity || ''),
        fabricExitUnit: unit,
      }));
    } catch (e) {
      console.error(e);
      setFabricExitInfo(null);
      setFabricExitDetails(null);
      setFabricExits([]);
    } finally {
      setFabricExitLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const initLoad = async () => {
      await Promise.all([loadCuttingTables(), loadSpreadingMachines()]);
      const [items] = await Promise.all([loadOrders(), loadProductFabrics()]);
      if (mounted && items.length > 0) await loadProductAsortiDefaults(items);
      if (mounted) setLoading(false);
    };
    initLoad();
    const t = window.setInterval(() => loadOrders(true), 30000);
    return () => {
      mounted = false;
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => {
    loadMtkRun();
    const t = window.setInterval(loadMtkRun, 10000);
    return () => window.clearInterval(t);
  }, [loadMtkRun]);

  useEffect(() => {
    if (!selectedOrder) {
      setSelectedColorVariant('');
      return;
    }
    const variants =
      selectedOrder.colorVariants && selectedOrder.colorVariants.length > 0
        ? selectedOrder.colorVariants
        : selectedOrder.productColor
        ? [selectedOrder.productColor]
        : [];
    setSelectedColorVariant(variants[0] || '');
  }, [selectedOrderId, selectedOrder?.colorVariants, selectedOrder?.productColor]);

  useEffect(() => {
    if (!selectedOrderId) return;
    const existing = spreadingRunsByOrder[selectedOrderId];
    if (existing) {
      setMtkRun(existing);
      setSpreadingStarted(existing.status !== 'HAZIR');
      return;
    }
    const initial = {
      ...MOCK_SPREADING_RUN,
      externalRunId: `DEMO-${selectedOrderId}`,
      currentLayer: 0,
      sourceUpdatedAt: new Date().toISOString(),
    } as MtkSpreadingRun & { externalRunId: string };
    setMtkRun(initial);
    setSpreadingStarted(false);
    setSelectedMachineId(null);
    setSpreadingLayers([{ color: '', layerNumber: 1, weightKg: 0, pieceCount: 0 }]);
    setTelemetry([]);
    setSpreadingRunsByOrder(runs => ({ ...runs, [selectedOrderId]: initial }));
  }, [selectedOrderId, spreadingRunsByOrder]);

  useEffect(() => {
    if (!orders.length) return;
    const params = new URLSearchParams(window.location.search);
    const orderNo = params.get('orderNo');
    const workOrderId = params.get('workOrderId');
    if (!orderNo && !workOrderId) return;
    const m = orders.find(o => {
      if (workOrderId && String(o.id) === String(workOrderId)) return true;
      if (orderNo && o.orderNo.trim().toLowerCase() === orderNo.trim().toLowerCase()) return true;
      return false;
    });
    if (m) setSelectedOrderId(m.id);
  }, [orders]);

  useEffect(() => {
    const requestId = ++fabricExitRequestId.current;
    let isMounted = true;

    if (!selectedOrder) {
      setDraftReport(defaultCuttingReport);
      setChecklist([]);
      setFabricExitInfo(null);
      setFabricExitDetails(null);
      setFabricExits([]);
      setFabricExitLoading(false);
      setAutoFilledFields(new Set());
      return;
    }

    const parsed = parseSewingNotes(selectedOrder.sewingNotes);
    const autoFilled = new Set<string>();
    const asortiCount = parsed.cuttingReport.asortiCount || '';
    const productDefault = productAsortiMap.get(selectedOrder.productCode);
    const productDefaultAsorti = productDefault?.defaultAsortiCount ?? DEFAULT_ASSORTI_TOTAL;

    if (!selectedOrder.orderNo?.trim()) {
      if (isMounted && requestId === fabricExitRequestId.current) {
        setDraftReport({
          ...parsed.cuttingReport,
          asortiCount,
          planKat: asortiCount ? calculatePlanKat(selectedOrder.quantity, asortiCount) : parsed.cuttingReport.planKat,
        });
        setChecklist(parsed.checklist);
        setFabricExitInfo(null);
        setFabricExitDetails(null);
        setAutoFilledFields(autoFilled);
      }
      return;
    }

    const effectiveAsortiCount = parsed.cuttingReport.asortiCount || String(productDefaultAsorti);
    setDraftReport({
      ...parsed.cuttingReport,
      asortiCount: effectiveAsortiCount,
      planKat: effectiveAsortiCount ? calculatePlanKat(selectedOrder.quantity, effectiveAsortiCount) : parsed.cuttingReport.planKat,
    });
    setChecklist(parsed.checklist);
    setFabricExitLoading(true);

    const fetchExitInfo = async () => {
      try {
        const r = await fetch(`/api/fabric-exits?orderNo=${encodeURIComponent(selectedOrder.orderNo.trim())}&aggregate=true`);
        if (!r.ok) {
          if (isMounted && requestId === fabricExitRequestId.current) {
            setFabricExitInfo(null);
            setFabricExitDetails(null);
            setFabricExits([]);
          }
          return;
        }
        const d = await r.json();
        const exits: FabricExitDetail[] = Array.isArray(d.rows) ? d.rows : [];
        const latest = exits[0];
        if (!latest) {
          if (isMounted && requestId === fabricExitRequestId.current) {
            setFabricExitInfo(null);
            setFabricExitDetails(null);
            setFabricExits([]);
          }
          return;
        }
        const totalKg = Number(d.totalKg || 0);
        const totalM = Number(d.totalM || 0);
        const unitType = totalM > 0 && totalKg === 0 ? 'm' : totalKg > 0 && totalM === 0 ? 'kg' : 'mixed';
        const quantity = unitType === 'm' ? totalM : unitType === 'kg' ? totalKg : Math.max(totalKg, totalM);

        if (isMounted && requestId === fabricExitRequestId.current) {
          setFabricExitInfo({
            quantity,
            unit: unitType,
            reportNumber: latest.reportNumber || d.latestReportNumber || null,
            quantityKg: totalKg,
            quantityM: totalM,
          });
          setFabricExitDetails(latest);
          setFabricExits(exits);
          setDraftReport(prev => {
            const u = { ...prev };
            if (!prev.fabricExitQuantity && quantity > 0) {
              u.fabricExitQuantity = String(quantity);
              u.fabricExitUnit = unitType === 'mixed' ? 'kg' : unitType;
              autoFilled.add('fabricExitQuantity');
              autoFilled.add('fabricExitUnit');
            }
            const pastelEni = latest.pastelEni || 0;
            if (pastelEni > 0 && !autoFilled.has('fiiliOrtalamaKumasEni')) {
              u.fiiliOrtalamaKumasEni = String(pastelEni);
              autoFilled.add('fiiliOrtalamaKumasEni');
            }
            const lc = latest.layerCount || 0;
            if (!prev.atilanKat && lc > 0) {
              u.atilanKat = String(lc);
              autoFilled.add('atilanKat');
            }
            if (!prev.fiiliToplamAtılanKat && lc > 0) {
              u.fiiliToplamAtılanKat = String(lc);
              autoFilled.add('fiiliToplamAtılanKat');
            }
            return u;
          });
          setAutoFilledFields(autoFilled);
        }
      } catch (e) {
        console.error(e);
        if (isMounted && requestId === fabricExitRequestId.current) {
          setFabricExitInfo(null);
          setFabricExitDetails(null);
          setFabricExits([]);
        }
      } finally {
        if (isMounted && requestId === fabricExitRequestId.current) setFabricExitLoading(false);
      }
    };
    fetchExitInfo();
    return () => {
      isMounted = false;
    };
  }, [selectedOrder]);

  useEffect(() => {
    if (!selectedOrder || !productsLoaded) return;
    const fabricInfo = productFabrics.get(selectedOrder.productCode);
    const asortiInfo = productAsortiMap.get(selectedOrder.productCode);
    setDraftReport(prev => {
      const u = { ...prev };
      const auto = (f: string) => setAutoFilledFields(s => new Set([...s, f]));
      if (fabricInfo?.width && fabricInfo.width > 0 && !prev.fiiliOrtalamaKumasEni) {
        u.fiiliOrtalamaKumasEni = String(fabricInfo.width);
        auto('fiiliOrtalamaKumasEni');
      }
      if (asortiInfo?.fabricStockQuantity && asortiInfo.fabricStockQuantity > 0) {
        const unit = asortiInfo.fabricUnit === 'kg' ? 'kg' : 'm';
        if (!prev.fabricExitQuantity) {
          u.fabricExitQuantity = String(asortiInfo.fabricStockQuantity);
          u.fabricExitUnit = unit;
          auto('fabricExitQuantity');
          auto('fabricExitUnit');
        }
      }
      return u;
    });
    const gramaje = fabricInfo?.productAverageGrammage ?? fabricInfo?.averageGrammage ?? 0;
    const widthCm = asortiInfo?.fabricWidth ?? fabricInfo?.width ?? 0;
    if ((Number(gramaje) > 0 || Number(widthCm) > 0) && (weightCalcInputs.gramaje === 0 || weightCalcInputs.widthCm === 0)) {
      setWeightCalcInputs(prev => ({
        gramaje: Number(gramaje) > 0 ? gramaje : prev.gramaje,
        widthCm: Number(widthCm) > 0 ? widthCm : prev.widthCm,
        lengthM: prev.lengthM,
      }));
    }
  }, [selectedOrder, productsLoaded, productFabrics, productAsortiMap]);

  useEffect(() => {
    if (!selectedOrder) return;
    const atilanKat = Number(draftReport.atilanKat || 0);
    const asortiCount = Number(draftReport.asortiCount || 0);
    const totalCutKg = fabricExitInfo?.quantityKg || Number(draftReport.fabricExitQuantity || 0);
    if (atilanKat > 0 && asortiCount > 0 && totalCutKg > 0) {
      const fabricWidthM = Number(draftReport.fiiliOrtalamaKumasEni || 0) / 100;
      const lengthM = fabricExitDetails?.productLengthMeter || Number(mtkRun.pastelMeter || 0);
      if (fabricWidthM > 0 && lengthM > 0) {
        const singleLayerArea = fabricWidthM * lengthM;
        const cg = (totalCutKg * 1000) / (singleLayerArea * atilanKat);
        const rounded = Math.round(cg * 100) / 100;
        setDraftReport(prev => (prev.fiiliOrtalamaGramaj ? prev : { ...prev, fiiliOrtalamaGramaj: String(rounded) }));
        setAutoFilledFields(prev => (prev.has('fiiliOrtalamaGramaj') ? prev : new Set([...prev, 'fiiliOrtalamaGramaj'])));
      }
    }
  }, [
    selectedOrder,
    draftReport.atilanKat,
    draftReport.asortiCount,
    draftReport.fabricExitQuantity,
    fabricExitInfo,
    fabricExitDetails,
    draftReport.fiiliOrtalamaKumasEni,
    mtkRun.pastelMeter,
  ]);

  useEffect(() => {
    if (!selectedOrder || !productAsortiMap.size) return;
    const saved = parseSewingNotes(selectedOrder.sewingNotes).cuttingReport.asortiCount;
    if (saved) return;
    const def = productAsortiMap.get(selectedOrder.productCode);
    if (!def) return;
    const cur = Number(draftReport.asortiCount || 0);
    if (cur === DEFAULT_ASSORTI_TOTAL && def.defaultAsortiCount !== DEFAULT_ASSORTI_TOTAL) {
      const na = String(def.defaultAsortiCount);
      setDraftReport(prev => ({ ...prev, asortiCount: na, planKat: calculatePlanKat(selectedOrder.quantity, na) }));
    }
  }, [selectedOrder, productAsortiMap, draftReport.asortiCount, selectedOrder?.quantity]);

  useEffect(() => {
    if (!selectedOrder) {
      setSizeCounts({});
      return;
    }
    const sizes = productAsortiMap.get(selectedOrder.productCode)?.sizeChart || DEFAULT_SIZE_DISTRIBUTION;
    setSizeCounts(prev => {
      const n: Record<string, number> = {};
      sizes.forEach(s => (n[s] = prev[s] ?? 1));
      return n;
    });
  }, [selectedOrder?.id, selectedOrder?.productCode, productAsortiMap]);

  useEffect(() => {
    document.documentElement.setAttribute('data-cutting-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    if (!infoMessage) return;
    const t = setTimeout(() => setInfoMessage(null), 4000);
    return () => clearTimeout(t);
  }, [infoMessage]);

  useEffect(() => {
    const h = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  useEffect(() => {
    if (!error) return;
    playBeep('error');
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error]);

  /* ------- Olay yöneticileri ------- */
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (pageRef.current) await pageRef.current.requestFullscreen();
      } else await document.exitFullscreen();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectOrder = (id: number) => {
    setSelectedOrderId(id);
    setInfoMessage(null);
    setActiveStep(1);
    setMobileView('work');
    setSessionStats(prev => ({ ...prev, totalOrdersWorked: new Set([...prev.totalOrdersWorked, id]) }));
    playBeep('ok');
    window.setTimeout(() => barcodeInputRef.current?.focus(), 100);
  };

  const handleStartSpreading = () => {
    if (!selectedOrder || !selectedMachine) {
      setError('Serimi başlatmak için iş emri ve serim makinesi seçin.');
      return;
    }
    const fabricInfo = productFabrics.get(selectedOrder.productCode);
    const asortiInfo = productAsortiMap.get(selectedOrder.productCode);
    const gramaje = fabricInfo?.productAverageGrammage ?? fabricInfo?.averageGrammage ?? 0;
    const widthCm = asortiInfo?.fabricWidth ?? fabricInfo?.width ?? 0;
    setWeightCalcInputs({
      gramaje: Number(gramaje) > 0 ? gramaje : 0,
      widthCm: Number(widthCm) > 0 ? widthCm : 0,
      lengthM: 0,
    });
    setSpreadingStarted(true);
    setSpreadingPanelOpen(true);
    setRollEntries([]);
    setTelemetry([]);
    setMtkRun(prev => ({
      ...prev,
      machine: selectedMachine.name,
      machineId: selectedMachine.id,
      cuttingTableId: selectedMachine.cuttingTable.id,
      status: 'SERİM DEVAM EDİYOR',
      sourceUpdatedAt: new Date().toISOString(),
    }));
    playBeep('ok');
    setInfoMessage(`${selectedMachine.name} / ${selectedMachine.cuttingTable.name} üzerinde serim başlatıldı.`);
  };

  const updateSpreadingLayer = (i: number, f: keyof SpreadingLayerInput, v: string) => {
    setSpreadingLayers(prev =>
      prev.map((l, idx) =>
        idx !== i ? l : { ...l, [f]: ['layerNumber', 'weightKg', 'pieceCount'].includes(f) ? Number(v) || 0 : v }
      )
    );
  };

  const removeSpreadingLayer = (i: number) => {
    setSpreadingLayers(prev =>
      prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i).map((l, idx) => ({ ...l, layerNumber: idx + 1 }))
    );
  };

  const handleReadScaleForSpreading = async () => {
    if (spreadingMode !== 'weight-first') {
      setError('Bu işlem sadece Tartı → Serim modunda çalışır.');
      return;
    }
    if (!selectedOrder) {
      setError('Önce bir iş emri seçin.');
      return;
    }
    let reading: ScaleReading | null = null;
    if (scalePort) reading = await readScaleWeight(scalePort);
    else {
      const unused = scaleReadings.find(e => !e.usedFor && e.reading.weight > 0);
      if (unused) reading = unused.reading;
      else if (scaleReading) reading = scaleReading;
      else {
        const mock = [28.5, 30.0, 32.4, 27.8, 35.2, 29.7];
        const w = mock[Math.floor(Math.random() * mock.length)];
        reading = { weight: w, unit: 'kg', stable: true, raw: `${w.toFixed(2)} kg` };
      }
    }
    if (!reading || reading.weight <= 0) {
      setError('Tartıdan geçerli ağırlık okunamadı');
      return;
    }
    setScaleReading(reading);
    setScaleReadings(prev => [
      { reading: reading!, time: new Date().toLocaleTimeString('tr-TR'), usedFor: 'Serime verildi' },
      ...prev,
    ]);
    const fabricInfo = productFabrics.get(selectedOrder.productCode);
    const asortiInfo = productAsortiMap.get(selectedOrder.productCode);
    const gramaje =
      Number(weightCalcInputs.gramaje) > 0
        ? weightCalcInputs.gramaje
        : fabricInfo?.productAverageGrammage ?? fabricInfo?.averageGrammage ?? 0;
    const widthCm =
      Number(weightCalcInputs.widthCm) > 0 ? weightCalcInputs.widthCm : asortiInfo?.fabricWidth ?? fabricInfo?.width ?? 0;
    const lengthM =
      Number(weightCalcInputs.lengthM) > 0
        ? weightCalcInputs.lengthM
        : fabricExitDetails?.productLengthMeter ?? mtkRun.pastelMeter ?? 0;
    const layers = calculateLayersFromWeight(reading.weight, gramaje, widthCm, lengthM);
    const color = selectedColorVariant || selectedOrder.productColor || 'Renk bekleniyor';
    const nextRollNumber = rollEntries.filter(r => (r.color || '') === color).length + 1;
    setRollEntries(prev => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        color,
        rollNumber: nextRollNumber,
        weightKg: reading!.weight,
        calculatedLayers: layers,
        pieceCount: 0,
        createdAt: new Date().toISOString(),
      },
    ]);
    playBeep('ok');
    setInfoMessage(`Tartıdan alındı: ${reading.weight.toFixed(3)} kg · ${layers} kat`);
    const layerWeight = layers > 0 ? reading.weight / layers : 0;
    const existing = spreadingLayers.find(l => (l.color || '') === color);
    if (!existing) setSpreadingLayers([{ color, layerNumber: 1, weightKg: layerWeight, pieceCount: 0 }]);
    else
      setSpreadingLayers(prev =>
        prev.map(l => ((l.color || '') === color ? { ...l, weightKg: layerWeight, layerNumber: layers } : l))
      );
  };

  const handleAddRollManual = (weightKg: number) => {
    if (!selectedOrder) return;
    const fabricInfo = productFabrics.get(selectedOrder.productCode);
    const asortiInfo = productAsortiMap.get(selectedOrder.productCode);
    const gramaje =
      Number(weightCalcInputs.gramaje) > 0
        ? weightCalcInputs.gramaje
        : fabricInfo?.productAverageGrammage ?? fabricInfo?.averageGrammage ?? 0;
    const widthCm =
      Number(weightCalcInputs.widthCm) > 0 ? weightCalcInputs.widthCm : asortiInfo?.fabricWidth ?? fabricInfo?.width ?? 0;
    const lengthM =
      Number(weightCalcInputs.lengthM) > 0
        ? weightCalcInputs.lengthM
        : fabricExitDetails?.productLengthMeter ?? mtkRun.pastelMeter ?? 0;
    const layers = calculateLayersFromWeight(weightKg, gramaje, widthCm, lengthM);
    const color = selectedColorVariant || selectedOrder.productColor || 'Renk bekleniyor';
    const nextRollNumber = rollEntries.filter(r => (r.color || '') === color).length + 1;
    setRollEntries(prev => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        color,
        rollNumber: nextRollNumber,
        weightKg,
        calculatedLayers: layers,
        pieceCount: 0,
        createdAt: new Date().toISOString(),
      },
    ]);
    playBeep('ok');
  };

  const handleAddRollByMeter = (lengthM: number) => {
    if (!selectedOrder) return;
    const fabricInfo = productFabrics.get(selectedOrder.productCode);
    const asortiInfo = productAsortiMap.get(selectedOrder.productCode);
    const gramaje =
      Number(weightCalcInputs.gramaje) > 0
        ? weightCalcInputs.gramaje
        : fabricInfo?.productAverageGrammage ?? fabricInfo?.averageGrammage ?? 0;
    const widthCm =
      Number(weightCalcInputs.widthCm) > 0 ? weightCalcInputs.widthCm : asortiInfo?.fabricWidth ?? fabricInfo?.width ?? 0;
    const widthM = widthCm / 100;
    const singleLayerArea = widthM * lengthM;
    const singleLayerWeightKg = (singleLayerArea * gramaje) / 1000;
    const layers = Math.max(1, Math.floor(30 / singleLayerWeightKg));
    const totalWeightKg = singleLayerWeightKg * layers;
    const color = selectedColorVariant || selectedOrder.productColor || 'Renk bekleniyor';
    const nextRollNumber = rollEntries.filter(r => (r.color || '') === color).length + 1;
    setRollEntries(prev => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        color,
        rollNumber: nextRollNumber,
        weightKg: totalWeightKg,
        calculatedLayers: layers,
        pieceCount: lengthM,
        createdAt: new Date().toISOString(),
      },
    ]);
    playBeep('ok');
    setInfoMessage(`Top eklendi: ${lengthM.toFixed(1)} m · ${layers} kat · ${totalWeightKg.toFixed(2)} kg`);
  };

  // 2) Top barkod ile ekleme
  const handleRollBarcodeSubmit = () => {
    const raw = rollBarcodeInput.trim();
    if (!raw) return;
    const weight = parseRollBarcode(raw);
    if (weight == null || weight <= 0) {
      playBeep('error');
      setError('Barkod okunamadı. Örn: 30.5 veya KOD|30.5');
      return;
    }
    handleAddRollManual(weight);
    setRollBarcodeInput('');
    setInfoMessage(`Barkoddan top eklendi: ${weight.toFixed(2)} kg`);
    rollBarcodeInputRef.current?.focus();
  };

  const handleRemoveRollEntry = (id: string) => setRollEntries(prev => prev.filter(e => e.id !== id));
  const handleClearRollEntries = () => setRollEntries([]);
  const handleWeightCalcInputChange = (f: keyof WeightCalcInputs, v: string) =>
    setWeightCalcInputs(prev => ({ ...prev, [f]: Number(v) || 0 }));
  const handleSizeCountChange = (size: string, v: string) =>
    setSizeCounts(prev => ({ ...prev, [size]: Math.max(0, Number(v) || 0) }));
  const appendQuickNote = (note: string) =>
    setDraftReport(prev => ({ ...prev, aciklama: prev.aciklama ? `${prev.aciklama.trim()} · ${note}` : note }));

  const handleConnectScale = async () => {
    setScaleConnecting(true);
    try {
      const p = await connectScale(9600, m => setError(m));
      setScalePort(p);
      if (p) {
        playBeep('ok');
        setInfoMessage('Tartı bağlandı');
        setScaleReading(null);
      }
    } finally {
      setScaleConnecting(false);
    }
  };

  const handleReadScale = async () => {
    let reading: ScaleReading | null = null;
    if (scalePort) reading = await readScaleWeight(scalePort);
    else {
      const mock = [28.5, 30.0, 32.4, 27.8, 35.2, 29.7, 42.1, 38.6];
      const w = mock[Math.floor(Math.random() * mock.length)];
      reading = { weight: w, unit: 'kg', stable: true, raw: `${w.toFixed(2)} kg` };
    }
    if (reading && reading.weight > 0) {
      setScaleReading(reading);
      setScaleReadings(prev => [
        { reading, time: new Date().toLocaleTimeString('tr-TR'), usedFor: 'Çıkış için' },
        ...prev,
      ]);
      setFabricExitQuantityDraft(String(reading.weight.toFixed(3)));
      setFabricExitUnit('kg');
      playBeep('ok');
      setInfoMessage(`Tartıdan alındı: ${reading.weight.toFixed(3)} kg`);
    } else setError('Tartıdan geçerli ağırlık okunamadı');
  };

  const handleDisconnectScale = async () => {
    if (scalePort) {
      try {
        await scalePort.close();
      } catch {}
    }
    setScalePort(null);
    setScaleReading(null);
    setInfoMessage('Tartı bağlantısı kesildi');
  };

  const handleInputChange = (field: keyof CuttingReportData, value: string) => {
    setDraftReport(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'atilanKat') {
        const a = Number.parseFloat(prev.asortiCount || '0');
        const l = Number.parseFloat(value || '0');
        if (Number.isFinite(a) && a > 0 && Number.isFinite(l) && l > 0) next.planKat = String(Math.round(l * a));
      }
      return next;
    });
  };

  const handleAsortiChange = (value: string) => {
    const l = Number.parseFloat(draftReport.atilanKat || '0');
    const a = Number.parseFloat(value || '0');
    const calculated =
      Number.isFinite(l) && l > 0 && Number.isFinite(a) && a > 0
        ? String(Math.round(l * a))
        : selectedOrder
        ? calculatePlanKat(selectedOrder.quantity, value)
        : '';
    setDraftReport(prev => ({ ...prev, asortiCount: value, planKat: calculated }));
  };

  const handleCreateFabricExit = async () => {
    if (!selectedOrder) {
      setError('Önce kesim iş emri seçin.');
      return;
    }
    const quantity = Number(fabricExitQuantityDraft);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('Kumaş çıkış miktarı sıfırdan büyük olmalıdır.');
      return;
    }
    if (!cuttingTables.length) {
      setError('Kesim masası listesi henüz yüklenemedi.');
      return;
    }
    setFabricExitCreating(true);
    setError(null);
    try {
      const token = getAuthToken();
      const tableId = cuttingTables[0]?.id || 1;
      const body = JSON.stringify({
        modelNo: selectedOrder.productCode || selectedOrder.productName || selectedOrder.orderNo,
        modelName: selectedOrder.productName || selectedOrder.productCode || selectedOrder.orderNo,
        orderNo: selectedOrder.orderNo,
        customerId: String(selectedOrder.customerName || 'GENEL'),
        layerCount: Number(draftReport.atilanKat || 1),
        grammage: Number(draftReport.fiiliOrtalamaGramaj || 0),
        externalProductId: '',
        productionKg: fabricExitUnit === 'kg' ? quantity : 0,
        productionMeters: fabricExitUnit === 'm' ? quantity : 0,
        unitType: fabricExitUnit,
        cuttingTable: String(tableId),
        color: selectedColorVariant || selectedOrder.productColor || '',
        fabricType: productFabrics.get(selectedOrder.productCode)?.name || '',
        reportNumber: readParameterSettings().reportNumberFormat || 'XXX',
        plannedLayers: draftReport.planKat || '',
        actualLayers: draftReport.atilanKat || '',
        photos: photos.map(p => ({ id: p.id, label: p.label })),
        createdAt: new Date().toISOString(),
      });
      const r = await performFetch('/api/fabric-exits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body,
        label: `Kumaş çıkışı: ${selectedOrder.orderNo}`,
      });
      if (r) {
        if (!r.ok) {
          const b = await r.json().catch(() => null);
          throw new Error(b?.error || 'Kumaş çıkışı kaydedilemedi.');
        }
        const created = await r.json().catch(() => null);
        if (created?.id) setFabricExitDetails(created);
      }
      setDraftReport(prev => ({
        ...prev,
        fabricExitQuantity: String(Number(prev.fabricExitQuantity || 0) + quantity),
        fabricExitUnit,
      }));
      setFabricExitQuantityDraft('');
      playBeep('ok');
      setInfoMessage(`Kumaş çıkışı eklendi: ${quantity} ${fabricExitUnit}.`);
      setSessionStats(prev => ({
        ...prev,
        totalKgCut: prev.totalKgCut + (fabricExitUnit === 'kg' ? quantity : 0),
      }));
      if (r) await refreshFabricExitsForOrder(selectedOrder.orderNo);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Kumaş çıkışı kaydedilemedi.');
    } finally {
      setFabricExitCreating(false);
    }
  };

  const handleCreateDefectiveFabric = async () => {
    if (!selectedOrder) {
      setError('Önce kesim iş emri seçin.');
      return;
    }
    const quantity = Number(defectiveQuantityDraft);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('Hatalı kumaş miktarı sıfırdan büyük olmalıdır.');
      return;
    }
    const fabricName = productFabrics.get(selectedOrder.productCode)?.name;
    if (!fabricName) {
      setError('İlgili kumaş bilgisi bulunamadı.');
      return;
    }
    setDefectiveSubmitting(true);
    setError(null);
    try {
      const token = getAuthToken();
      const colorForReason = defectiveColorVariant || selectedColorVariant;
      const reasonWithColor = colorForReason
        ? `${defectiveReasonDraft || 'Kesim hatası'} - Renk: ${colorForReason}`
        : defectiveReasonDraft || 'Kesim hatası';
      const body = JSON.stringify({
        fabricName,
        quantityKg: quantity,
        reason: reasonWithColor,
        createdBy: token ? 'operator' : null,
        photos: photos.map(p => ({ id: p.id, label: p.label, dataUrl: p.dataUrl })),
      });
      const r = await performFetch('/api/fabrics/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body,
        label: `Hatalı kumaş: ${selectedOrder.orderNo}`,
      });
      if (r && !r.ok) {
        const b = await r.json().catch(() => null);
        throw new Error(b?.error || b?.message || 'Hatalı kumaş kaydedilemedi.');
      }
      setDefectiveQuantityDraft('');
      setDefectiveReasonDraft('');
      setPhotos([]);
      setSessionStats(prev => ({ ...prev, totalDefectiveKg: prev.totalDefectiveKg + quantity }));
      playBeep('ok');
      setInfoMessage(`Hatalı kumaş kaydedildi: ${quantity} kg.`);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Hatalı kumaş kaydedilemedi.');
    } finally {
      setDefectiveSubmitting(false);
    }
  };

  const handleToggleChecklistItem = (i: number) => {
    const u = [...checklist];
    const it = u[i];
    if (it.checkedBy) u[i] = { ...it, checkedBy: undefined, checkedAt: undefined };
    else u[i] = { ...it, checkedBy: 'admin', checkedAt: new Date().toLocaleString('tr-TR') };
    setChecklist(u);
  };

  const handleSave = async () => {
    if (!selectedOrder) return;
    setSavingOrderId(selectedOrder.id);
    setError(null);
    try {
      const token = getAuthToken();
      const body = JSON.stringify({
        sewingNotes: mergeSewingNotes(selectedOrder.sewingNotes, draftReport, checklist, {
          machine: mtkRun.machine,
          cuttingTable: selectedMachine?.cuttingTable.name || 'Tanımsız',
          layers: spreadingLayers.filter(l => l.color.trim()),
          mode: spreadingMode,
          rolls: rollEntries,
          photos,
          signature: signatureDataUrl,
        }),
      });
      const r = await performFetch(`/api/fason/work-orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body,
        label: `Rapor kaydet: ${selectedOrder.orderNo}`,
      });
      if (r) {
        if (!r.ok) {
          const b = await r.json().catch(() => null);
          throw new Error(b?.error || 'Güncelleme başarısız oldu.');
        }
        const updated = await r.json();
        setOrders(prev =>
          prev.map(o =>
            o.id === selectedOrder.id ? { ...o, sewingNotes: updated.sewingNotes || selectedOrder.sewingNotes } : o
          )
        );
      }
      playBeep('ok');
      setInfoMessage('Kesim raporu kaydedildi.');
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Kesim raporu kaydedilemedi.');
    } finally {
      setSavingOrderId(null);
    }
  };

  const handleSpreadingComplete = async () => {
    if (!selectedOrder || isOperatorLocked || !spreadingStarted) {
      setError('Serim verisini almak için önce iş emrini ve serim makinesini başlatın.');
      setShowSpreadingConfirm(false);
      return;
    }
    setShowSpreadingConfirm(false);
    const layerCount = mtkRun.currentLayer ?? 0;
    const spreadingReport: CuttingReportData = {
      ...draftReport,
      planKat: String(mtkRun.layerSet ?? layerCount),
      atilanKat: String(layerCount),
      fiiliOrtalamaKumasEni: mtkRun.widthCm === null ? draftReport.fiiliOrtalamaKumasEni : String(mtkRun.widthCm),
      fabricExitQuantity: mtkRun.pastelMeter === null ? draftReport.fabricExitQuantity : String(mtkRun.pastelMeter),
      fabricExitUnit: 'm',
      aciklama: `${draftReport.aciklama ? `${draftReport.aciklama} ` : ''}Serim tamamlandı: ${mtkRun.machine}.`,
    };
    setSavingOrderId(selectedOrder.id);
    setError(null);
    try {
      const token = getAuthToken();
      const body = JSON.stringify({
        sewingNotes: mergeSewingNotes(selectedOrder.sewingNotes, spreadingReport, checklist, {
          machine: mtkRun.machine,
          cuttingTable: selectedMachine?.cuttingTable.name || 'Tanımsız',
          layers: spreadingLayers.filter(l => l.color.trim()),
          mode: spreadingMode,
          rolls: rollEntries,
          photos,
          signature: signatureDataUrl,
        }),
      });
      const r = await performFetch(`/api/fason/work-orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body,
        label: `Serim tamamlandı: ${selectedOrder.orderNo}`,
      });
      if (r && !r.ok) {
        const b = await r.json().catch(() => null);
        throw new Error(b?.error || 'Serim verisi iş emrine alınamadı.');
      }
      setDraftReport(spreadingReport);
      setMtkRun(prev => ({
        ...prev,
        currentLayer: prev.layerSet ?? prev.currentLayer,
        status: 'SERİM TAMAMLANDI',
        sourceUpdatedAt: new Date().toISOString(),
      }));
      setSpreadingRunsByOrder(prev => ({
        ...prev,
        [selectedOrder.id]: {
          ...mtkRun,
          currentLayer: mtkRun.layerSet ?? mtkRun.currentLayer,
          status: 'SERİM TAMAMLANDI',
          sourceUpdatedAt: new Date().toISOString(),
        },
      }));
      playBeep('ok');
      setInfoMessage(`Serim verileri ${selectedOrder.orderNo} iş emrine alındı.`);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Serim verisi kaydedilemedi.');
    } finally {
      setSavingOrderId(null);
    }
  };

  const requestSpreadingComplete = () => {
    if (!selectedOrder || isOperatorLocked || !spreadingStarted) {
      setError('Serim verisini almak için önce iş emrini ve serim makinesini başlatın.');
      return;
    }
    setShowSpreadingConfirm(true);
  };

  const handleBarcodeLookup = () => {
    const term = barcodeInput.trim();
    if (!term) {
      setError('Barkod veya iş emri numarası girin.');
      return;
    }
    const m = orders.find(o => {
      const on = o.orderNo?.trim().toLowerCase() || '';
      const pc = o.productCode?.trim().toLowerCase() || '';
      const t = term.toLowerCase();
      return on.includes(t) || pc.includes(t) || o.productName.toLowerCase().includes(t);
    });
    if (!m) {
      playBeep('error');
      setError('Eşleşen kesim iş emri bulunamadı.');
      return;
    }
    playBeep('ok');
    setError(null);
    setBarcodeInput('');
    setSelectedOrderId(m.id);
    setInfoMessage(`${m.orderNo} iş emri seçildi.`);
  };

  const handleRequestComplete = () => {
    if (!selectedOrder || isOperatorLocked) {
      setError('Kesim tamamlamak için önce iş emri seçin.');
      return;
    }
    setShowCompleteConfirm(true);
  };

  const handleCompleteCutting = async () => {
    if (!selectedOrder || isOperatorLocked) return;
    setShowCompleteConfirm(false);
    setSavingOrderId(selectedOrder.id);
    setError(null);
    try {
      const token = getAuthToken();
      const kgCut = Number(draftReport.fabricExitQuantity || 0);
      const waste = targetGrammage > 0 && actualGrammage > 0 ? Math.max(0, targetGrammage - actualGrammage) : 0;
      const body = JSON.stringify({
        status: 'TESLIM_EDILDI',
        sewingNotes: mergeSewingNotes(selectedOrder.sewingNotes, draftReport, checklist, {
          machine: mtkRun.machine,
          cuttingTable: selectedMachine?.cuttingTable.name || 'Tanımsız',
          layers: spreadingLayers.filter(l => l.color.trim()),
          mode: spreadingMode,
          rolls: rollEntries,
          photos,
          signature: signatureDataUrl,
        }),
      });
      const r = await performFetch(`/api/fason/work-orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body,
        label: `Kesim tamamla: ${selectedOrder.orderNo}`,
      });
      if (r && !r.ok) {
        const b = await r.json().catch(() => null);
        throw new Error(b?.error || 'Kesim tamamlama işlemi başarısız oldu.');
      }
      setOrders(prev => prev.filter(o => o.id !== selectedOrder.id));
      setSelectedOrderId(null);
      setSessionStats(prev => ({
        ...prev,
        completedOrders: prev.completedOrders + 1,
        totalKgCut: prev.totalKgCut + kgCut,
        totalWasteKg: prev.totalWasteKg + waste,
      }));
      setPhotos([]);
      setSignatureDataUrl(null);
      playBeep('ok');
      setInfoMessage(`${selectedOrder.orderNo} kesim tamamlandı.`);
      setMobileView('orders');
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Kesim tamamlama işlemi başarısız oldu.');
    } finally {
      setSavingOrderId(null);
    }
  };

  const handlePrintReport = () => {
    if (!selectedOrder) {
      setError('Yazdırmak için önce iş emri seçin.');
      return;
    }
    const sizeLines = Object.entries(sizeCounts)
      .map(([size, count]) => `${size}: ${count}`)
      .join(' · ');
    const { rows: layRows, totalKg: layTotalKg } = buildLayBreakdown(fabricExits, selectedOrder.productColor);
    let layBreakdownHtml: string;
    if (layRows.length === 0) {
      layBreakdownHtml = '<div style="color:#64748b;font-size:13px">Kayıtlı atılan kat / kumaş çıkışı yok.</div>';
    } else {
      const colorOrder: string[] = [];
      const seen = new Set<string>();
      layRows.forEach(r => {
        if (!seen.has(r.color)) {
          seen.add(r.color);
          colorOrder.push(r.color);
        }
      });
      layBreakdownHtml =
        colorOrder
          .map(color => {
            const colorRows = layRows.filter(r => r.color === color);
            const colorTotalKg = colorRows.reduce((s, r) => s + r.kg, 0);
            const lines = colorRows
              .map(
                r =>
                  `<div style="margin-left:16px;font-family:monospace;font-size:13px">${r.kat} kat ${formatLayNumber(r.value)} ${r.unit}</div>`
              )
              .join('');
            return (
              `<div style="margin-top:8px">` +
              `<div style="font-weight:700;font-size:13px">${color}</div>` +
              lines +
              `<div style="margin-left:16px;font-size:12px;color:#64748b">${formatLayNumber(colorTotalKg)} kg (toplam renk)</div>` +
              `</div>`
            );
          })
          .join('') +
        `<div style="margin-top:10px;font-weight:700;font-size:13px">toplam atılan ${formatLayNumber(layTotalKg)} kg</div>`;
    }
    let rollBreakdownHtml: string;
    if (rollEntries.length === 0) {
      rollBreakdownHtml = '<div style="color:#64748b;font-size:13px">Kayıtlı top / kat bilgisi yok.</div>';
    } else {
      const colorOrder: string[] = [];
      const seen = new Set<string>();
      rollEntries.forEach(r => {
        const color = r.color || 'Renk bekleniyor';
        if (!seen.has(color)) {
          seen.add(color);
          colorOrder.push(color);
        }
      });
      rollBreakdownHtml =
        colorOrder
          .map(color => {
            const colorRolls = rollEntries.filter(r => (r.color || 'Renk bekleniyor') === color);
            const colorTotalKg = colorRolls.reduce((s, r) => s + (Number(r.weightKg) || 0), 0);
            const colorTotalLayers = colorRolls.reduce((s, r) => s + (Number(r.calculatedLayers) || 0), 0);
            const colorTotalMeters = colorRolls.reduce((s, r) => s + (Number(r.pieceCount) || 0), 0);
            const lines = colorRolls
              .map(
                r =>
                  `<div style="margin-left:16px;font-family:monospace;font-size:13px">${r.rollNumber}. top ${formatLayNumber(r.weightKg)} kg · ${r.calculatedLayers} kat${
                    spreadingMode === 'spread-then-weight' ? ` · ${r.pieceCount.toFixed(1)} m` : ''
                  }</div>`
              )
              .join('');
            return (
              `<div style="margin-top:8px">` +
              `<div style="font-weight:700;font-size:13px">${color}</div>` +
              lines +
              `<div style="margin-left:16px;font-size:12px;color:#64748b">${formatLayNumber(colorTotalKg)} kg · ${colorTotalLayers} kat${
                spreadingMode === 'spread-then-weight' ? ` · ${colorTotalMeters.toFixed(1)} m` : ''
              } (toplam renk)</div>` +
              `</div>`
            );
          })
          .join('') +
        `<div style="margin-top:10px;font-weight:700;font-size:13px">toplam ${totalRolls} top · ${formatLayNumber(totalRollWeightKg)} kg · ${totalRollLayers} kat${
          spreadingMode === 'spread-then-weight' ? ` · ${totalRollMeters.toFixed(1)} m` : ''
        }</div>`;
    }
    const signatureHtml = signatureDataUrl
      ? `<div class="section">İmza</div><img src="${signatureDataUrl}" style="max-width:320px;border:1px solid #e2e8f0;border-radius:6px;"/>`
      : '';
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) {
      setError('Yazdırma penceresi açılamadı. Popup engelini kontrol edin.');
      return;
    }
    win.document.write(`<!DOCTYPE html><html><head><title>Kesim Raporu - ${selectedOrder.orderNo}</title>
      <style>
        body{font-family:Inter,Arial,sans-serif;padding:32px;color:#111}
        h1{font-size:20px;margin:0 0 4px}
        .meta{color:#64748b;font-size:12px;margin-bottom:24px}
        table{width:100%;border-collapse:collapse;margin:16px 0}
        th,td{border:1px solid #e2e8f0;padding:8px 12px;text-align:left;font-size:13px}
        th{background:#f8fafc}
        .section{margin-top:20px;font-size:11px;font-weight:800;letter-spacing:.08em;color:#64748b;text-transform:uppercase}
      </style></head><body>
      <h1>Kesim Raporu — ${selectedOrder.orderNo}</h1>
      <div class="meta">${selectedOrder.customerName} · ${selectedOrder.productName} · ${selectedOrder.productCode || ''}</div>
      <div class="section">Özet</div>
      <table>
      <tr><th>Toplam adet</th><td>${selectedOrder.quantity}</td></tr>
      <tr><th>Asorti</th><td>${draftReport.asortiCount || '—'} / ${currentSizeDistribution.join(' ') || '—'}</td></tr>
      <tr><th>Plan kat</th><td>${draftReport.planKat || '—'}</td></tr>
        <tr><th>Atılan kat</th><td>${draftReport.atilanKat || '—'}</td></tr>
        <tr><th>Kumaş eni</th><td>${draftReport.fiiliOrtalamaKumasEni || '—'} cm</td></tr>
        <tr><th>Kesilen</th><td>${draftReport.fabricExitQuantity || '—'} ${draftReport.fabricExitUnit || ''}</td></tr>
        <tr><th>Gramaj</th><td>${draftReport.fiiliOrtalamaGramaj || '—'} g/m²</td></tr>
        <tr><th>Beden dağılımı</th><td>${sizeLines || '—'}</td></tr>
        <tr><th>Not</th><td>${draftReport.aciklama || '—'}</td></tr>
      </table>
         <div class="section">Atılan kat - Renk bazlı</div>
       <div>${layBreakdownHtml}</div>
        ${
          rollEntries.length > 0
            ? `
        <div class="section">Top / Kat - Renk bazlı (${
          spreadingMode === 'weight-first' ? 'Tartı → Serim' : 'Serim → Tartı'
        })</div>
        <div>${rollBreakdownHtml}</div>
        `
            : ''
        }
        ${signatureHtml}
       <p style="margin-top:32px;font-size:11px;color:#94a3b8">Oluşturulma: ${new Date().toLocaleString('tr-TR')}</p>
      <script>window.onload=()=>{window.print();}</script>
      </body></html>`);
    win.document.close();
  };

  /* ------- Türetilmiş ------- */
  const currentAsorti = selectedOrder
    ? Number(
        draftReport.asortiCount || productAsortiMap.get(selectedOrder.productCode)?.defaultAsortiCount || DEFAULT_ASSORTI_TOTAL
      )
    : 0;
  const currentPlanKat =
    selectedOrder && draftReport.asortiCount
      ? calculatePlanKat(selectedOrder.quantity, draftReport.asortiCount)
      : draftReport.planKat || '—';
  const currentCutFabric = Number(draftReport.fabricExitQuantity || fabricExitInfo?.quantity || 0);
  const fiberExitUnitLabel =
    fabricExitInfo?.unit === 'mixed' ? 'kg/m' : fabricExitInfo?.unit || draftReport.fabricExitUnit || 'kg';
  const calculatedOutputPieces = useMemo(() => {
    const layers = Number(draftReport.atilanKat || 0);
    const q = Number(draftReport.fabricExitQuantity || fabricExitInfo?.quantity || 0);
    return layers > 0 && q > 0 ? Math.round(layers * q) : null;
  }, [draftReport.atilanKat, draftReport.fabricExitQuantity, fabricExitInfo?.quantity]);
  const progressPercent = selectedOrder ? Math.min((currentCutFabric / Math.max(selectedOrder.quantity, 1)) * 100, 100) : 0;
  const progressComplete = progressPercent >= 99.5;
  const currentTimeLabel = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const currentSizeDistribution =
    productAsortiMap.get(selectedOrder?.productCode || '')?.sizeChart || DEFAULT_SIZE_DISTRIBUTION;
  const productFabricInfo = productFabrics.get(selectedOrder?.productCode || '');
  const actualGrammage = Number(draftReport.fiiliOrtalamaGramaj || 0);
  const targetGrammage = Number(productFabricInfo?.productAverageGrammage || 0);
  const grammageTargetStatus =
    targetGrammage > 0 && actualGrammage > 0
      ? Math.abs(actualGrammage - targetGrammage) <= targetGrammage * 0.05
        ? 'Hedef tuttu'
        : 'Hedef dışı'
      : 'Hesaplanıyor';
  const grammageOnTarget = grammageTargetStatus === 'Hedef tuttu';
  const cuttingWastePercent =
    targetGrammage > 0 && actualGrammage > 0 ? Math.max(0, ((targetGrammage - actualGrammage) / targetGrammage) * 100) : 0;
  const operatorDisplayName = selectedOrder?.customerName?.trim() || 'Sistem';
  const operatorDisplayInitials =
    operatorDisplayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0]?.toUpperCase() || '')
      .join('') || 'S';
  const effectiveColorVariants = useMemo(() => {
    if (selectedOrder?.colorVariants && selectedOrder.colorVariants.length > 0) return selectedOrder.colorVariants;
    if (selectedOrder?.productColor) return [selectedOrder.productColor];
    return [];
  }, [selectedOrder?.colorVariants, selectedOrder?.productColor]);
  const isAutoFilled = (f: string) => autoFilledFields.has(f);

  const openNumpad = (
    key: keyof CuttingReportData | 'fabricExit' | 'defective',
    title: string,
    unit?: string,
    decimal = true
  ) => setNumpad({ open: true, key, title, unit, decimal });

  const handleNumpadConfirm = (v: string) => {
    if (numpad.key === 'fabricExit') setFabricExitQuantityDraft(v);
    else if (numpad.key === 'defective') setDefectiveQuantityDraft(v);
    else if (numpad.key) handleInputChange(numpad.key as keyof CuttingReportData, v);
  };

  const telemetryForward = telemetry.map(p => p.forward);
  const telemetryReverse = telemetry.map(p => p.reverse);
  const telemetryTension = telemetry.map(p => p.tension);

  /* ------- Yükleniyor ------- */
  if (loading) {
    return (
      <AuthGuard requireAuth={true} requiredAccess="fason">
        <div style={S.loadingContainer}>
          <div style={S.loadingSpinner} />
          <p style={S.loadingText}>Kesim ekranı yükleniyor...</p>
        </div>
      </AuthGuard>
    );
  }

  /* ================================================================ */
  /* RENDER                                                            */
  /* ================================================================ */
  return (
    <AuthGuard requireAuth={true} requiredAccess="fason">
      <div ref={pageRef} style={S.appShell} data-cutting-workshop>
        {/* ÜST BAR */}
        <header style={S.topBar}>
          <div style={S.brandBlock}>
            <div style={S.brandMark} aria-hidden>
              K
            </div>
            <div>
              <div style={S.brandTitle}>Kesim Konsolu</div>
              <div style={S.brandSubtitle}>
                {selectedOrder ? `${selectedOrder.orderNo} · ${selectedOrder.customerName}` : 'İş emri bekleniyor'}
              </div>
            </div>
          </div>

          <div style={S.topStatus}>
            <StatusPill tone={isOnline ? 'green' : 'red'} icon={isOnline ? '●' : '✕'}>
              {isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
            </StatusPill>
            <StatusPill tone={scalePort ? 'green' : 'gray'} icon={scalePort ? '●' : '○'}>
              {scalePort ? 'Tartı bağlı' : 'Tartı yok'}
            </StatusPill>
            <StatusPill tone="blue">{currentTimeLabel}</StatusPill>
            {selectedOrder && (
              <StatusPill tone={progressComplete ? 'green' : 'blue'}>%{progressPercent.toFixed(0)} tamam</StatusPill>
            )}
          </div>

          <div style={S.topActions}>
            <button onClick={() => setIsDarkMode(v => !v)} style={S.topIconButton} aria-label="Tema">
              {isDarkMode ? '☀' : '☾'}
            </button>
            <button onClick={toggleFullscreen} style={S.topIconButton} aria-label="Tam ekran">
              {isFullscreen ? '⤡' : '⤢'}
            </button>
            <button
              onClick={() => setKpiOpen(true)}
              style={S.operatorChip}
              aria-label="Vardiya özeti"
              type="button"
            >
              <div style={S.operatorAvatar}>{operatorDisplayInitials}</div>
              <strong style={S.operatorName}>{operatorDisplayName}</strong>
            </button>
            <button
              onClick={() => setIsOperatorLocked(v => !v)}
              style={{ ...S.lockButton, background: isOperatorLocked ? '#334155' : '#0f766e' }}
            >
              {isOperatorLocked ? 'Aç' : 'Kilitle'}
            </button>
          </div>
        </header>

        {/* OFFLINE BANNER */}
        <OfflineBanner
          isOnline={isOnline}
          queuedCount={queuedCount}
          onFlush={flushOfflineQueue}
          syncing={syncing}
        />

        {/* MOBİL SEKMELER */}
        <nav style={S.mobileTabs}>
          <button
            onClick={() => setMobileView('orders')}
            style={{ ...S.mobileTab, ...(mobileView === 'orders' ? S.mobileTabActive : {}) }}
          >
            İş Emirleri <span style={S.mobileTabBadge}>{orders.length}</span>
          </button>
          <button
            onClick={() => setMobileView('work')}
            style={{ ...S.mobileTab, ...(mobileView === 'work' ? S.mobileTabActive : {}) }}
          >
            Aktif İş
          </button>
          <button
            onClick={() => setMobileView('report')}
            style={{ ...S.mobileTab, ...(mobileView === 'report' ? S.mobileTabActive : {}) }}
          >
            Rapor
          </button>
        </nav>

        {/* ANA GRID */}
        <div style={S.mainGrid} className="cutting-main-grid">
          {/* SOL: İŞ EMİRLERİ */}
          <aside
            style={{ ...S.sidebar, display: mobileView === 'orders' ? 'flex' : undefined }}
            className={mobileView === 'orders' ? '' : 'hide-mobile'}
          >
            <div style={S.sidebarHeader}>
              <span style={S.sidebarKicker}>PLANLAMA</span>
              <h2 style={S.sidebarTitle}>
                İş emirleri <span style={S.countBadge}>{orders.length}</span>
              </h2>
              <div style={S.searchBox}>
                <input
                  ref={barcodeInputRef}
                  value={barcodeInput}
                  onChange={e => setBarcodeInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleBarcodeLookup();
                  }}
                  placeholder="Barkod / QR / iş emri tara..."
                  style={S.searchInput}
                />
              </div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 6 }}>
                🔍 USB barkod / QR okuyucu desteği — okutun, otomatik arar.
              </div>
            </div>

            <div style={S.orderList}>
              {orders
                .filter(o => {
                  const t = barcodeInput.trim().toLowerCase();
                  if (!t) return true;
                  return [o.orderNo, o.productCode, o.productName, o.customerName].some(v =>
                    (v || '').toLowerCase().includes(t)
                  );
                })
                .map(o => {
                  const pr = getPriorityLevel(o.deliveryDate);
                  const pc = priorityColors[pr];
                  return (
                    <button
                      key={o.id}
                      onClick={() => handleSelectOrder(o.id)}
                      style={{
                        ...S.orderCard,
                        ...(selectedOrderId === o.id ? S.orderCardActive : {}),
                        borderLeft: `4px solid ${pc.border}`,
                        background: pc.bg !== 'transparent' && selectedOrderId !== o.id ? pc.bg : undefined,
                      }}
                    >
                      <div style={S.orderCardTop}>
                        <span
                          style={{
                            ...S.statusDotLg,
                            background:
                              o.status === 'BEKLIYOR' ? '#f59e0b' : o.status === 'TESLIM_EDILDI' ? '#10b981' : '#3b82f6',
                          }}
                        />
                        <strong style={S.orderNo}>{o.orderNo}</strong>
                        <span style={S.orderDate}>{formatDate(o.deliveryDate)}</span>
                      </div>
                      {pr !== 'normal' && (
                        <span
                          style={{
                            alignSelf: 'flex-start',
                            fontSize: 9,
                            fontWeight: 900,
                            letterSpacing: '0.08em',
                            color: pc.text,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: 'rgba(0,0,0,0.25)',
                          }}
                        >
                          {pc.label}
                        </span>
                      )}
                      <div style={S.orderProduct}>{o.productName}</div>
                      <div style={S.orderMeta}>
                        <span>{o.customerName || '-'}</span>
                        <span style={S.orderQty}>{o.quantity} adet</span>
                      </div>
                    </button>
                  );
                })}
              {orders.length === 0 && <div style={S.emptyList}>Aktif kesim emri yok.</div>}
            </div>
          </aside>

          {/* ORTA: AKTİF İŞ */}
          <section
            style={{ ...S.workArea, display: mobileView === 'work' ? 'flex' : undefined }}
            className={mobileView === 'work' ? '' : 'hide-mobile'}
          >
            {selectedOrder ? (
              <>
                <div style={S.workHeader}>
                  <div>
                    <span style={S.workKicker}>AKTİF İŞ EMRİ</span>
                    <h1 style={S.workTitle}>{selectedOrder.orderNo}</h1>
                    <p style={S.workMeta}>
                      {selectedOrder.customerName}
                      <span style={S.metaDot}>·</span>
                      {selectedOrder.productName}
                      {selectedOrder.productCode && (
                        <>
                          <span style={S.metaDot}>·</span>
                          {selectedOrder.productCode}
                        </>
                      )}
                    </p>
                  </div>
                  <div style={S.workHeaderRight}>
                    <span
                      style={{
                        ...S.statusPillLg,
                        background:
                          selectedOrder.status === 'BEKLIYOR'
                            ? 'rgba(245,158,11,0.15)'
                            : selectedOrder.status === 'TESLIM_EDILDI'
                            ? 'rgba(16,185,129,0.15)'
                            : 'rgba(59,130,246,0.15)',
                        color:
                          selectedOrder.status === 'BEKLIYOR'
                            ? '#fcd34d'
                            : selectedOrder.status === 'TESLIM_EDILDI'
                            ? '#6ee7b7'
                            : '#93c5fd',
                      }}
                    >
                      {selectedOrder.status}
                    </span>
                  </div>
                </div>

                <div style={S.heroPanel}>
                  <div style={S.progressBlock}>
                    <div style={{ position: 'relative', display: 'inline-flex' }}>
                      <ProgressRing
                        percent={progressPercent}
                        size={150}
                        stroke={14}
                        color={progressComplete ? '#10b981' : progressPercent >= 60 ? '#3b82f6' : '#f59e0b'}
                      />
                      <div style={S.progressCenter}>
                        <strong style={S.progressPercent}>{progressPercent.toFixed(0)}%</strong>
                        <span style={S.progressLabel}>İlerleme</span>
                      </div>
                    </div>
                    <div style={S.progressSub}>
                      <span>
                        {currentCutFabric} / {selectedOrder.quantity} adet
                      </span>
                    </div>
                  </div>

                  <div style={S.metricStrip}>
                    <MetricTile label="Toplam" value={String(selectedOrder.quantity)} unit="adet" tone="blue" />
                    <MetricTile label="Plan kat" value={String(currentPlanKat || '—')} unit="kat" tone="default" />
                    <MetricTile
                      label="Atılan kat"
                      value={draftReport.atilanKat || '—'}
                      unit="kat"
                      tone="blue"
                      onClick={() => openNumpad('atilanKat', 'Atılan kat', 'kat', false)}
                    />
                    <MetricTile
                      label="Kumaş eni"
                      value={draftReport.fiiliOrtalamaKumasEni || '—'}
                      unit="cm"
                      tone="default"
                      onClick={() => openNumpad('fiiliOrtalamaKumasEni', 'Kumaş eni', 'cm')}
                    />
                    <MetricTile
                      label="Gramaj"
                      value={actualGrammage > 0 ? actualGrammage.toFixed(0) : '—'}
                      unit="g/m²"
                      tone={grammageOnTarget ? 'green' : grammageTargetStatus === 'Hedef dışı' ? 'red' : 'default'}
                    />
                    <MetricTile
                      label="Çıkan"
                      value={calculatedOutputPieces ? String(calculatedOutputPieces) : '—'}
                      unit="adet"
                      tone={calculatedOutputPieces ? 'green' : 'default'}
                    />
                  </div>
                </div>

                <div style={S.stepBar}>
                  {[
                    { id: 1, label: 'Ölçüm', desc: 'Kat / en / gramaj' },
                    { id: 2, label: 'Serim', desc: 'Makine verisi' },
                    { id: 3, label: 'Tamamla', desc: 'İş emrini kapat' },
                  ].map((s, i) => (
                    <button
                      key={s.id}
                      onClick={() => setActiveStep(s.id as 1 | 2 | 3)}
                      style={{ ...S.stepItem, ...(activeStep === s.id ? S.stepItemActive : {}) }}
                    >
                      <span style={{ ...S.stepNum, ...(activeStep === s.id ? S.stepNumActive : {}) }}>{s.id}</span>
                      <div style={S.stepText}>
                        <strong style={S.stepLabel}>{s.label}</strong>
                        <span style={S.stepDesc}>{s.desc}</span>
                      </div>
                      {i < 2 && <span style={S.stepArrow}>›</span>}
                    </button>
                  ))}
                </div>

                <div style={S.stepBody}>
                  {activeStep === 1 && (
                    <div style={S.quickGrid}>
                      <QuickEntry
                        label="Kesilen kumaş"
                        value={draftReport.fabricExitQuantity || String(fabricExitInfo?.quantity || '')}
                        unit={fiberExitUnitLabel}
                        onOpen={() => openNumpad('fabricExitQuantity', 'Kesilen kumaş', fiberExitUnitLabel)}
                      />
                      <QuickEntry
                        label="Atılan kat"
                        value={draftReport.atilanKat}
                        unit="kat"
                        onOpen={() => openNumpad('atilanKat', 'Atılan kat', 'kat', false)}
                      />
                      <QuickEntry
                        label="Asorti"
                        value={draftReport.asortiCount}
                        unit="adet"
                        onOpen={() => {
                          const v = prompt('Asorti sayısı:', draftReport.asortiCount || '4');
                          if (v !== null) handleAsortiChange(v);
                        }}
                      />
                      <QuickEntry
                        label="Kumaş eni"
                        value={draftReport.fiiliOrtalamaKumasEni}
                        unit="cm"
                        onOpen={() => openNumpad('fiiliOrtalamaKumasEni', 'Kumaş eni', 'cm')}
                      />
                    </div>
                  )}
                  {activeStep === 2 && (
                    <div style={S.step2Wrap}>
                      <BigButton
                        tone={spreadingStarted ? 'ghost' : 'primary'}
                        onClick={() => setSpreadingPanelOpen(true)}
                        style={{ width: '100%', marginBottom: 12 }}
                      >
                        {spreadingStarted ? 'Serim panelini aç' : 'Serimi başlat'}
                      </BigButton>
                      <div style={S.step2Info}>
                        <div>
                          <span style={S.step2Key}>Makine</span>
                          <strong>{mtkRun.machine || '—'}</strong>
                        </div>
                        <div>
                          <span style={S.step2Key}>Anlık kat</span>
                          <strong>
                            {mtkRun.currentLayer ?? '—'} / {mtkRun.layerSet ?? '—'}
                          </strong>
                        </div>
                        <div>
                          <span style={S.step2Key}>Pastal</span>
                          <strong>{mtkRun.pastelMeter ?? '—'} m</strong>
                        </div>
                        <div>
                          <span style={S.step2Key}>Top</span>
                          <strong>
                            {totalRolls} · {totalRollWeightKg.toFixed(1)} kg
                          </strong>
                        </div>
                      </div>
                      {/* 1) Telemetri */}
                      {spreadingStarted && telemetry.length >= 2 && (
                        <div style={S.telemetryGrid}>
                          <Sparkline
                            data={telemetryForward}
                            width={220}
                            height={48}
                            color="#3b82f6"
                            min={0}
                            max={120}
                            label="İleri hız"
                            unit="%"
                          />
                          <Sparkline
                            data={telemetryReverse}
                            width={220}
                            height={48}
                            color="#a855f7"
                            min={0}
                            max={120}
                            label="Geri hız"
                            unit="%"
                          />
                          <Sparkline
                            data={telemetryTension}
                            width={220}
                            height={48}
                            color="#f59e0b"
                            min={0}
                            max={120}
                            label="Gerilim"
                            unit="%"
                          />
                        </div>
                      )}
                    </div>
                  )}
                  {activeStep === 3 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <BigButton
                        tone="success"
                        onClick={handleRequestComplete}
                        disabled={savingOrderId === selectedOrder.id}
                      >
                        {savingOrderId === selectedOrder.id ? 'İşleniyor...' : '✓ Kesimi Tamamla ve Kapat'}
                      </BigButton>
                      <BigButton
                        tone="primary"
                        onClick={() => setSignatureOpen(true)}
                      >
                        ✍ {signatureDataUrl ? 'İmzayı düzenle' : 'İmza al'}
                      </BigButton>
                      {signatureDataUrl && (
                        <div style={S.signaturePreviewBox}>
                          <img src={signatureDataUrl} alt="İmza" style={{ maxHeight: 80 }} />
                          <button
                            type="button"
                            onClick={() => setSignatureDataUrl(null)}
                            style={S.signatureRemove}
                          >
                            ×
                          </button>
                        </div>
                      )}
                      <BigButton
                        tone="ghost"
                        onClick={handleSave}
                        disabled={savingOrderId === selectedOrder.id}
                      >
                        Raporu kaydet (kapatmadan)
                      </BigButton>
                      <BigButton tone="ghost" onClick={handlePrintReport}>
                        Raporu yazdır
                      </BigButton>
                    </div>
                  )}
                </div>

                <div style={S.scalePanel}>
                  <div style={S.scalePanelHeader}>
                    <span style={S.scalePanelTitle}>Tartı & Kumaş Çıkışı</span>
                    <div style={S.scaleBtnRow}>
                      <SmallBtn
                        onClick={handleConnectScale}
                        disabled={scaleConnecting || !!scalePort}
                        tone={scalePort ? 'success' : 'primary'}
                      >
                        {scaleConnecting ? 'Bağlanıyor...' : scalePort ? 'Bağlı' : 'Tartı bağla'}
                      </SmallBtn>
                      <SmallBtn onClick={handleReadScale} tone="primary">
                        Tartıdan al
                      </SmallBtn>
                      {scalePort && (
                        <SmallBtn onClick={handleDisconnectScale} tone="danger">
                          Kes
                        </SmallBtn>
                      )}
                    </div>
                  </div>
                  {scaleReading && (
                    <div style={S.scaleReading}>
                      <span style={S.scaleReadingValue}>{scaleReading.weight.toFixed(3)} kg</span>
                      <span style={S.scaleReadingMeta}>{scaleReading.stable ? 'stabil' : 'kararsız'}</span>
                    </div>
                  )}
                  <div style={S.fabricExitRow}>
                    <button
                      type="button"
                      onClick={() => openNumpad('fabricExit', 'Kumaş çıkışı', fabricExitUnit)}
                      style={{ ...S.fabricExitInput, cursor: 'pointer', textAlign: 'left' }}
                    >
                      {fabricExitQuantityDraft || '0.000'}
                    </button>
                    <select
                      value={fabricExitUnit}
                      onChange={e => setFabricExitUnit(e.target.value as 'kg' | 'm')}
                      style={S.fabricExitUnit}
                    >
                      <option value="kg">kg</option>
                      <option value="m">m</option>
                    </select>
                    <SmallBtn onClick={handleCreateFabricExit} disabled={fabricExitCreating} tone="success">
                      {fabricExitCreating ? '...' : '+ Ekle'}
                    </SmallBtn>
                  </div>
                  {scaleReadings.length > 0 && (
                    <div style={S.scaleHistory}>
                      {scaleReadings.slice(0, 3).map((e, i) => (
                        <div key={`${e.time}-${i}`} style={S.scaleHistoryItem}>
                          <span>{e.time}</span>
                          <strong>{e.reading.weight.toFixed(3)} kg</strong>
                          {e.usedFor && <span style={S.scaleHistoryMeta}>{e.usedFor}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <details
                  style={S.details}
                  open={detailsOpen}
                  onToggle={e => setDetailsOpen((e.target as HTMLDetailsElement).open)}
                >
                  <summary style={S.detailsSummary}>
                    Üretim detayları
                    <span style={S.detailsMeta}>
                      {productFabrics.get(selectedOrder.productCode)?.name || 'Kumaş yok'} · {grammageTargetStatus}
                    </span>
                  </summary>
                  <div style={S.detailsGrid}>
                    <DetailItem label="Kumaş" value={productFabrics.get(selectedOrder.productCode)?.name || '—'} />
                    <DetailItem label="Renk" value={selectedOrder.productColor || '—'} />
                    <DetailItem label="Hedef gramaj" value={targetGrammage ? `${targetGrammage} g/m²` : '—'} />
                    <DetailItem label="Fiili gramaj" value={actualGrammage ? `${actualGrammage} g/m²` : '—'} />
                    <DetailItem
                      label="Kesim firesi"
                      value={cuttingWastePercent > 0 ? `%${cuttingWastePercent.toFixed(1)}` : '—'}
                      tone={cuttingWastePercent > 5 ? 'red' : 'green'}
                    />
                    <DetailItem label="Çıkış belge no" value={fabricExitInfo?.reportNumber || '—'} />
                    <DetailItem label="Kesim masası" value={fabricExitDetails?.cuttingTable?.name || '—'} />
                    <DetailItem label="Teslim" value={formatDate(selectedOrder.deliveryDate)} />
                  </div>
                  {effectiveColorVariants.length > 0 && (
                    <div style={S.colorVariants}>
                      <span style={S.colorVariantsLabel}>Renk varyantı:</span>
                      {effectiveColorVariants.map(c => (
                        <span
                          key={c}
                          style={{ ...S.colorChip, ...(selectedColorVariant === c ? S.colorChipActive : {}) }}
                          onClick={() => setSelectedColorVariant(c)}
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </details>
              </>
            ) : (
              <div style={S.emptyWork}>
                <div style={S.emptyIcon}>📋</div>
                <h3 style={S.emptyTitle}>İş emri seçilmedi</h3>
                <p style={S.emptyText}>Soldaki listeden bir iş emri seçin veya barkod okutun.</p>
              </div>
            )}
          </section>

          {/* SAĞ: RAPOR */}
          <aside
            style={{ ...S.reportPanel, display: mobileView === 'report' ? 'flex' : undefined }}
            className={mobileView === 'report' ? '' : 'hide-mobile'}
          >
            {selectedOrder ? (
              <>
                <div style={S.reportHeader}>
                  <span style={S.reportKicker}>KAYIT</span>
                  <h2 style={S.reportTitle}>Kesim Raporu</h2>
                  <div style={S.reportSub}>{selectedOrder.orderNo}</div>
                </div>

                <div style={S.reportBody}>
                  <Group title="Ölçüm">
                    <div style={S.twoCol}>
                      <FieldTouch
                        label="Kesilen"
                        value={draftReport.fabricExitQuantity || String(fabricExitInfo?.quantity || '')}
                        unit={fiberExitUnitLabel}
                        auto={isAutoFilled('fabricExitQuantity')}
                        onOpen={() => openNumpad('fabricExitQuantity', 'Kesilen kumaş', fiberExitUnitLabel)}
                      />
                      <FieldTouch
                        label="Atılan kat"
                        value={draftReport.atilanKat}
                        unit="kat"
                        auto={isAutoFilled('atilanKat')}
                        onOpen={() => openNumpad('atilanKat', 'Atılan kat', 'kat', false)}
                      />
                    </div>
                    <div style={S.twoCol}>
                      <FieldTouch
                        label="Asorti"
                        value={draftReport.asortiCount}
                        onOpen={() => {
                          const v = prompt('Asorti sayısı:', draftReport.asortiCount || '4');
                          if (v !== null) handleAsortiChange(v);
                        }}
                      />
                      <FieldTouch label="Plan kat" value={draftReport.planKat} readOnly />
                    </div>
                    <div style={S.twoCol}>
                      <FieldTouch
                        label="Kumaş eni"
                        value={draftReport.fiiliOrtalamaKumasEni}
                        unit="cm"
                        auto={isAutoFilled('fiiliOrtalamaKumasEni')}
                        onOpen={() => openNumpad('fiiliOrtalamaKumasEni', 'Kumaş eni', 'cm')}
                      />
                      <FieldTouch
                        label="Birim gramaj"
                        value={draftReport.fiiliOrtalamaGramaj}
                        unit="g/m²"
                        auto={isAutoFilled('fiiliOrtalamaGramaj')}
                        readOnly
                      />
                    </div>
                    {calculatedOutputPieces && (
                      <div style={S.outputBadge}>
                        <span>Çıkan adet</span>
                        <strong>{calculatedOutputPieces}</strong>
                      </div>
                    )}
                  </Group>

                  <Group title="Hatalı Kumaş İadesi">
                    {effectiveColorVariants.length > 0 && (
                      <select
                        value={defectiveColorVariant}
                        onChange={e => setDefectiveColorVariant(e.target.value)}
                        style={S.formInput}
                        disabled={defectiveSubmitting}
                      >
                        {effectiveColorVariants.map(c => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    )}
                    <div style={S.twoCol}>
                      <FieldTouch
                        label="Miktar"
                        value={defectiveQuantityDraft}
                        unit="kg"
                        onOpen={() => openNumpad('defective', 'Hatalı kumaş (kg)', 'kg')}
                      />
                      <input
                        value={defectiveReasonDraft}
                        onChange={e => setDefectiveReasonDraft(e.target.value)}
                        placeholder="Neden"
                        style={S.formInput}
                        disabled={defectiveSubmitting}
                      />
                    </div>
                    <PhotoCapture photos={photos} onAdd={p => setPhotos(prev => [...prev, p])} onRemove={id => setPhotos(prev => prev.filter(x => x.id !== id))} disabled={defectiveSubmitting} />
                    <BigButton tone="danger" onClick={handleCreateDefectiveFabric} disabled={defectiveSubmitting}>
                      {defectiveSubmitting ? 'Kaydediliyor...' : 'İade Kaydet'}
                    </BigButton>
                  </Group>

                  <Group title={`Notlar (${checklist.filter(c => c.checkedBy).length}/${checklist.length || 0})`}>
                    <textarea
                      value={draftReport.aciklama}
                      onChange={e => handleInputChange('aciklama', e.target.value)}
                      placeholder="Operatör notu..."
                      style={{ ...S.formInput, minHeight: 84, resize: 'vertical' }}
                    />
                    <div style={S.chipRow}>
                      {QUICK_NOTES.map(n => (
                        <button key={n} onClick={() => appendQuickNote(n)} style={S.chip}>
                          {n}
                        </button>
                      ))}
                    </div>
                    {checklist.length > 0 && (
                      <div style={S.checklist}>
                        {checklist.map((item, i) => (
                          <button
                            key={`${item.text}-${i}`}
                            onClick={() => handleToggleChecklistItem(i)}
                            style={{ ...S.checkRow, ...(item.checkedBy ? S.checkRowChecked : {}) }}
                          >
                            <span style={{ ...S.checkBox, ...(item.checkedBy ? S.checkBoxChecked : {}) }}>
                              {item.checkedBy ? '✓' : ''}
                            </span>
                            {item.text}
                          </button>
                        ))}
                      </div>
                    )}
                  </Group>
                </div>

                <div style={S.reportFooter}>
                  <BigButton
                    tone="primary"
                    onClick={handleSave}
                    disabled={savingOrderId === selectedOrder.id}
                    style={{ flex: 1 }}
                  >
                    {savingOrderId === selectedOrder.id ? 'Kaydediliyor...' : '💾 Raporu Kaydet'}
                  </BigButton>
                </div>
              </>
            ) : (
              <div style={S.emptyWork}>
                <div style={S.emptyIcon}>📝</div>
                <h3 style={S.emptyTitle}>Rapor için iş emri seçin</h3>
              </div>
            )}
          </aside>
        </div>

        {/* SERİM PANELİ */}
        <section style={S.spreadingDock}>
          <button type="button" onClick={() => setSpreadingPanelOpen(v => !v)} style={S.spreadingToggle}>
            <div style={S.spreadingToggleLeft}>
              <span
                style={{
                  ...S.statusLight,
                  background: spreadingCompleted ? '#10b981' : spreadingStarted ? '#f59e0b' : '#475569',
                  boxShadow:
                    spreadingCompleted || spreadingStarted
                      ? `0 0 16px ${spreadingCompleted ? '#10b981' : '#f59e0b'}`
                      : 'none',
                }}
              />
              <div>
                <span style={S.spreadingKicker}>SERİM MAKİNESİ</span>
                <div style={S.spreadingTitle}>
                  {mtkRun.machine} <span style={S.demoBadge}>{isDemoMode ? 'DEMO' : 'CANLI'}</span>
                </div>
              </div>
            </div>
            <div style={S.spreadingToggleRight}>
              <strong style={S.spreadingStatus}>
                {spreadingCompleted ? 'Tamamlandı' : spreadingStarted ? 'Devam ediyor' : 'Başlatılmadı'}
              </strong>
              <span style={S.spreadingChevron}>{spreadingPanelOpen ? '−' : '+'}</span>
            </div>
          </button>

          {spreadingPanelOpen && (
            <div style={S.spreadingBody}>
              <div style={S.spreadingMachineRow}>
                <div style={S.spreadingField}>
                  <label style={S.spreadingLabel}>Serim makinesi</label>
                  <select
                    value={selectedMachineId ?? ''}
                    onChange={e => setSelectedMachineId(e.target.value ? Number(e.target.value) : null)}
                    disabled={spreadingStarted}
                    style={S.formInput}
                  >
                    <option value="">Makine seçin</option>
                    {spreadingMachines.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} · {m.cuttingTable.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={S.spreadingField}>
                  <label style={S.spreadingLabel}>Mod</label>
                  <div style={S.modeSwitch}>
                    <button
                      type="button"
                      onClick={() => {
                        setSpreadingMode('weight-first');
                        setRollEntries([]);
                      }}
                      disabled={spreadingStarted}
                      style={{ ...S.modeBtn, ...(spreadingMode === 'weight-first' ? S.modeBtnActive : {}) }}
                    >
                      Tartı → Serim
                    </button>
                    <button
                      type="button"
                      onClick={() => setSpreadingMode('spread-then-weight')}
                      disabled={spreadingStarted}
                      style={{ ...S.modeBtn, ...(spreadingMode === 'spread-then-weight' ? S.modeBtnActive : {}) }}
                    >
                      Serim → Tartı
                    </button>
                  </div>
                </div>
                <BigButton
                  tone={spreadingStarted ? 'ghost' : 'primary'}
                  onClick={handleStartSpreading}
                  disabled={!selectedOrder || !selectedMachine || spreadingStarted}
                  style={{ minWidth: 180, height: 56 }}
                >
                  {spreadingStarted ? 'Serim başladı' : '▶ Serimi başlat'}
                </BigButton>
              </div>

              {/* 1) Telemetri paneli */}
              {spreadingStarted && telemetry.length >= 2 && (
                <div style={S.telemetryGrid}>
                  <Sparkline
                    data={telemetryForward}
                    width={240}
                    height={52}
                    color="#3b82f6"
                    min={0}
                    max={120}
                    label="İleri hız"
                    unit="%"
                  />
                  <Sparkline
                    data={telemetryReverse}
                    width={240}
                    height={52}
                    color="#a855f7"
                    min={0}
                    max={120}
                    label="Geri hız"
                    unit="%"
                  />
                  <Sparkline
                    data={telemetryTension}
                    width={240}
                    height={52}
                    color="#f59e0b"
                    min={0}
                    max={120}
                    label="Gerilim"
                    unit="%"
                  />
                </div>
              )}

              <div style={S.rollsPanel}>
                <div style={S.rollsPanelHeader}>
                  <strong>Top / Kat takibi</strong>
                  <div style={S.rollsPanelActions}>
                    {spreadingMode === 'weight-first' ? (
                      <>
                        <SmallBtn onClick={handleReadScaleForSpreading} tone="primary">
                          Tartıdan top
                        </SmallBtn>
                        <SmallBtn
                          onClick={() => {
                            const w = prompt('Top ağırlığı (kg):', '30');
                            if (w) handleAddRollManual(Number(w));
                          }}
                          tone="primary"
                        >
                          Top ekle
                        </SmallBtn>
                      </>
                    ) : (
                      <SmallBtn
                        onClick={() => {
                          const m = prompt('Top metre:', '200');
                          if (m) handleAddRollByMeter(Number(m));
                        }}
                        tone="primary"
                      >
                        Top ekle (m)
                      </SmallBtn>
                    )}
                    {rollEntries.length > 0 && (
                      <SmallBtn onClick={handleClearRollEntries} tone="danger">
                        Temizle
                      </SmallBtn>
                    )}
                  </div>
                </div>

                {/* 2) Top barkod girişi */}
                {spreadingMode === 'weight-first' && (
                  <div style={S.rollBarcodeRow}>
                    <input
                      ref={rollBarcodeInputRef}
                      value={rollBarcodeInput}
                      onChange={e => setRollBarcodeInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRollBarcodeSubmit();
                      }}
                      placeholder="📷 Top barkodu oku (ör: 30.5 veya KOD|30.5)"
                      style={S.rollBarcodeInput}
                    />
                    <SmallBtn onClick={handleRollBarcodeSubmit} tone="success">
                      Ekle
                    </SmallBtn>
                  </div>
                )}

                {rollEntries.length > 0 ? (
                  <div>
                    {Array.from(rollTotalsByColor.entries()).map(([color, totals]) => (
                      <div key={color} style={S.rollColorGroup}>
                        <div style={S.rollColorHeader}>
                          <strong>{color}</strong>
                          <span>
                            {totals.rolls} top · {totals.weightKg.toFixed(2)} kg · {totals.layers} kat
                          </span>
                        </div>
                        {rollEntries
                          .filter(r => (r.color || 'Renk bekleniyor') === color)
                          .map(r => (
                            <div key={r.id} style={S.rollRow}>
                              <span>{r.rollNumber}. top</span>
                              <span style={S.rollWeight}>{r.weightKg.toFixed(2)} kg</span>
                              <span>{r.calculatedLayers} kat</span>
                              {spreadingMode === 'spread-then-weight' && <span>{r.pieceCount.toFixed(0)} m</span>}
                              <button onClick={() => handleRemoveRollEntry(r.id)} style={S.rollRemove}>
                                ×
                              </button>
                            </div>
                          ))}
                      </div>
                    ))}
                    <div style={S.rollTotal}>
                      Toplam: {totalRolls} top · {totalRollWeightKg.toFixed(2)} kg · {totalRollLayers} kat
                      {spreadingMode === 'spread-then-weight' && ` · ${totalRollMeters.toFixed(1)} m`}
                    </div>
                  </div>
                ) : (
                  <div style={S.rollEmpty}>Henüz top eklenmedi.</div>
                )}
              </div>

              <div style={S.layersPanel}>
                <div style={S.layersPanelHeader}>
                  <strong>Kat / Renk / Kg / Adet</strong>
                  <SmallBtn
                    onClick={() =>
                      setSpreadingLayers(prev => [
                        ...prev,
                        { color: selectedColorVariant, layerNumber: prev.length + 1, weightKg: 0, pieceCount: 0 },
                      ])
                    }
                    tone="primary"
                  >
                    + Kat
                  </SmallBtn>
                </div>
                <div style={S.layerHeaderRow}>
                  <span>Renk</span>
                  <span>Kat</span>
                  <span>Kg</span>
                  <span>Adet</span>
                  <span></span>
                </div>
                {spreadingLayers.map((layer, i) => (
                  <div key={i} style={S.layerRow}>
                    {effectiveColorVariants.length > 0 ? (
                      <select
                        value={layer.color}
                        onChange={e => updateSpreadingLayer(i, 'color', e.target.value)}
                        style={S.layerInput}
                      >
                        <option value="">—</option>
                        {effectiveColorVariants.map(c => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={layer.color}
                        onChange={e => updateSpreadingLayer(i, 'color', e.target.value)}
                        style={S.layerInput}
                        placeholder="Renk"
                      />
                    )}
                    <input
                      type="number"
                      value={layer.layerNumber}
                      onChange={e => updateSpreadingLayer(i, 'layerNumber', e.target.value)}
                      style={S.layerInput}
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={layer.weightKg}
                      onChange={e => updateSpreadingLayer(i, 'weightKg', e.target.value)}
                      style={S.layerInput}
                    />
                    <input
                      type="number"
                      value={layer.pieceCount}
                      onChange={e => updateSpreadingLayer(i, 'pieceCount', e.target.value)}
                      style={S.layerInput}
                    />
                    <button onClick={() => removeSpreadingLayer(i)} disabled={spreadingLayers.length <= 1} style={S.layerRemove}>
                      ×
                    </button>
                  </div>
                ))}
                <div style={S.layerTotals}>
                  {Array.from(colorTotals.entries()).map(([c, t]) => (
                    <span key={c}>
                      {c}: {t.weightKg.toFixed(2)} kg · {t.layers} kat
                    </span>
                  ))}
                  <strong>
                    Toplam: {totalSpreadingWeightKg.toFixed(2)} kg · {totalSpreadingPieces} adet
                  </strong>
                </div>
              </div>

              <BigButton
                tone="success"
                onClick={requestSpreadingComplete}
                disabled={!selectedOrder || !spreadingStarted || spreadingCompleted}
                style={{ width: '100%', marginTop: 12 }}
              >
                {spreadingCompleted ? '✓ Serim verileri alındı' : 'Serim tamamlandı — iş emrine al'}
              </BigButton>
            </div>
          )}
        </section>

        {/* NUMERİK KLAVYE */}
        <Numpad
          open={numpad.open}
          title={numpad.title}
          unit={numpad.unit}
          value={
            numpad.key === 'fabricExit'
              ? fabricExitQuantityDraft
              : numpad.key === 'defective'
              ? defectiveQuantityDraft
              : numpad.key
              ? String((draftReport as any)[numpad.key] ?? '')
              : ''
          }
          decimal={numpad.decimal !== false}
          onClose={() => setNumpad({ open: false, key: null, title: '' })}
          onConfirm={handleNumpadConfirm}
        />

        {/* 5) KPI */}
        <KPIPanel
          open={kpiOpen}
          stats={sessionStats}
          onClose={() => setKpiOpen(false)}
          onReset={() =>
            setSessionStats({
              startedAt: new Date().toISOString(),
              completedOrders: 0,
              totalKgCut: 0,
              totalWasteKg: 0,
              totalDefectiveKg: 0,
              totalOrdersWorked: new Set<number>(),
            })
          }
        />

        {/* 6) İmza */}
        <SignaturePad
          open={signatureOpen}
          onClose={() => setSignatureOpen(false)}
          onSave={data => {
            setSignatureDataUrl(data);
            if (data) {
              playBeep('ok');
              setInfoMessage('İmza kaydedildi.');
            }
          }}
        />

        {/* KİLİT OVERLAY */}
        {isOperatorLocked && (
          <div style={S.lockOverlay}>
            <div style={S.lockCard}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
              <h2 style={S.lockTitle}>Ekran kilitli</h2>
              <p style={S.lockText}>Devam etmek için kilidi açın.</p>
              <BigButton tone="primary" onClick={() => setIsOperatorLocked(false)} style={{ width: '100%', marginTop: 20 }}>
                Ekranı Aç
              </BigButton>
            </div>
          </div>
        )}

        {/* ONAY MODALLARI */}
        {showSpreadingConfirm && (
          <div style={S.lockOverlay}>
            <div style={S.confirmCard}>
              <h2 style={S.lockTitle}>Serim verisini iş emrine al?</h2>
              <p style={S.lockText}>{selectedOrder?.orderNo} iş emrine makine verileri yazılacak.</p>
              <div style={S.confirmActions}>
                <BigButton tone="ghost" onClick={() => setShowSpreadingConfirm(false)} style={{ flex: 1 }}>
                  Vazgeç
                </BigButton>
                <BigButton tone="success" onClick={handleSpreadingComplete} style={{ flex: 1 }}>
                  Onayla
                </BigButton>
              </div>
            </div>
          </div>
        )}
        {showCompleteConfirm && (
          <div style={S.lockOverlay}>
            <div style={S.confirmCard}>
              <h2 style={S.lockTitle}>Kesimi tamamla?</h2>
              <p style={S.lockText}>{selectedOrder?.orderNo} iş emri kapatılacak.</p>
              <div style={S.confirmActions}>
                <BigButton tone="ghost" onClick={() => setShowCompleteConfirm(false)} style={{ flex: 1 }}>
                  Vazgeç
                </BigButton>
                <BigButton tone="success" onClick={handleCompleteCutting} style={{ flex: 1 }}>
                  Onayla
                </BigButton>
              </div>
            </div>
          </div>
        )}

        {/* BİLDİRİM */}
        {infoMessage && <div style={S.infoToast}>{infoMessage}</div>}
        {error && <div style={S.errorToast}>{error}</div>}
      </div>
    </AuthGuard>
  );
};

/* ================================================================== */
/* STİLLER                                                             */
/* ================================================================== */
const S: Record<string, React.CSSProperties> = {
  appShell: {
    minHeight: '100vh',
    background: '#0b1220',
    color: '#e2e8f0',
    fontFamily: 'Inter, system-ui, -apple-system, Arial, sans-serif',
    letterSpacing: '-0.01em',
    display: 'flex',
    flexDirection: 'column',
  },
  topBar: {
    minHeight: 64,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 20px',
    background: '#0f172a',
    borderBottom: '1px solid #1e293b',
    gap: 16,
    position: 'sticky',
    top: 0,
    zIndex: 10,
    flexWrap: 'wrap',
  },
  brandBlock: { display: 'flex', alignItems: 'center', gap: 12 },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: 10,
    background: 'linear-gradient(135deg,#2563eb,#3b82f6)',
    color: '#fff',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 900,
    fontSize: 20,
  },
  brandTitle: { fontSize: 16, fontWeight: 800, color: '#f8fafc', lineHeight: 1.1 },
  brandSubtitle: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  topStatus: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  topActions: { display: 'flex', alignItems: 'center', gap: 10 },
  topIconButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    background: '#1e293b',
    color: '#cbd5e1',
    border: '1px solid #334155',
    fontSize: 16,
    cursor: 'pointer',
    display: 'grid',
    placeItems: 'center',
  },
  operatorChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px 6px 6px',
    background: '#111827',
    border: '1px solid #334155',
    borderRadius: 99,
    cursor: 'pointer',
  },
  operatorAvatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: '#334155',
    color: '#e2e8f0',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 700,
    fontSize: 12,
  },
  operatorName: { fontSize: 13, color: '#f1f5f9', fontWeight: 700 },
  lockButton: {
    minHeight: 44,
    padding: '0 18px',
    border: 'none',
    borderRadius: 10,
    color: '#fff',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 14px',
    borderRadius: 99,
    fontSize: 12,
    fontWeight: 700,
  },
  offlineBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  mobileTabs: {
    display: 'none',
    gap: 6,
    padding: '10px 12px',
    background: '#0f172a',
    borderBottom: '1px solid #1e293b',
  },
  mobileTab: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    border: '1px solid #1e293b',
    background: '#111827',
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  mobileTabActive: { background: '#1d4ed8', color: '#fff', borderColor: '#1d4ed8' },
  mobileTabBadge: {
    background: 'rgba(255,255,255,0.25)',
    padding: '2px 6px',
    borderRadius: 99,
    fontSize: 11,
    marginLeft: 4,
  },
  mainGrid: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '300px minmax(0, 1fr) 420px',
    gap: 14,
    padding: 14,
    minHeight: 0,
  },
  sidebar: {
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: 14,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
  },
  sidebarHeader: { padding: '14px 14px 8px', borderBottom: '1px solid #1e293b' },
  sidebarKicker: { fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: '#64748b' },
  sidebarTitle: { margin: '4px 0 12px', fontSize: 16, fontWeight: 800, color: '#f1f5f9' },
  countBadge: {
    background: '#1e293b',
    color: '#94a3b8',
    padding: '2px 8px',
    borderRadius: 99,
    fontSize: 11,
    marginLeft: 6,
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    background: '#111827',
    borderRadius: 10,
    border: '1px solid #334155',
    padding: '0 14px',
    height: 52,
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: 600,
  },
  orderList: { flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 },
  orderCard: {
    background: '#111827',
    border: '1px solid #1e293b',
    borderRadius: 12,
    padding: '14px 14px',
    cursor: 'pointer',
    textAlign: 'left',
    color: '#e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minHeight: 88,
    transition: 'background 120ms, border-color 120ms',
  },
  orderCardActive: {
    background: 'linear-gradient(135deg, rgba(37,99,235,0.22), rgba(59,130,246,0.10))',
    borderColor: '#3b82f6',
    boxShadow: '0 0 0 1px #3b82f6 inset',
  },
  orderCardTop: { display: 'flex', alignItems: 'center', gap: 8 },
  statusDotLg: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  orderNo: { fontSize: 15, fontWeight: 800, flex: 1, color: '#f1f5f9' },
  orderDate: { fontSize: 11, color: '#94a3b8' },
  orderProduct: { fontSize: 12, color: '#cbd5e1' },
  orderMeta: { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginTop: 2 },
  orderQty: { color: '#93c5fd', fontWeight: 700 },
  emptyList: { padding: 24, textAlign: 'center', color: '#64748b', fontSize: 13 },
  workArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    minHeight: 0,
    overflowY: 'auto',
    paddingRight: 2,
  },
  workHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: 14,
    padding: '18px 20px',
  },
  workKicker: { fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: '#64748b' },
  workTitle: { margin: '4px 0 4px', fontSize: 26, fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.02em' },
  workMeta: { margin: 0, fontSize: 13, color: '#94a3b8' },
  metaDot: { margin: '0 6px', color: '#334155' },
  workHeaderRight: { display: 'flex', alignItems: 'center', gap: 10 },
  statusPillLg: { padding: '8px 16px', borderRadius: 99, fontSize: 13, fontWeight: 800 },
  heroPanel: {
    display: 'grid',
    gridTemplateColumns: '200px 1fr',
    gap: 14,
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
  },
  progressBlock: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  progressCenter: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressPercent: { fontSize: 32, fontWeight: 900, color: '#f1f5f9', lineHeight: 1 },
  progressLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  progressSub: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  metricStrip: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 },
  metricTile: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '14px 16px',
    borderRadius: 12,
    border: '1px solid',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'transform 120ms',
    minHeight: 76,
  },
  metricTileLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  metricTileRow: { display: 'flex', alignItems: 'baseline', gap: 6 },
  metricTileValue: { fontSize: 26, fontWeight: 900, lineHeight: 1 },
  metricTileUnit: { fontSize: 12, color: '#94a3b8', fontWeight: 600 },
  stepBar: { display: 'flex', gap: 8 },
  stepItem: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: 12,
    padding: '12px 14px',
    cursor: 'pointer',
    textAlign: 'left',
    color: '#cbd5e1',
  },
  stepItemActive: {
    background: 'linear-gradient(135deg, rgba(37,99,235,0.18), rgba(59,130,246,0.08))',
    borderColor: '#3b82f6',
  },
  stepNum: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: '#1e293b',
    color: '#94a3b8',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 800,
    fontSize: 14,
    flexShrink: 0,
  },
  stepNumActive: { background: '#2563eb', color: '#fff' },
  stepText: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1 },
  stepLabel: { fontSize: 13, fontWeight: 800, color: '#f1f5f9' },
  stepDesc: { fontSize: 11, color: '#94a3b8' },
  stepArrow: { fontSize: 20, color: '#334155', marginLeft: 'auto' },
  stepBody: {
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: 14,
    padding: 16,
  },
  quickGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 12,
  },
  quickEntry: {
    background: '#111827',
    border: '1px solid #334155',
    borderRadius: 12,
    padding: '16px 18px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    textAlign: 'left',
    minHeight: 96,
  },
  quickEntryLabel: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.04em',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  quickEntryValueRow: { display: 'flex', alignItems: 'baseline', gap: 8 },
  quickEntryValue: { fontSize: 32, fontWeight: 900, color: '#f1f5f9', lineHeight: 1 },
  quickEntryUnit: { fontSize: 14, color: '#94a3b8', fontWeight: 600 },
  step2Wrap: { display: 'flex', flexDirection: 'column' },
  step2Info: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 12,
    padding: 12,
    background: '#111827',
    borderRadius: 10,
    border: '1px solid #1e293b',
  },
  step2Key: {
    display: 'block',
    fontSize: 10,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 4,
  },
  telemetryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 12,
    marginTop: 12,
    padding: 12,
    background: '#111827',
    border: '1px solid #1e293b',
    borderRadius: 12,
  },
  scalePanel: {
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: 14,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  scalePanelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  scalePanelTitle: { fontSize: 13, fontWeight: 800, color: '#e2e8f0' },
  scaleBtnRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  scaleReading: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    background: 'rgba(16,185,129,0.10)',
    border: '1px solid rgba(16,185,129,0.4)',
    borderRadius: 10,
  },
  scaleReadingValue: { fontSize: 28, fontWeight: 900, color: '#6ee7b7' },
  scaleReadingMeta: { fontSize: 12, color: '#94a3b8', fontWeight: 600 },
  fabricExitRow: { display: 'flex', gap: 8, alignItems: 'center' },
  fabricExitInput: {
    flex: 1,
    minHeight: 56,
    background: '#111827',
    border: '1px solid #334155',
    borderRadius: 10,
    padding: '0 16px',
    color: '#f1f5f9',
    fontSize: 20,
    fontWeight: 800,
  },
  fabricExitUnit: {
    minHeight: 56,
    background: '#111827',
    border: '1px solid #334155',
    borderRadius: 10,
    padding: '0 12px',
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: 800,
    cursor: 'pointer',
  },
  scaleHistory: { display: 'flex', flexDirection: 'column', gap: 4 },
  scaleHistoryItem: {
    display: 'flex',
    gap: 12,
    padding: '6px 10px',
    background: 'rgba(15,23,42,0.6)',
    borderRadius: 6,
    fontSize: 12,
    color: '#94a3b8',
  },
  scaleHistoryMeta: { marginLeft: 'auto', color: '#6ee7b7' },
  details: {
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: 14,
    overflow: 'hidden',
  },
  detailsSummary: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 800,
    color: '#f1f5f9',
  },
  detailsMeta: { fontSize: 12, color: '#94a3b8', fontWeight: 600 },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 12,
    padding: '0 20px 16px',
  },
  detailItem: { display: 'flex', flexDirection: 'column', gap: 4 },
  detailLabel: { fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' },
  detailValue: { fontSize: 14, fontWeight: 700, color: '#e2e8f0' },
  colorVariants: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 20px 18px',
    flexWrap: 'wrap',
  },
  colorVariantsLabel: { fontSize: 11, color: '#94a3b8', fontWeight: 700 },
  colorChip: {
    padding: '6px 12px',
    background: '#111827',
    border: '1px solid #334155',
    borderRadius: 99,
    fontSize: 12,
    fontWeight: 700,
    color: '#cbd5e1',
    cursor: 'pointer',
  },
  colorChipActive: { background: '#2563eb', color: '#fff', borderColor: '#2563eb' },
  emptyWork: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
    background: '#0f172a',
    borderRadius: 14,
    border: '1px solid #1e293b',
    minHeight: 400,
  },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { margin: 0, fontSize: 20, fontWeight: 800, color: '#f1f5f9' },
  emptyText: { marginTop: 8, color: '#94a3b8', fontSize: 14 },
  reportPanel: {
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: 14,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
  },
  reportHeader: { padding: '16px 18px 12px', borderBottom: '1px solid #1e293b' },
  reportKicker: { fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: '#64748b' },
  reportTitle: { margin: '4px 0 4px', fontSize: 18, fontWeight: 800, color: '#f1f5f9' },
  reportSub: { fontSize: 12, color: '#94a3b8' },
  reportBody: { flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 14 },
  reportFooter: {
    padding: 14,
    borderTop: '1px solid #1e293b',
    display: 'flex',
    gap: 8,
  },
  group: {
    background: '#111827',
    border: '1px solid #1e293b',
    borderRadius: 12,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  groupTitle: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.1em',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  groupBody: { display: 'flex', flexDirection: 'column', gap: 10 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  fieldTouch: { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldLabelRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabel: { fontSize: 11, fontWeight: 700, color: '#94a3b8' },
  fieldTouchInput: {
    minHeight: 56,
    background: '#0b1220',
    border: '1px solid #334155',
    borderRadius: 10,
    padding: '0 14px',
    color: '#f1f5f9',
    fontSize: 18,
    fontWeight: 800,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  fieldTouchInputRO: {
    background: 'rgba(15,23,42,0.6)',
    color: '#94a3b8',
    cursor: 'not-allowed',
  },
  fieldTouchInputAuto: { borderColor: 'rgba(16,185,129,0.5)', background: 'rgba(16,185,129,0.08)' },
  fieldTouchValue: { flex: 1, textAlign: 'left' },
  fieldTouchUnit: { fontSize: 12, color: '#94a3b8', fontWeight: 600 },
  autoBadge: {
    background: 'rgba(16,185,129,0.2)',
    color: '#6ee7b7',
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  formInput: {
    width: '100%',
    minHeight: 48,
    background: '#0b1220',
    border: '1px solid #334155',
    borderRadius: 10,
    padding: '10px 14px',
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: 600,
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: {
    padding: '8px 12px',
    background: 'rgba(59,130,246,0.12)',
    border: '1px solid rgba(59,130,246,0.35)',
    borderRadius: 99,
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  outputBadge: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    background: 'rgba(16,185,129,0.12)',
    border: '1px solid rgba(16,185,129,0.4)',
    borderRadius: 10,
    color: '#6ee7b7',
    fontSize: 13,
    fontWeight: 700,
  },
  checklist: { display: 'flex', flexDirection: 'column', gap: 6 },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid #334155',
    background: '#0b1220',
    color: '#cbd5e1',
    cursor: 'pointer',
    fontSize: 13,
    textAlign: 'left',
    minHeight: 48,
  },
  checkRowChecked: { background: 'rgba(16,185,129,0.10)', borderColor: 'rgba(16,185,129,0.45)', color: '#6ee7b7' },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    border: '1px solid #334155',
    display: 'grid',
    placeItems: 'center',
    background: '#0b1220',
    color: 'transparent',
    fontSize: 13,
    fontWeight: 800,
    flexShrink: 0,
  },
  checkBoxChecked: { background: '#10b981', borderColor: '#10b981', color: '#fff' },
  bigButton: {
    minHeight: 56,
    padding: '0 22px',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    letterSpacing: '-0.01em',
    transition: 'transform 120ms, box-shadow 120ms',
  },
  smallBtn: {
    minHeight: 44,
    padding: '0 16px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  spreadingDock: {
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: 14,
    margin: 14,
    overflow: 'hidden',
  },
  spreadingToggle: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    background: 'transparent',
    border: 'none',
    color: '#e2e8f0',
    cursor: 'pointer',
    gap: 14,
    textAlign: 'left',
  },
  spreadingToggleLeft: { display: 'flex', alignItems: 'center', gap: 14 },
  spreadingToggleRight: { display: 'flex', alignItems: 'center', gap: 12 },
  spreadingKicker: { fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: '#64748b' },
  spreadingTitle: { fontSize: 15, fontWeight: 800, color: '#f1f5f9', marginTop: 2 },
  spreadingStatus: { fontSize: 13, color: '#94a3b8', fontWeight: 700 },
  spreadingChevron: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: '1px solid #334155',
    background: '#111827',
    color: '#cbd5e1',
    display: 'grid',
    placeItems: 'center',
    fontSize: 16,
    fontWeight: 800,
  },
  statusLight: { width: 14, height: 14, borderRadius: '50%', display: 'inline-block', transition: 'background 200ms' },
  demoBadge: {
    background: 'rgba(245,158,11,0.18)',
    color: '#fcd34d',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 800,
    marginLeft: 6,
    letterSpacing: '0.06em',
  },
  spreadingBody: { padding: '0 20px 20px', borderTop: '1px solid #1e293b' },
  spreadingMachineRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    paddingTop: 14,
  },
  spreadingField: { display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 220 },
  spreadingLabel: { fontSize: 11, fontWeight: 700, color: '#94a3b8' },
  modeSwitch: {
    display: 'flex',
    background: '#111827',
    border: '1px solid #334155',
    borderRadius: 10,
    overflow: 'hidden',
    minHeight: 48,
  },
  modeBtn: {
    flex: 1,
    padding: '0 12px',
    border: 'none',
    background: 'transparent',
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  modeBtnActive: { background: '#2563eb', color: '#fff' },
  rollsPanel: {
    marginTop: 14,
    background: '#111827',
    border: '1px solid #1e293b',
    borderRadius: 12,
    padding: 12,
  },
  rollsPanelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
    flexWrap: 'wrap',
    color: '#e2e8f0',
    fontSize: 13,
  },
  rollsPanelActions: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  rollBarcodeRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  rollBarcodeInput: {
    flex: 1,
    minHeight: 48,
    background: '#0b1220',
    border: '1px solid #334155',
    borderRadius: 10,
    padding: '0 14px',
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: 700,
    fontFamily: 'ui-monospace, monospace',
  },
  rollColorGroup: { marginBottom: 10 },
  rollColorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 10px',
    background: 'rgba(37,99,235,0.08)',
    borderRadius: 8,
    marginBottom: 6,
    fontSize: 12,
    color: '#93c5fd',
  },
  rollRow: {
    display: 'grid',
    gridTemplateColumns: '80px 110px 80px 80px 32px',
    gap: 8,
    padding: '8px 10px',
    background: '#0b1220',
    border: '1px solid #1e293b',
    borderRadius: 8,
    marginBottom: 4,
    alignItems: 'center',
    fontSize: 13,
    color: '#cbd5e1',
  },
  rollWeight: { color: '#6ee7b7', fontWeight: 800, fontFamily: 'ui-monospace, monospace' },
  rollRemove: {
    width: 28,
    height: 28,
    border: '1px solid #7f1d1d',
    background: 'rgba(220,38,38,0.15)',
    color: '#fca5a5',
    borderRadius: 6,
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
    display: 'grid',
    placeItems: 'center',
  },
  rollTotal: {
    marginTop: 8,
    padding: '10px 14px',
    background: 'linear-gradient(135deg,#059669,#10b981)',
    color: '#fff',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 800,
    textAlign: 'center',
  },
  rollEmpty: { padding: 20, textAlign: 'center', color: '#64748b', fontSize: 13, fontStyle: 'italic' },
  layersPanel: {
    marginTop: 14,
    background: '#111827',
    border: '1px solid #1e293b',
    borderRadius: 12,
    padding: 12,
  },
  layersPanelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    color: '#e2e8f0',
    fontSize: 13,
  },
  layerHeaderRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 80px 90px 90px 36px',
    gap: 8,
    padding: '0 4px 6px',
    fontSize: 10,
    fontWeight: 800,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  layerRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 80px 90px 90px 36px',
    gap: 8,
    marginBottom: 6,
    alignItems: 'center',
  },
  layerInput: {
    minHeight: 44,
    background: '#0b1220',
    border: '1px solid #334155',
    borderRadius: 8,
    padding: '0 10px',
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: 700,
  },
  layerRemove: {
    width: 36,
    height: 44,
    border: '1px solid #7f1d1d',
    background: 'rgba(220,38,38,0.15)',
    color: '#fca5a5',
    borderRadius: 8,
    fontSize: 18,
    fontWeight: 800,
    cursor: 'pointer',
  },
  layerTotals: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px 14px',
    padding: '10px 4px 0',
    borderTop: '1px solid #1e293b',
    marginTop: 8,
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 600,
  },
  photoAddBtn: {
    minHeight: 48,
    padding: '0 16px',
    background: 'rgba(59,130,246,0.12)',
    border: '1px dashed rgba(59,130,246,0.6)',
    borderRadius: 10,
    color: '#93c5fd',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  photoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
    gap: 8,
  },
  photoThumb: {
    position: 'relative',
    aspectRatio: '1 / 1',
    borderRadius: 10,
    overflow: 'hidden',
    border: '1px solid #334155',
    background: '#0b1220',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    background: 'rgba(220,38,38,0.9)',
    color: '#fff',
    border: 'none',
    borderRadius: '50%',
    fontSize: 14,
    fontWeight: 900,
    cursor: 'pointer',
    display: 'grid',
    placeItems: 'center',
  },
  signaturePreviewBox: {
    position: 'relative',
    padding: 10,
    background: '#fff',
    borderRadius: 10,
    border: '1px solid #334155',
    display: 'flex',
    justifyContent: 'center',
  },
  signatureRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    background: 'rgba(220,38,38,0.9)',
    color: '#fff',
    border: 'none',
    borderRadius: '50%',
    fontSize: 14,
    fontWeight: 900,
    cursor: 'pointer',
    display: 'grid',
    placeItems: 'center',
  },
  kpiTile: {
    padding: 14,
    background: '#111827',
    border: '1px solid #1e293b',
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  kpiLabel: { fontSize: 11, color: '#94a3b8', fontWeight: 700 },
  kpiValue: { fontSize: 22, fontWeight: 900, color: '#f1f5f9' },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'grid',
    placeItems: 'center',
    zIndex: 100,
    padding: 16,
  },
  numpad: {
    width: '100%',
    maxWidth: 480,
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 20,
    padding: 20,
    boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
  },
  numpadHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  numpadTitle: { fontSize: 15, fontWeight: 800, color: '#f1f5f9' },
  numpadUnit: { fontSize: 12, color: '#94a3b8', fontWeight: 700 },
  numpadDisplay: {
    background: '#0b1220',
    borderRadius: 12,
    padding: '20px 24px',
    fontSize: 40,
    fontWeight: 900,
    color: '#f1f5f9',
    textAlign: 'right',
    marginBottom: 14,
    letterSpacing: '-0.02em',
    minHeight: 80,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    fontFamily: 'ui-monospace, monospace',
    border: '1px solid #334155',
  },
  numpadGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
    marginBottom: 14,
  },
  numpadKey: {
    minHeight: 72,
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 12,
    color: '#f1f5f9',
    fontSize: 26,
    fontWeight: 800,
    cursor: 'pointer',
  },
  numpadActions: { display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 },
  numpadBtn: {
    minHeight: 60,
    borderRadius: 12,
    border: 'none',
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
  },
  numpadBtnGhost: { background: 'transparent', color: '#94a3b8', border: '1px solid #334155' },
  numpadBtnPrimary: { background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff' },
  lockOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
    display: 'grid',
    placeItems: 'center',
    zIndex: 90,
    padding: 16,
  },
  lockCard: {
    width: '100%',
    maxWidth: 400,
    padding: 28,
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 20,
    textAlign: 'center',
    boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
  },
  lockTitle: { margin: 0, fontSize: 20, fontWeight: 800, color: '#f1f5f9' },
  lockText: { marginTop: 8, color: '#94a3b8', fontSize: 14 },
  confirmCard: {
    width: '100%',
    maxWidth: 420,
    padding: 24,
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 20,
    textAlign: 'center',
    boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
  },
  confirmActions: { display: 'flex', gap: 10, marginTop: 20 },
  infoToast: {
    position: 'fixed',
    right: 24,
    bottom: 24,
    background: 'rgba(37,99,235,0.95)',
    color: '#fff',
    padding: '14px 20px',
    borderRadius: 12,
    zIndex: 30,
    fontSize: 14,
    fontWeight: 700,
    boxShadow: '0 12px 32px rgba(37,99,235,0.4)',
    maxWidth: 400,
  },
  errorToast: {
    position: 'fixed',
    right: 24,
    bottom: 96,
    background: 'rgba(220,38,38,0.95)',
    color: '#fff',
    padding: '14px 20px',
    borderRadius: 12,
    zIndex: 30,
    fontSize: 14,
    fontWeight: 700,
    boxShadow: '0 12px 32px rgba(220,38,38,0.4)',
    maxWidth: 400,
  },
  loadingContainer: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: '#0b1220',
    gap: 16,
  },
  loadingSpinner: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    border: '3px solid #1e293b',
    borderTopColor: '#3b82f6',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: { margin: 0, color: '#94a3b8', fontSize: 14, fontWeight: 700 },
};

/* ================================================================== */
/* GLOBAL STİLLER                                                      */
/* ================================================================== */
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    [data-cutting-workshop] * { box-sizing: border-box; }
    [data-cutting-workshop] button:not(:disabled):hover { filter: brightness(1.1); }
    [data-cutting-workshop] button:not(:disabled):active { transform: translateY(1px); }
    [data-cutting-workshop] button:not(:disabled):focus-visible,
    [data-cutting-workshop] input:focus-visible,
    [data-cutting-workshop] select:focus-visible,
    [data-cutting-workshop] textarea:focus-visible {
      outline: 3px solid rgba(59,130,246,0.5);
      outline-offset: 2px;
    }
    [data-cutting-workshop] ::-webkit-scrollbar { width: 8px; height: 8px; }
    [data-cutting-workshop] ::-webkit-scrollbar-track { background: transparent; }
    [data-cutting-workshop] ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
    [data-cutting-workshop] ::-webkit-scrollbar-thumb:hover { background: #475569; }

    @media (max-width: 1400px) {
      [data-cutting-workshop] .cutting-main-grid {
        grid-template-columns: 260px minmax(0, 1fr) 380px;
      }
    }
    @media (max-width: 1180px) {
      [data-cutting-workshop] .cutting-main-grid {
        grid-template-columns: 1fr;
      }
      [data-cutting-workshop] .hide-mobile { display: none !important; }
      [data-cutting-workshop] nav[style*="mobileTabs"] { display: flex !important; }
    }
    @media (max-width: 760px) {
      [data-cutting-workshop] .cutting-main-grid { padding: 10px; gap: 10px; }
    }
  `;
  document.head.appendChild(style);
}

export default CuttingWorkshopPage;