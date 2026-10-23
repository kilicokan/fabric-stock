"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
interface ColorLayerEntry {
  color: string;
  layers: number;
  rawCounterValue: number;
  counterStartValue: number;
  source: 'manual' | 'plc';
  enteredAt: string;
  enteredBy: string;
  hadCounterReset: boolean;
}
import AuthGuard from "../../components/AuthGuard";
import { readParameterSettings } from "../../lib/parameters";
import {
  bridgeConnectScale,
  bridgeDisconnectScale,
  bridgeReadWeight,
  connectScale,
  hasLocalBridge,
  readScaleSettings,
  readScaleWeight,
} from "../../lib/scale";
import type { ScaleReading, WebSerialPort } from "../../lib/scale";
import { appendPastalPlanEvent, mergePastalPlan, parsePastalPlan } from "../../lib/pastalPlan";
import type { PastalPlan, PastalPlanEvent } from "../../lib/pastalPlan";
import {
  getActualLayersForColor,
  isPlcCounterReset,
  resolveManualColorCounter,
} from "../../lib/cuttingWorkflow";
import {
  assignCountedLayers,
  calculateOutputPieces,
  calculatePastalWeightKg,
  calculateUnitGrammage,
  rollEntriesToSpreadingLayers,
} from "./cuttingCalculations";
import LayerCounter from "./LayerCounter";
import PastalPlanModal from "./PastalPlanModal";

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
  cuttingTable?: { id: number; name: string } | null;
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
  source?: string;
  corrections?: Array<{ at: string; userEmail?: string; reason?: string; from: number; to: number }>;
  machineId?: number | null;
  cuttingTableId?: number | null;
}
interface SpreadingMachine {
  id: number;
  code: string;
  name: string;
  layerSource: 'PLC' | 'MANUAL';
  cuttingTable: { id: number; name: string };
}
interface CuttingSessionSnapshot {
  savedAt: number;
  selectedOrderId: number | null;
  activeColor: string;
  rollEntries: RollEntry[];
  plcStartLayers: Record<string, number>;
  photos: PhotoAttachment[];
  signatureDataUrl: string | null;
  selectedMachineId: number | null;
  spreadingMode: SpreadingMode;
  colorLayerEntries: Record<string, ColorLayerEntry>;
  lastKnownCounter: number;
}
interface CuttingRunSessionSnapshot {
  savedAt: number;
  selectedOrderId: number | null;
  spreadingStarted: boolean;
  mtkRun: MtkSpreadingRun;
  spreadingRunsByOrder: Record<number, MtkSpreadingRun>;
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
  startLayer?: number;
  countedLayers?: number;
  meters?: number;
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
const IS_CUTTING_DEMO_MODE =
  process.env.NEXT_PUBLIC_CUTTING_DEMO_MODE === 'true' ||
  (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_CUTTING_DEMO_MODE !== 'false');
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
const CUTTING_SESSION_KEY = 'cutting_workshop_session_v1';
const CUTTING_RUN_SESSION_KEY = 'cutting_workshop_run_session_v1';
const CUTTING_SESSION_MAX_AGE_MS = 4 * 60 * 60 * 1000;
const IDLE_LOCK_MS = 5 * 60 * 1000;
const TELEMETRY_MAX = 60;

// KESIM aşamasının tracking kaydını "teslim alındı" yapar. İş emrini KAPATMAZ:
// iş emri yalnızca Merkez Depo teslim aldığında (son aşama) kapanır.
// Backend: PATCH /api/fason/assignments  (body: { action:'receive', id, receivedQuantity, completeWorkOrder:false })
const CUTTING_RECEIVE_URL = '/api/fason/assignments';
const OFFLINE_QUEUED_MESSAGE = 'Çevrimdışısınız. İşlem kuyruğa alındı; bağlantı gelince gönderilecek.';

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
    colorLayerEntries?: Record<string, ColorLayerEntry>;
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
                const current = totals.get(color) || {
                  rolls: 0, weightKg: 0, layers: 0, pieceCount: 0, countedLayers: 0,
                };
                current.rolls += 1;
                current.weightKg += Number(roll.weightKg) || 0;
                current.layers += Number(roll.calculatedLayers) || 0;
                current.countedLayers += Number(roll.countedLayers) || 0;
                current.pieceCount += Number(roll.meters ?? roll.pieceCount) || 0;
                totals.set(color, current);
                return totals;
              }, new Map<string, RollTotals & { countedLayers: number }>())
            )
          )
        : {};
    parsed.spreading = {
      machine: spreading.machine,
      cuttingTable: spreading.cuttingTable,
      layers: spreading.layers,
      mode: spreading.mode ?? 'weight-first',
      rolls: spreading.rolls ?? [],
      colorLayerEntries: spreading.colorLayerEntries ?? {},
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
      totalCountedRollLayers: spreading.rolls
        ? spreading.rolls.reduce((sum, roll) => sum + (Number(roll.countedLayers) || 0), 0)
        : 0,
      totalRollMeters: spreading.rolls
        ? spreading.rolls.reduce((sum, roll) => sum + (Number(roll.meters ?? roll.pieceCount) || 0), 0)
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

const getAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
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

const calculateRollTotalsByColor = (rolls: RollEntry[]): Map<string, RollTotals> => {
  const totals = new Map<string, RollTotals>();
  rolls.forEach(roll => {
    const color = roll.color.trim() || 'Renk bekleniyor';
    const current = totals.get(color) || { weightKg: 0, layers: 0, pieceCount: 0, rolls: 0 };
    current.weightKg += Number(roll.weightKg) || 0;
    current.layers += Number(roll.calculatedLayers) || 0;
    current.pieceCount += Number(roll.meters ?? roll.pieceCount) || 0;
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
    const stored = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    if (!Array.isArray(stored)) throw new Error('Çevrimdışı kuyruk biçimi geçersiz.');
    const sanitized = stored.map((item: OfflineItem) => ({
      ...item,
      headers: withoutAuthorization(item.headers || {}),
    }));
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(sanitized));
    return sanitized;
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

const withoutAuthorization = (headers: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(headers).filter(([key]) => key.toLowerCase() !== 'authorization'));

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
            <span style={S.kpiLabel}>Tamamlanan kesim</span>
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
  const selectedOrderIdRef = useRef<number | null>(selectedOrderId);
  selectedOrderIdRef.current = selectedOrderId;
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
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [scaleReading, setScaleReading] = useState<ScaleReading | null>(null);
  const [scaleReadings, setScaleReadings] = useState<{ reading: ScaleReading; time: string; usedFor?: string }[]>([]);
  const [scaleConnecting, setScaleConnecting] = useState(false);
  const [mtkRun, setMtkRun] = useState<MtkSpreadingRun>(MOCK_SPREADING_RUN);
  const [spreadingRunsByOrder, setSpreadingRunsByOrder] = useState<Record<number, MtkSpreadingRun>>({});
  const [plcStartLayers, setPlcStartLayers] = useState<Record<string, number>>({});
  const [promptedColorTransitions, setPromptedColorTransitions] = useState<string[]>([]);
  const [mtkError, setMtkError] = useState<string | null>(null);
  const [spreadingMachines, setSpreadingMachines] = useState<SpreadingMachine[]>([]);
  const [selectedMachineId, setSelectedMachineId] = useState<number | null>(null);
  const [spreadingStarted, setSpreadingStarted] = useState(false);
  const [pendingManualLayers, setPendingManualLayers] = useState(0);
  const [spreadingMode, setSpreadingMode] = useState<SpreadingMode>('weight-first');
  const [rollEntries, setRollEntries] = useState<RollEntry[]>([]);
  const [operatorName, setOperatorName] = useState('Operatör');
  const [weightCalcInputs, setWeightCalcInputs] = useState<WeightCalcInputs>({ gramaje: 0, widthCm: 0, lengthM: 0 });
  const [spreadingLayers, setSpreadingLayers] = useState<SpreadingLayerInput[]>([
    { color: '', layerNumber: 1, weightKg: 0, pieceCount: 0 },
  ]);
  const [showSpreadingConfirm, setShowSpreadingConfirm] = useState(false);
  const [showColorTransition, setShowColorTransition] = useState(false);
  const [showPartialColorConfirm, setShowPartialColorConfirm] = useState(false);
  const [colorDecisionSaving, setColorDecisionSaving] = useState(false);
  const [colorLayerEntries, setColorLayerEntries] = useState<Record<string, ColorLayerEntry>>({});
  const [lastKnownCounter, setLastKnownCounter] = useState(0);
  const [colorCounterDraft, setColorCounterDraft] = useState('');
  const [colorCounterResetChoice, setColorCounterResetChoice] = useState<boolean | null>(null);
  const [pendingPlcReset, setPendingPlcReset] = useState<{
    previousLayer: number;
    currentLayer: number;
    observedAt: number;
  } | null>(null);
  const [manualResetLayer, setManualResetLayer] = useState('');
  const [sessionRestoreReady, setSessionRestoreReady] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [defectiveQuantityDraft, setDefectiveQuantityDraft] = useState('');
  const [defectiveReasonDraft, setDefectiveReasonDraft] = useState('');
  const [defectiveSubmitting, setDefectiveSubmitting] = useState(false);
  const [activeColor, setActiveColor] = useState<string>('');
  const [pastalPlanOpen, setPastalPlanOpen] = useState(false);
  const [pastalPlanSaving, setPastalPlanSaving] = useState(false);
  const [defectiveColorVariant, setDefectiveColorVariant] = useState<string>('');
  const [sizeCounts, setSizeCounts] = useState<Record<string, number>>({});
  const [isDarkMode, setIsDarkMode] = useState(true);
  const isDemoMode = IS_CUTTING_DEMO_MODE;
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
  const pendingPlcResetRef = useRef(false);
  const plcPollInFlightRef = useRef(false);
  const plcLayerSampleRef = useRef<{ layer: number; at: number } | null>(null);
  const restoredSessionOrderIdRef = useRef<number | null>(null);
  const restoredRollOrderIdRef = useRef<number | null>(null);
  const colorOrderIdRef = useRef<number | null>(null);

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
  const runSessionSnapshotRef = useRef<CuttingRunSessionSnapshot | null>(null);
  runSessionSnapshotRef.current = {
    savedAt: Date.now(),
    selectedOrderId,
    spreadingStarted,
    mtkRun,
    spreadingRunsByOrder,
  };
  const rollBarcodeInputRef = useRef<HTMLInputElement | null>(null);

  /* ------- Türetilmiş değerler ------- */
  const selectedOrder = orders.find(o => o.id === selectedOrderId) || null;
  const selectedOrderExists = selectedOrder !== null;
  const selectedOrderNo = selectedOrder?.orderNo;
  const selectedOrderQuantity = selectedOrder?.quantity;
  const selectedOrderProductCode = selectedOrder?.productCode;
  const selectedOrderSewingNotes = selectedOrder?.sewingNotes;
  const manualPastalPlan = useMemo(() => parsePastalPlan(selectedOrderSewingNotes), [selectedOrderSewingNotes]);
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
  const totalRollLayers = Object.values(colorLayerEntries).reduce((sum, entry) => sum + entry.layers, 0);
  const totalRollMeters = Array.from(rollTotalsByColor.values()).reduce((s, v) => s + v.pieceCount, 0);
  const countedRollEntries = assignCountedLayers(rollEntries, mtkRun.currentLayer ?? 0);

  /* ====== 10) OFFLINE: fetch wrapper ====== */
  const performFetch = useCallback(
    async (
      url: string,
      options: RequestInit & { label?: string; queueable?: boolean } = {}
    ): Promise<Response | null> => {
      const method = (options.method || 'GET').toUpperCase();
      const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
      const queueable = options.queueable ?? ['PUT', 'PATCH'].includes(method);
      if (!isOnline && isMutation && queueable) {
        const item: OfflineItem = {
          id:
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? (crypto as any).randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          url,
          method,
          body: typeof options.body === 'string' ? options.body : '',
          headers: withoutAuthorization((options.headers as Record<string, string>) || {}),
          createdAt: new Date().toISOString(),
          label: options.label || `${method} ${url}`,
        };
        const q = readOfflineQueue();
        q.push(item);
        writeOfflineQueue(q);
        setQueuedCount(q.length);
        playBeep('warn');
        throw new Error(OFFLINE_QUEUED_MESSAGE);
      }
      if (!isOnline && isMutation && !queueable) {
        throw new Error('Bu işlem çevrimdışıyken güvenli biçimde kuyruğa alınamıyor. Bağlantıyı kontrol edip tekrar deneyin.');
      }
      return fetch(url, options);
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
          headers: { ...withoutAuthorization(item.headers), ...getAuthHeaders() },
          body: item.body,
        });
        if (r.ok) success += 1;
        else if (r.status >= 500) remaining.push(item);
        else setError(`${item.label} sunucu tarafından reddedildi (HTTP ${r.status}).`);
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

  useEffect(() => {
    let active = true;
    const loadOperator = async () => {
      const response = await fetch('/api/auth/me', { headers: getAuthHeaders() });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Operatör bilgisi alınamadı.');
      const user = payload?.user ?? payload;
      if (active) setOperatorName(user?.name?.trim() || user?.email || 'Operatör');
    };
    void loadOperator().catch(error => {
      console.error('Operatör bilgisi alınamadı:', error);
      if (active) setError(error instanceof Error ? error.message : 'Operatör bilgisi alınamadı.');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!sessionRestoreReady) return;
    if (restoredRollOrderIdRef.current === selectedOrder?.id) return;
    if (!selectedOrder) {
      if (selectedOrderId) return;
      setRollEntries([]);
      return;
    }
    try {
      const notes = selectedOrder.sewingNotes ? JSON.parse(selectedOrder.sewingNotes) : {};
      const spreading = notes?.spreading;
      const rolls: RollEntry[] = Array.isArray(spreading?.rolls) ? spreading.rolls : [];
      let nextLayer = 0;
      const normalizedRolls = rolls.map(roll => {
        const startLayer = Number.isInteger(roll.startLayer) ? Number(roll.startLayer) : nextLayer;
        nextLayer = startLayer + Math.max(0, Number(roll.calculatedLayers) || 0);
        return {
          ...roll,
          startLayer,
          meters: roll.meters ?? (roll.pieceCount > 0 ? roll.pieceCount : 0),
        };
      });
      setRollEntries(normalizedRolls);
      restoredRollOrderIdRef.current = selectedOrder.id;
      setSpreadingMode(spreading?.mode === 'spread-then-weight' ? 'spread-then-weight' : 'weight-first');
    } catch (error) {
      console.error('Kayıtlı top/serim verisi okunamadı:', error);
      setRollEntries([]);
      setSpreadingMode('weight-first');
      restoredRollOrderIdRef.current = selectedOrder.id;
    }
  }, [selectedOrder, selectedOrderId, sessionRestoreReady]);

  /* ------- Hook'lar ------- */
  const fetchMtkRun = useCallback(async (orderId: number): Promise<MtkSpreadingRun | null> => {
    const token = getAuthToken();
    const response = await fetch(`/api/spreading-runs?orderId=${orderId}`, {
      cache: 'no-store',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || `PLC serim verisi alınamadı (HTTP ${response.status}).`);
    }
    if (payload && Object.prototype.hasOwnProperty.call(payload, 'data') && payload.data === null) return null;
    const run = payload?.data ?? payload;
    if (!run || !Number.isFinite(Number(run.currentLayer))) {
      throw new Error('Geçerli serim verisi alınamadı.');
    }
    return {
      ...MOCK_SPREADING_RUN,
      ...run,
      id: Number(run.id) || 0,
      currentLayer: Number(run.currentLayer),
      layerSet: run.layerSet == null ? null : Number(run.layerSet),
      machine: run.machine || MOCK_SPREADING_RUN.machine,
      sourceUpdatedAt: run.sourceUpdatedAt || new Date().toISOString(),
    };
  }, []);

  const loadMtkRun = useCallback(async () => {
    if (
      !selectedOrderId ||
      !spreadingStarted ||
      selectedMachine?.layerSource !== 'PLC' ||
      pendingPlcResetRef.current ||
      plcPollInFlightRef.current
    ) return;
    plcPollInFlightRef.current = true;
    try {
      if (!isDemoMode) {
        try {
          const nextRun = await fetchMtkRun(selectedOrderId);
          if (!nextRun || selectedOrderIdRef.current !== selectedOrderId) return;
          const now = Date.now();
          const previousSample = plcLayerSampleRef.current;
          if (previousSample && isPlcCounterReset(previousSample, Number(nextRun.currentLayer), now)) {
            const reset = {
              previousLayer: previousSample.layer,
              currentLayer: Number(nextRun.currentLayer),
              observedAt: now,
            };
            pendingPlcResetRef.current = true;
            setPendingPlcReset(reset);
            setManualResetLayer(String(previousSample.layer));
            setSpreadingPanelOpen(true);
            setError(`PLC sayacı ${previousSample.layer} → ${reset.currentLayer} kat düştü. Devam etmeden önce onaylayın.`);
            return;
          }
          plcLayerSampleRef.current = { layer: Number(nextRun.currentLayer), at: now };
          setMtkRun(nextRun);
          setSpreadingRunsByOrder(runs => ({ ...runs, [selectedOrderId]: nextRun }));
          setMtkError(null);
        } catch (e) {
          const message = e instanceof Error ? e.message : 'PLC serim verisi alınamadı.';
          console.error('PLC serim verisi alınamadı:', e);
          setMtkError(message);
          setError(message);
        }
        return;
      }
      await new Promise(r => window.setTimeout(r, 150));
      if (selectedOrderIdRef.current !== selectedOrderId) return;
      setMtkRun(prev => {
        const nextLayer = Math.min((prev.currentLayer || 0) + 1, prev.layerSet || 120);
        plcLayerSampleRef.current = { layer: nextLayer, at: Date.now() };
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
    } finally {
      plcPollInFlightRef.current = false;
    }
  }, [fetchMtkRun, isDemoMode, selectedMachine?.layerSource, selectedOrderId, spreadingStarted]);

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
      setSpreadingMachines(
        Array.isArray(d.data)
          ? d.data.map((machine: SpreadingMachine) => ({
              ...machine,
              layerSource: machine.layerSource === 'PLC' ? 'PLC' : 'MANUAL',
            }))
          : []
      );
    } catch (e) {
      console.error(e);
      setMtkError('Serim makineleri yüklenemedi.');
    }
  };

  const loadOrders = async (showNotifications = false): Promise<CuttingOrder[]> => {
    try {
      const token = getAuthToken();
      const r = await fetch(
        '/api/fason/work-orders?limit=100&processType=KESIM&excludeProcessStatus=TESLIM_EDILDI',
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
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
    try {
      const raw = window.localStorage.getItem(CUTTING_SESSION_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        window.localStorage.removeItem(CUTTING_SESSION_KEY);
        return;
      }
      const snapshot = parsed as Partial<CuttingSessionSnapshot>;
      if (
        typeof snapshot.savedAt !== 'number' ||
        Date.now() - snapshot.savedAt > CUTTING_SESSION_MAX_AGE_MS ||
        snapshot.savedAt > Date.now() + 60_000
      ) {
        window.localStorage.removeItem(CUTTING_SESSION_KEY);
        window.localStorage.removeItem(CUTTING_RUN_SESSION_KEY);
        return;
      }

      const orderId = typeof snapshot.selectedOrderId === 'number' ? snapshot.selectedOrderId : null;
      const runRaw = window.localStorage.getItem(CUTTING_RUN_SESSION_KEY);
      let runSnapshot: Partial<CuttingRunSessionSnapshot> | null = null;
      if (runRaw) {
        const runParsed: unknown = JSON.parse(runRaw);
        if (runParsed && typeof runParsed === 'object') {
          const candidate = runParsed as Partial<CuttingRunSessionSnapshot>;
          if (
            typeof candidate.savedAt === 'number' &&
            Date.now() - candidate.savedAt <= CUTTING_SESSION_MAX_AGE_MS &&
            candidate.savedAt <= Date.now() + 60_000 &&
            candidate.selectedOrderId === orderId
          ) {
            runSnapshot = candidate;
          } else {
            window.localStorage.removeItem(CUTTING_RUN_SESSION_KEY);
          }
        }
      }
      if (orderId) colorOrderIdRef.current = orderId;
      if (orderId && runSnapshot?.spreadingStarted) {
        restoredSessionOrderIdRef.current = orderId;
      }
      if (orderId && Array.isArray(snapshot.rollEntries)) restoredRollOrderIdRef.current = orderId;
      setSelectedOrderId(orderId);
      setActiveColor(typeof snapshot.activeColor === 'string' ? snapshot.activeColor : '');
      if (Array.isArray(snapshot.rollEntries)) setRollEntries(snapshot.rollEntries);
      if (snapshot.plcStartLayers && typeof snapshot.plcStartLayers === 'object') {
        setPlcStartLayers(snapshot.plcStartLayers);
      }
      if (Array.isArray(snapshot.photos)) setPhotos(snapshot.photos);
      if (typeof snapshot.signatureDataUrl === 'string' || snapshot.signatureDataUrl === null) {
        setSignatureDataUrl(snapshot.signatureDataUrl);
      }
      if (typeof runSnapshot?.spreadingStarted === 'boolean') setSpreadingStarted(runSnapshot.spreadingStarted);
      if (runSnapshot?.mtkRun && typeof runSnapshot.mtkRun === 'object') setMtkRun(runSnapshot.mtkRun);
      if (runSnapshot?.spreadingRunsByOrder && typeof runSnapshot.spreadingRunsByOrder === 'object') {
        setSpreadingRunsByOrder(runSnapshot.spreadingRunsByOrder);
      }
      if (typeof snapshot.selectedMachineId === 'number' || snapshot.selectedMachineId === null) {
        setSelectedMachineId(snapshot.selectedMachineId);
      }
      if (snapshot.spreadingMode === 'weight-first' || snapshot.spreadingMode === 'spread-then-weight') {
        setSpreadingMode(snapshot.spreadingMode);
      }
      if (snapshot.colorLayerEntries && typeof snapshot.colorLayerEntries === 'object') {
        setColorLayerEntries(snapshot.colorLayerEntries);
      }
      if (Number.isInteger(snapshot.lastKnownCounter) && Number(snapshot.lastKnownCounter) >= 0) {
        setLastKnownCounter(Number(snapshot.lastKnownCounter));
      }
      if (orderId && Number.isFinite(Number(runSnapshot?.mtkRun?.currentLayer))) {
        plcLayerSampleRef.current = { layer: Number(runSnapshot?.mtkRun?.currentLayer), at: Date.now() };
      }
      setInfoMessage('Kesim oturumu geri yüklendi.');
    } catch (restoreError) {
      console.error('Kesim oturumu geri yüklenemedi:', restoreError);
      setError('Kesim oturumu geri yüklenemedi; kayıtlı iş emri verileri korunuyor.');
    } finally {
      setSessionRestoreReady(true);
    }
  }, []);

  useEffect(() => {
    if (!sessionRestoreReady) return;
    const snapshot: CuttingSessionSnapshot = {
      savedAt: Date.now(),
      selectedOrderId,
      activeColor,
      rollEntries,
      plcStartLayers,
      photos,
      signatureDataUrl,
      selectedMachineId,
      spreadingMode,
      colorLayerEntries,
      lastKnownCounter,
    };
    try {
      window.localStorage.setItem(CUTTING_SESSION_KEY, JSON.stringify(snapshot));
    } catch (storageError) {
      console.error('Kesim oturumu kaydedilemedi:', storageError);
      setError('Oturum bilgisi tarayıcıya kaydedilemedi; depolama alanını kontrol edin.');
    }
  }, [
    sessionRestoreReady,
    selectedOrderId,
    activeColor,
    rollEntries,
    plcStartLayers,
    photos,
    signatureDataUrl,
    selectedMachineId,
    spreadingMode,
    colorLayerEntries,
    lastKnownCounter,
  ]);

  useEffect(() => {
    if (!sessionRestoreReady) return;
    const timer = window.setInterval(() => {
      const snapshot = runSessionSnapshotRef.current;
      if (!snapshot) return;
      if (!snapshot.selectedOrderId && !snapshot.spreadingStarted) {
        window.localStorage.removeItem(CUTTING_RUN_SESSION_KEY);
        return;
      }
      try {
        window.localStorage.setItem(CUTTING_RUN_SESSION_KEY, JSON.stringify(snapshot));
      } catch (storageError) {
        console.error('Serim oturumu kaydedilemedi:', storageError);
        setError('Serim durumu tarayıcıya kaydedilemedi; yenilemede sayaç kaybolabilir.');
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sessionRestoreReady]);

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
    if (!sessionRestoreReady) return;
    loadMtkRun();
    const t = window.setInterval(loadMtkRun, isDemoMode ? 10000 : 500);
    return () => window.clearInterval(t);
  }, [isDemoMode, loadMtkRun, sessionRestoreReady]);

  useEffect(() => {
    if (!sessionRestoreReady) return;
    if (!selectedOrder) {
      if (selectedOrderId) return;
      colorOrderIdRef.current = null;
      setActiveColor('');
      return;
    }
    const variants =
      manualPastalPlan?.colors.length
        ? manualPastalPlan.colors.map(item => item.color)
        : selectedOrder.colorVariants && selectedOrder.colorVariants.length > 0
        ? selectedOrder.colorVariants
        : selectedOrder.productColor
        ? [selectedOrder.productColor]
        : [];
    const orderChanged = colorOrderIdRef.current !== selectedOrderId;
    if (orderChanged) {
      setPlcStartLayers({});
      setPromptedColorTransitions([]);
      setColorLayerEntries({});
      setLastKnownCounter(0);
      setColorCounterDraft('');
      setColorCounterResetChoice(null);
      setShowColorTransition(false);
      setShowPartialColorConfirm(false);
      pendingPlcResetRef.current = false;
      setPendingPlcReset(null);
    }
    if (!orderChanged && activeColor && variants.includes(activeColor)) return;
    colorOrderIdRef.current = selectedOrderId;
    setActiveColor(variants[0] || '');
  }, [activeColor, manualPastalPlan, selectedOrder, selectedOrderId, sessionRestoreReady]);

  useEffect(() => {
    if (!sessionRestoreReady) return;
    if (!selectedOrderId) return;
    const existing = spreadingRunsByOrder[selectedOrderId];
    if (existing) {
      setMtkRun(existing);
      if (restoredSessionOrderIdRef.current !== selectedOrderId) {
        setSpreadingStarted(existing.status !== 'HAZIR');
      }
      plcLayerSampleRef.current = { layer: Number(existing.currentLayer ?? 0), at: Date.now() };
      return;
    }
    if (restoredSessionOrderIdRef.current === selectedOrderId) return;
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
  }, [selectedOrderId, spreadingRunsByOrder, sessionRestoreReady]);

  useEffect(() => {
    if (!sessionRestoreReady) return;
    if (!orders.length) return;
    if (selectedOrderId) return;
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
  }, [orders, selectedOrderId, sessionRestoreReady]);

  useEffect(() => {
    const requestId = ++fabricExitRequestId.current;
    let isMounted = true;

    if (!selectedOrderExists) {
      setDraftReport(defaultCuttingReport);
      setChecklist([]);
      setFabricExitInfo(null);
      setFabricExitDetails(null);
      setFabricExits([]);
      setFabricExitLoading(false);
      setAutoFilledFields(new Set());
      return;
    }

    const parsed = parseSewingNotes(selectedOrderSewingNotes);
    const manualPlan = parsePastalPlan(selectedOrderSewingNotes);
    const autoFilled = new Set<string>();
    const asortiCount = parsed.cuttingReport.asortiCount || '';

    if (!selectedOrderNo?.trim()) {
      if (isMounted && requestId === fabricExitRequestId.current) {
        setDraftReport({
          ...parsed.cuttingReport,
          asortiCount,
          planKat: manualPlan?.plannedLayers
            ? String(manualPlan.plannedLayers)
            : asortiCount
            ? calculatePlanKat(selectedOrderQuantity || 0, asortiCount)
            : parsed.cuttingReport.planKat,
        });
        setChecklist(parsed.checklist);
        setFabricExitInfo(null);
        setFabricExitDetails(null);
        setAutoFilledFields(autoFilled);
      }
      return;
    }

    const effectiveAsortiCount = parsed.cuttingReport.asortiCount || String(DEFAULT_ASSORTI_TOTAL);
    setDraftReport({
      ...parsed.cuttingReport,
      asortiCount: effectiveAsortiCount,
      planKat: manualPlan?.plannedLayers
        ? String(manualPlan.plannedLayers)
        : effectiveAsortiCount
        ? calculatePlanKat(selectedOrderQuantity || 0, effectiveAsortiCount)
        : parsed.cuttingReport.planKat,
    });
    setChecklist(parsed.checklist);
    setFabricExitLoading(true);

    const fetchExitInfo = async () => {
      try {
        const r = await fetch(`/api/fabric-exits?orderNo=${encodeURIComponent(selectedOrderNo.trim())}&aggregate=true`);
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
  }, [
    selectedOrderId,
    selectedOrderExists,
    selectedOrderNo,
    selectedOrderQuantity,
    selectedOrderSewingNotes,
  ]);

  useEffect(() => {
    if (!selectedOrderExists || !selectedOrderProductCode || !productsLoaded) return;
    const fabricInfo = productFabrics.get(selectedOrderProductCode);
    const asortiInfo = productAsortiMap.get(selectedOrderProductCode);
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
    if (
      (Number(gramaje) > 0 || Number(widthCm) > 0) &&
      (weightCalcInputs.gramaje === 0 || weightCalcInputs.widthCm === 0)
    ) {
      setWeightCalcInputs(prev => ({
        gramaje: Number(gramaje) > 0 ? gramaje : prev.gramaje,
        widthCm: Number(widthCm) > 0 ? widthCm : prev.widthCm,
        lengthM: prev.lengthM,
      }));
    }
  }, [
    selectedOrderId,
    selectedOrderExists,
    selectedOrderProductCode,
    productsLoaded,
    productFabrics,
    productAsortiMap,
    weightCalcInputs.gramaje,
    weightCalcInputs.widthCm,
  ]);

  useEffect(() => {
    if (!selectedOrderExists) return;
    const atilanKat = Number(draftReport.atilanKat || 0);
    const quantityFromForm = Number(draftReport.fabricExitQuantity || 0);
    const useRecordedExitQuantities =
      fabricExitInfo?.unit === "mixed" || autoFilledFields.has("fabricExitQuantity");
    const formUnit = draftReport.fabricExitUnit || fabricExitInfo?.unit || "kg";
    const totalCutKg = useRecordedExitQuantities
      ? Number(fabricExitInfo?.quantityKg || 0)
      : formUnit === "kg"
        ? quantityFromForm
        : 0;
    const isGrammageAutoFilled = autoFilledFields.has("fiiliOrtalamaGramaj");
    if (atilanKat > 0 && totalCutKg > 0) {
      const fabricWidthM = Number(draftReport.fiiliOrtalamaKumasEni || 0) / 100;
      const lengthM = fabricExitDetails?.productLengthMeter || Number(mtkRun.pastelMeter || 0);
      if (fabricWidthM > 0 && lengthM > 0) {
        const singleLayerArea = fabricWidthM * lengthM;
        const cg = (totalCutKg * 1000) / (singleLayerArea * atilanKat);
        const rounded = Math.round(cg * 100) / 100;
        setDraftReport(prev => (
          prev.fiiliOrtalamaGramaj && !isGrammageAutoFilled
            ? prev
            : prev.fiiliOrtalamaGramaj === String(rounded)
              ? prev
              : { ...prev, fiiliOrtalamaGramaj: String(rounded) }
        ));
        setAutoFilledFields(prev => (prev.has('fiiliOrtalamaGramaj') ? prev : new Set([...prev, 'fiiliOrtalamaGramaj'])));
      }
    } else if (!totalCutKg && isGrammageAutoFilled) {
      setDraftReport(prev => prev.fiiliOrtalamaGramaj ? { ...prev, fiiliOrtalamaGramaj: '' } : prev);
      setAutoFilledFields(prev => {
        const next = new Set(prev);
        next.delete('fiiliOrtalamaGramaj');
        return next;
      });
    }
  }, [
    selectedOrderId,
    selectedOrderExists,
    draftReport.atilanKat,
    draftReport.fabricExitQuantity,
    draftReport.fabricExitUnit,
    draftReport.fiiliOrtalamaGramaj,
    fabricExitInfo,
    fabricExitDetails,
    draftReport.fiiliOrtalamaKumasEni,
    mtkRun.pastelMeter,
    autoFilledFields,
  ]);

  useEffect(() => {
    if (!selectedOrderExists || !selectedOrderProductCode || !productAsortiMap.size) return;
    const saved = parseSewingNotes(selectedOrderSewingNotes).cuttingReport.asortiCount;
    if (saved) return;
    const def = productAsortiMap.get(selectedOrderProductCode);
    if (!def) return;
    const cur = Number(draftReport.asortiCount || 0);
    if (cur === DEFAULT_ASSORTI_TOTAL && def.defaultAsortiCount !== DEFAULT_ASSORTI_TOTAL) {
      const na = String(def.defaultAsortiCount);
      setDraftReport(prev => ({
        ...prev,
        asortiCount: na,
        planKat: calculatePlanKat(selectedOrderQuantity || 0, na),
      }));
    }
  }, [
    selectedOrderId,
    selectedOrderExists,
    selectedOrderProductCode,
    selectedOrderQuantity,
    selectedOrderSewingNotes,
    productAsortiMap,
    draftReport.asortiCount,
  ]);

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
  }, [selectedOrder, productAsortiMap]);

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

  const handleStartSpreading = async () => {
    if (!selectedOrder || !selectedMachine) {
      setError('Serimi başlatmak için iş emri ve serim makinesi seçin.');
      return;
    }
    setError(null);
    setMtkError(null);
    let runAtStart = mtkRun;
    if (!isDemoMode) {
      try {
        const activeRun = await fetchMtkRun(selectedOrder.id);
        if (activeRun) {
          if (activeRun.machineId && activeRun.machineId !== selectedMachine.id) {
            throw new Error(`Bu iş emri ${activeRun.machine} makinesinde aktif. Aynı anda başka makinede başlatılamaz.`);
          }
          runAtStart = activeRun;
        } else {
          const response = await fetch('/api/spreading-runs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({
              orderId: selectedOrder.id,
              machine: selectedMachine.name,
              machineId: selectedMachine.id,
              cuttingTableId: selectedMachine.cuttingTable.id,
              source: 'MANUAL',
            }),
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok || !payload?.data) {
            throw new Error(payload?.error || 'Manuel serim kaydı başlatılamadı.');
          }
          runAtStart = payload.data as MtkSpreadingRun;
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Serim kaydı başlatılamadı.';
        console.error('Serim kaydı başlatılamadı:', e);
        setMtkError(message);
        setError(message);
        return;
      }
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
    const currentLayerAtStart = Number(runAtStart.currentLayer ?? 0);
    setPlcStartLayers(previous =>
      Object.prototype.hasOwnProperty.call(previous, activeColor)
        ? previous
        : { ...previous, [activeColor]: currentLayerAtStart }
    );
    plcLayerSampleRef.current = { layer: currentLayerAtStart, at: Date.now() };
    const firstRollAtStart = rollEntries.map((roll, index) =>
      index === 0 && roll.startLayer == null
        ? { ...roll, startLayer: currentLayerAtStart }
        : roll
    );
    if (firstRollAtStart !== rollEntries) {
      syncRollEntriesToSpreading(firstRollAtStart);
    }
    setSpreadingStarted(true);
    setSpreadingPanelOpen(true);
    setTelemetry([]);
    const startedRun = {
      ...runAtStart,
      machine: runAtStart.machine || selectedMachine.name,
      machineId: runAtStart.machineId ?? selectedMachine.id,
      cuttingTableId: runAtStart.cuttingTableId ?? selectedMachine.cuttingTable.id,
      status: runAtStart.status === 'HAZIR' ? 'SERİM DEVAM EDİYOR' : runAtStart.status,
      source: selectedMachine.layerSource === 'PLC' ? runAtStart.source || 'MANUAL' : 'MANUAL',
      sourceUpdatedAt: new Date().toISOString(),
    };
    setMtkRun(startedRun);
    setSpreadingRunsByOrder(runs => ({ ...runs, [selectedOrder.id]: startedRun }));
    playBeep('ok');
    setInfoMessage(
      `Serim başlatıldı. Başlangıç katı ${currentLayerAtStart}; ${selectedMachine.name} / ${selectedMachine.cuttingTable.name}.`
    );
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

  const syncRollEntriesToSpreading = (nextRollEntries: RollEntry[]) => {
    setRollEntries(nextRollEntries);
    setSpreadingLayers(rollEntriesToSpreadingLayers(nextRollEntries));
  };

  const handleReadScaleForSpreading = async () => {
    if (showColorTransition || showPartialColorConfirm || pendingPlcReset) {
      setError('Renk geçişi veya sayaç reseti onaylanana kadar top eklenemez.');
      return;
    }
    if (spreadingMode !== 'weight-first') {
      setError('Bu işlem sadece Tartı → Serim modunda çalışır.');
      return;
    }
    if (!selectedOrder) {
      setError('Önce bir iş emri seçin.');
      return;
    }
    let reading: ScaleReading | null = null;
    if (bridgeConnected) {
      try {
        reading = await bridgeReadWeight();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Bridge tartısından veri alınamadı.');
        return;
      }
    } else if (scalePort) reading = await readScaleWeight(scalePort);
    else {
      const unused = scaleReadings.find(e => !e.usedFor && e.reading.weight > 0);
      if (unused) reading = unused.reading;
      else if (scaleReading) reading = scaleReading;
      else if (isDemoMode) {
        const mock = [28.5, 30.0, 32.4, 27.8, 35.2, 29.7];
        const w = mock[Math.floor(Math.random() * mock.length)];
        reading = { weight: w, unit: 'kg', stable: true, raw: `${w.toFixed(2)} kg` };
      } else {
        setError('Canlı tartıdan veri alınamadı. Tartıyı bağlayın veya kg değerini manuel girin.');
        return;
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
    const color = activeColor || selectedOrder.productColor || 'Renk bekleniyor';
    const nextRollNumber = rollEntries.filter(r => (r.color || '') === color).length + 1;
    const roll: RollEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      color,
      rollNumber: nextRollNumber,
      weightKg: reading.weight,
      calculatedLayers: 0,
      pieceCount: 0,
      createdAt: new Date().toISOString(),
      startLayer: Number(mtkRun.currentLayer ?? 0),
    };
    syncRollEntriesToSpreading([...rollEntries, roll]);
    playBeep('ok');
    setInfoMessage(`Tartıdan alındı: ${reading.weight.toFixed(3)} kg. Kat sayısı renk bitiminde girilecek.`);
  };

  const handleAddRollManual = (weightKg: number) => {
    if (showColorTransition || showPartialColorConfirm || pendingPlcReset) {
      setError('Renk geçişi veya sayaç reseti onaylanana kadar top eklenemez.');
      return;
    }
    if (!selectedOrder || spreadingCompleted) return;
    if (!Number.isFinite(weightKg) || weightKg <= 0) {
      setError('Top ağırlığı sıfırdan büyük ve geçerli bir sayı olmalıdır.');
      return;
    }
    const color = activeColor || selectedOrder.productColor || 'Renk bekleniyor';
    const nextRollNumber = rollEntries.filter(r => (r.color || '') === color).length + 1;
    const roll: RollEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      color,
      rollNumber: nextRollNumber,
      weightKg,
      calculatedLayers: 0,
      pieceCount: 0,
      createdAt: new Date().toISOString(),
      startLayer: Number(mtkRun.currentLayer ?? 0),
    };
    syncRollEntriesToSpreading([...rollEntries, roll]);
    playBeep('ok');
  };

  const handleAddRollByMeter = (lengthM: number) => {
    if (showColorTransition || showPartialColorConfirm || pendingPlcReset) {
      setError('Renk geçişi veya sayaç reseti onaylanana kadar top eklenemez.');
      return;
    }
    if (!selectedOrder || spreadingCompleted) return;
    if (!Number.isFinite(lengthM) || lengthM <= 0) {
      setError('Top uzunluğu sıfırdan büyük ve geçerli bir sayı olmalıdır.');
      return;
    }
    const fabricInfo = productFabrics.get(selectedOrder.productCode);
    const asortiInfo = productAsortiMap.get(selectedOrder.productCode);
    const gramaje =
      Number(weightCalcInputs.gramaje) > 0
        ? weightCalcInputs.gramaje
        : fabricInfo?.productAverageGrammage ?? fabricInfo?.averageGrammage ?? 0;
    const widthCm =
      Number(weightCalcInputs.widthCm) > 0 ? weightCalcInputs.widthCm : asortiInfo?.fabricWidth ?? fabricInfo?.width ?? 0;
    if (![lengthM, widthCm, gramaje].every(value => Number.isFinite(value) && value > 0)) {
      setError('Metre ile top eklemek için top boyu, kumaş eni ve gramaj bilgileri gereklidir.');
      return;
    }
    const totalWeightKg = (widthCm / 100 * lengthM * gramaje) / 1000;
    const color = activeColor || selectedOrder.productColor || 'Renk bekleniyor';
    const nextRollNumber = rollEntries.filter(r => (r.color || '') === color).length + 1;
    const roll: RollEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      color,
      rollNumber: nextRollNumber,
      weightKg: totalWeightKg,
      calculatedLayers: 0,
      pieceCount: 0,
      createdAt: new Date().toISOString(),
      startLayer: Number(mtkRun.currentLayer ?? 0),
      meters: lengthM,
    };
    syncRollEntriesToSpreading([...rollEntries, roll]);
    playBeep('ok');
    setInfoMessage(`Top eklendi: ${lengthM.toFixed(1)} m · ${totalWeightKg.toFixed(2)} kg`);
  };

  // 2) Top barkod ile ekleme
  const handleRollBarcodeSubmit = () => {
    const raw = rollBarcodeInput.trim();
    if (!raw) return;
    if (showColorTransition || showPartialColorConfirm || pendingPlcReset) {
      setError('Renk geçişi veya sayaç reseti onaylanana kadar top eklenemez.');
      return;
    }
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

  const handleRemoveRollEntry = (id: string) =>
    syncRollEntriesToSpreading(rollEntries.filter(entry => entry.id !== id));
  const handleClearRollEntries = () => syncRollEntriesToSpreading([]);
  const handleWeightCalcInputChange = (f: keyof WeightCalcInputs, v: string) =>
    setWeightCalcInputs(prev => ({ ...prev, [f]: Number(v) || 0 }));
  const handleSizeCountChange = (size: string, v: string) =>
    setSizeCounts(prev => ({ ...prev, [size]: Math.max(0, Number(v) || 0) }));
  const appendQuickNote = (note: string) =>
    setDraftReport(prev => ({ ...prev, aciklama: prev.aciklama ? `${prev.aciklama.trim()} · ${note}` : note }));

  const handleConnectScale = async () => {
    setScaleConnecting(true);
    setError(null);
    try {
      let bridgeError: string | null = null;
      if (hasLocalBridge()) {
        try {
          await bridgeConnectScale(readScaleSettings());
          setBridgeConnected(true);
          setScalePort(null);
          setScaleReading(null);
          playBeep('ok');
          setInfoMessage('Tartı yerel bridge üzerinden bağlandı');
          return;
        } catch (e) {
          bridgeError = e instanceof Error ? e.message : 'Yerel bridge bağlantısı kurulamadı.';
          console.warn('Bridge bağlantısı başarısız; Web Serial deneniyor:', bridgeError);
        }
      }
      const p = await connectScale(9600, m => setError(m));
      setScalePort(p);
      if (p) {
        playBeep('ok');
        setInfoMessage(bridgeError ? 'Bridge kullanılamadı; tartı Web Serial ile bağlandı' : 'Tartı bağlandı');
        setScaleReading(null);
      } else if (bridgeError) {
        setError(`${bridgeError} Web Serial ile de bağlanılamadı.`);
      }
    } finally {
      setScaleConnecting(false);
    }
  };

  const handleReadScale = async () => {
    let reading: ScaleReading | null = null;
    if (bridgeConnected) {
      try {
        reading = await bridgeReadWeight();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Bridge tartısından veri alınamadı.');
        return;
      }
    } else if (scalePort) reading = await readScaleWeight(scalePort);
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
    try {
      if (bridgeConnected) await bridgeDisconnectScale();
      if (scalePort) {
        await scalePort.close();
      }
      setBridgeConnected(false);
      setScalePort(null);
      setScaleReading(null);
      setInfoMessage('Tartı bağlantısı kesildi');
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Tartı bağlantısı kesilemedi.');
    }
  };

  const handleInputChange = (field: keyof CuttingReportData, value: string) => {
    if (field === "fabricExitQuantity") {
      setAutoFilledFields(prev => {
        const next = new Set(prev);
        next.delete(field);
        return next;
      });
    }
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
        color: activeColor || selectedOrder.productColor || '',
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
      const colorForReason = defectiveColorVariant || activeColor;
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
    else u[i] = { ...it, checkedBy: operatorName, checkedAt: new Date().toLocaleString('tr-TR') };
    setChecklist(u);
  };

  const handleSavePastalPlan = async (plan: PastalPlan) => {
    if (!selectedOrder) return;
    setPastalPlanSaving(true);
    setError(null);
    const sewingNotes = mergePastalPlan(selectedOrder.sewingNotes, plan);
    const applyPlan = (queuedOffline: boolean, notes = sewingNotes) => {
      setOrders(previous => previous.map(order =>
        order.id === selectedOrder.id ? { ...order, sewingNotes: notes } : order
      ));
      setDraftReport(previous => ({ ...previous, planKat: String(plan.plannedLayers) }));
      setPastalPlanOpen(false);
      setInfoMessage(queuedOffline ? 'Pastal planı çevrimdışı sıraya alındı.' : 'Pastal planı kaydedildi.');
    };
    try {
      const token = getAuthToken();
      let response: Response | null;
      try {
        response = await performFetch(`/api/fason/work-orders/${selectedOrder.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ sewingNotes }),
          label: `Pastal planı kaydet: ${selectedOrder.orderNo}`,
        });
      } catch (e) {
        if (e instanceof Error && e.message === OFFLINE_QUEUED_MESSAGE) {
          applyPlan(true);
          return;
        }
        throw e;
      }
      if (!response) throw new Error('Pastal planı kaydedilemedi; sunucudan yanıt alınamadı.');
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Pastal planı kaydedilemedi.');
      }
      const updated = await response.json();
      applyPlan(false, typeof updated.sewingNotes === 'string' ? updated.sewingNotes : sewingNotes);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Pastal planı kaydedilemedi.');
    } finally {
      setPastalPlanSaving(false);
    }
  };

  const handleResolvePlcReset = async (requestedLayer?: number) => {
    if (!selectedOrder || !pendingPlcReset) return;
    const correctedLayer = requestedLayer ?? Number(manualResetLayer);
    if (!Number.isInteger(correctedLayer) || correctedLayer < 0) {
      setError('Yeni kat sayısı sıfır veya pozitif bir tam sayı olmalıdır.');
      return;
    }
    setSavingOrderId(selectedOrder.id);
    try {
      let updatedRun: MtkSpreadingRun;
      if (isDemoMode) {
        updatedRun = {
          ...mtkRun,
          currentLayer: correctedLayer,
          sourceUpdatedAt: new Date().toISOString(),
        };
      } else {
        const response = await fetch('/api/spreading-runs', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({
            orderId: selectedOrder.id,
            action: 'set',
            value: correctedLayer,
            reason: `PLC sayaç reseti onayı; önceki=${pendingPlcReset.previousLayer}, okunan=${pendingPlcReset.currentLayer}`,
          }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.data) {
          throw new Error(payload?.error || 'PLC sayaç düzeltmesi kaydedilemedi.');
        }
        updatedRun = { ...mtkRun, ...payload.data };
      }
      const nextRun = { ...updatedRun, currentLayer: correctedLayer };
      setMtkRun(nextRun);
      setSpreadingRunsByOrder(previous => ({ ...previous, [selectedOrder.id]: nextRun }));
      setPlcStartLayers(previous => ({ ...previous, [activeColor]: correctedLayer }));
      plcLayerSampleRef.current = { layer: correctedLayer, at: Date.now() };
      pendingPlcResetRef.current = false;
      setPendingPlcReset(null);
      setSpreadingStarted(true);
      setError(null);
      setInfoMessage(`PLC sayacı ${correctedLayer} kat olarak onaylandı; ${activeColor} için yeni sayaç bazı kaydedildi.`);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'PLC sayaç reseti onaylanamadı.');
    } finally {
      setSavingOrderId(null);
    }
  };

  const handleColorCompletion = async () => {
    if (!selectedOrder || !activeColorPlan) return;
    let actualLayers = activeColorActualLayers;
    let rawCounterValue = currentPlcLayer;
    let counterStartValue = activeColorStartLayer;
    let hadCounterReset = false;
    if (isManualLayerSource) {
      const resolution = resolveManualColorCounter(
        manualCounterValue,
        lastKnownCounter,
        colorCounterResetChoice,
      );
      if (resolution.kind === 'confirm-reset') {
        setError('Sayaç değeri önceki renk sonuna eşit veya düşük. Önce sayacın sıfırlanıp sıfırlanmadığını onaylayın.');
        return;
      }
      if (resolution.kind === 'zero-layers') {
        setError('Bu renk için hesaplanan kat 0. Sayaç değerini düzeltin veya sıfırlanma seçimini değiştirin.');
        return;
      }
      if (resolution.kind === 'invalid') {
        setError('Renk bitişi için makine sayacına pozitif bir tam sayı girin.');
        return;
      }
      actualLayers = resolution.layers;
      rawCounterValue = manualCounterValue;
      counterStartValue = resolution.counterStartLayer;
      hadCounterReset = resolution.hadCounterReset;
    }
    const missingLayers = Math.max(0, activeColorPlan.layers - actualLayers);
    const event: PastalPlanEvent = {
      type: 'color-completed',
      color: activeColor,
      actualLayers,
      targetLayers: activeColorPlan.layers,
      missingLayers,
      operator: operatorName,
      at: new Date().toISOString(),
      rawCounterValue,
      counterStartValue,
      hadCounterReset,
    };
    const entry: ColorLayerEntry = {
      color: activeColor,
      layers: actualLayers,
      rawCounterValue,
      counterStartValue,
      source: isManualLayerSource ? 'manual' : 'plc',
      enteredAt: event.at,
      enteredBy: operatorName,
      hadCounterReset,
    };
    setColorDecisionSaving(true);
    try {
      const sewingNotes = appendPastalPlanEvent(selectedOrder.sewingNotes, event);
      const token = getAuthToken();
      let response: Response | null;
      try {
        response = await performFetch(`/api/fason/work-orders/${selectedOrder.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ sewingNotes }),
          label: `Renk tamamlandı: ${selectedOrder.orderNo} / ${activeColor}`,
        });
      } catch (e) {
        if (!(e instanceof Error) || e.message !== OFFLINE_QUEUED_MESSAGE) throw e;
        response = null;
      }
      let savedNotes = sewingNotes;
      if (response) {
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || 'Renk tamamlama kaydı kaydedilemedi.');
        }
        const payload = await response.json();
        if (typeof payload.sewingNotes === 'string') savedNotes = payload.sewingNotes;
      }
      setOrders(previous => previous.map(order =>
        order.id === selectedOrder.id ? { ...order, sewingNotes: savedNotes } : order
      ));
      setColorLayerEntries(previous => ({ ...previous, [activeColor]: entry }));
      if (isManualLayerSource) setLastKnownCounter(rawCounterValue);
      setPromptedColorTransitions(previous =>
        previous.includes(activeColor) ? previous : [...previous, activeColor]
      );
      setShowPartialColorConfirm(false);
      setShowColorTransition(false);

      if (nextPlannedColor) {
        if (!isManualLayerSource) {
          setPlcStartLayers(previous => ({ ...previous, [nextPlannedColor]: currentPlcLayer }));
        }
        setActiveColor(nextPlannedColor);
        setInfoMessage(
          `${activeColor} ${actualLayers}/${activeColorPlan.layers} kat olarak kaydedildi. ${nextPlannedColor} rengine geçiliyor.`
        );
      } else {
        setShowSpreadingConfirm(true);
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Renk geçişi kaydedilemedi.');
    } finally {
      setColorDecisionSaving(false);
    }
  };

  const handleReopenColor = async (color: string) => {
    if (!selectedOrder || colorDecisionSaving) return;
    const colorIndex = activePastalPlan.colors.findIndex(item => item.color === color);
    if (colorIndex < 0 || !colorLayerEntries[color]) return;
    const invalidatedColors = activePastalPlan.colors.slice(colorIndex).map(item => item.color);
    const previousColor = activePastalPlan.colors[colorIndex - 1]?.color;
    const previousCounter = previousColor ? colorLayerEntries[previousColor]?.rawCounterValue ?? 0 : 0;
    const event: PastalPlanEvent = {
      type: 'color-reopened',
      color,
      operator: operatorName,
      at: new Date().toISOString(),
      rawCounterValue: colorLayerEntries[color].rawCounterValue,
      counterStartValue: colorLayerEntries[color].counterStartValue,
      hadCounterReset: colorLayerEntries[color].hadCounterReset,
    };

    setColorDecisionSaving(true);
    try {
      const sewingNotes = appendPastalPlanEvent(selectedOrder.sewingNotes, event);
      const token = getAuthToken();
      let response: Response | null;
      try {
        response = await performFetch(`/api/fason/work-orders/${selectedOrder.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ sewingNotes }),
          label: `Renk yeniden açıldı: ${selectedOrder.orderNo} / ${color}`,
        });
      } catch (error) {
        if (!(error instanceof Error) || error.message !== OFFLINE_QUEUED_MESSAGE) throw error;
        response = null;
      }
      let savedNotes = sewingNotes;
      if (response) {
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || 'Renk yeniden açma kaydı kaydedilemedi.');
        }
        const payload = await response.json();
        if (typeof payload.sewingNotes === 'string') savedNotes = payload.sewingNotes;
      }
      setOrders(previous => previous.map(order =>
        order.id === selectedOrder.id ? { ...order, sewingNotes: savedNotes } : order
      ));
      setColorLayerEntries(previous => {
        const next = { ...previous };
        invalidatedColors.forEach(item => delete next[item]);
        return next;
      });
      setPlcStartLayers(previous => {
        const next = { ...previous };
        invalidatedColors.forEach(item => delete next[item]);
        if (selectedMachine?.layerSource === 'PLC') next[color] = currentPlcLayer;
        return next;
      });
      setLastKnownCounter(previousCounter);
      setActiveColor(color);
      setShowColorTransition(false);
      setShowPartialColorConfirm(false);
      setPromptedColorTransitions(previous => previous.filter(item => !invalidatedColors.includes(item)));
      playBeep('warn');
      setInfoMessage(`${color} ve sonraki tamamlanmış renkler yeniden açıldı.`);
    } catch (error) {
      console.error('Renk yeniden açılamadı:', error);
      setError(error instanceof Error ? error.message : 'Renk yeniden açılamadı.');
    } finally {
      setColorDecisionSaving(false);
    }
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
          rolls: countedRollEntries,
          colorLayerEntries,
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
    if (pendingManualLayers > 0) {
      setError('Bekleyen manuel kat sayıları sunucuya kaydedilmeden serim tamamlanamaz.');
      setShowSpreadingConfirm(false);
      return;
    }
    if (
      selectedMachine?.layerSource === 'MANUAL' &&
      activePastalPlan.colors.some(plan => !colorLayerEntries[plan.color])
    ) {
      setError('Serimi tamamlamadan önce tüm renkler için sayaç bitiş değerini kaydedin.');
      setShowSpreadingConfirm(false);
      return;
    }
    setShowSpreadingConfirm(false);
    const layerCount = selectedMachine?.layerSource === 'MANUAL'
      ? Object.values(colorLayerEntries).reduce((sum, entry) => sum + entry.layers, 0)
      : mtkRun.currentLayer ?? 0;
    const spreadLengthM = Number(mtkRun.pastelMeter ?? 0);
    const totalSpreadMeters = spreadLengthM > 0 && layerCount > 0 ? spreadLengthM * layerCount : 0;
    const hasKilogramExit = fabricExitInfo?.unit === 'kg' || draftReport.fabricExitUnit === 'kg';
    const canUseMeterExit =
      totalSpreadMeters > 0 &&
      !hasKilogramExit &&
      fabricExitInfo?.unit !== 'mixed';
    const spreadingReport: CuttingReportData = {
      ...draftReport,
      planKat: String(activePastalPlan.plannedLayers || mtkRun.layerSet || layerCount),
      atilanKat: String(layerCount),
      fiiliOrtalamaKumasEni: mtkRun.widthCm === null ? draftReport.fiiliOrtalamaKumasEni : String(mtkRun.widthCm),
      fabricExitQuantity: canUseMeterExit ? String(totalSpreadMeters) : draftReport.fabricExitQuantity,
      fabricExitUnit: canUseMeterExit ? 'm' : draftReport.fabricExitUnit || fabricExitInfo?.unit || '',
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
          rolls: countedRollEntries,
          colorLayerEntries,
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
      let completedRun = mtkRun;
      if (!isDemoMode) {
        const completeResponse = await fetch('/api/spreading-runs', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ orderId: selectedOrder.id, action: 'complete' }),
        });
        const completePayload = await completeResponse.json().catch(() => null);
        if (!completeResponse.ok || !completePayload?.data) {
          throw new Error(completePayload?.error || 'Serim kaydı sunucuda kapatılamadı.');
        }
        completedRun = { ...mtkRun, ...completePayload.data };
      } else {
        completedRun = {
          ...mtkRun,
          status: 'SERİM TAMAMLANDI',
          sourceUpdatedAt: new Date().toISOString(),
        };
      }
      setDraftReport(spreadingReport);
      setMtkRun(completedRun);
      setSpreadingRunsByOrder(prev => ({
        ...prev,
        [selectedOrder.id]: completedRun,
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
    if (pendingManualLayers > 0) {
      setError('Bekleyen manuel kat sayıları sunucuya kaydedilmeden serim tamamlanamaz.');
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

  /**
   * Kesimi tamamlar.
   * ÖNEMLİ: İş emrinin kendisi KAPATILMAZ (status gönderilmez).
   * Yalnızca KESIM aşamasının tracking kaydı teslim alınır; iş emri bir sonraki
   * aşamaya (Dikim) hazır olur ve ancak Merkez Depo teslim aldığında kapanır.
   */
  const handleCompleteCutting = async () => {
    if (!selectedOrder || isOperatorLocked) return;
    setShowCompleteConfirm(false);
    setSavingOrderId(selectedOrder.id);
    setError(null);
    try {
      const token = getAuthToken();
      const authHeaders = {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      };
      const kgCut = Number(draftReport.fabricExitQuantity || 0);
      const waste =
        targetGrammage > 0 && actualGrammage > 0 && actualGrammage > targetGrammage
          ? Math.max(0, ((actualGrammage - targetGrammage) / targetGrammage) * kgCut)
          : 0;

      // Aktif kesim aşaması kaydı
      const cuttingTracking = selectedOrder.fasonTrackings.find(
        t => t.processType === 'KESIM' && t.status !== 'TESLIM_EDILDI'
      );
      if (!cuttingTracking) {
        throw new Error('Bu iş emri için aktif kesim kaydı bulunamadı.');
      }

      // 1) Kesim raporunu kaydet — iş emri durumuna DOKUNMA
      const notesRes = await performFetch(`/api/fason/work-orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          sewingNotes: mergeSewingNotes(selectedOrder.sewingNotes, draftReport, checklist, {
            machine: mtkRun.machine,
            cuttingTable: selectedMachine?.cuttingTable.name || 'Tanımsız',
            layers: spreadingLayers.filter(l => l.color.trim()),
            mode: spreadingMode,
            rolls: countedRollEntries,
            colorLayerEntries,
            photos,
            signature: signatureDataUrl,
          }),
        }),
        label: `Kesim raporu: ${selectedOrder.orderNo}`,
      });
      if (notesRes && !notesRes.ok) {
        const b = await notesRes.json().catch(() => null);
        throw new Error(b?.error || 'Kesim raporu kaydedilemedi.');
      }

      // 2) Yalnızca KESIM aşamasını teslim al (iş emri kapanmaz, dikime hazır olur)
      const receiveRes = await performFetch(CUTTING_RECEIVE_URL, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          action: 'receive',
          id: cuttingTracking.id,
          receivedQuantity: selectedOrder.quantity,
          completeWorkOrder: false,
        }),
        label: `Kesim aşaması tamam: ${selectedOrder.orderNo}`,
      });
      if (receiveRes && !receiveRes.ok) {
        const b = await receiveRes.json().catch(() => null);
        throw new Error(b?.error || 'Kesim aşaması tamamlanamadı.');
      }

      // Kesim ekranından kalk (iş emri sistemde AÇIK kalır)
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
      setInfoMessage(`${selectedOrder.orderNo} kesimi tamamlandı, dikim aşamasına hazır.`);
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
      countedRollEntries.forEach(r => {
        const color = r.color || 'Renk bekleniyor';
        if (!seen.has(color)) {
          seen.add(color);
          colorOrder.push(color);
        }
      });
      rollBreakdownHtml =
        colorOrder
          .map(color => {
            const colorRolls = countedRollEntries.filter(r => (r.color || 'Renk bekleniyor') === color);
            const colorTotalKg = colorRolls.reduce((s, r) => s + (Number(r.weightKg) || 0), 0);
            const colorTotalLayers = colorRolls.reduce((s, r) => s + (Number(r.countedLayers) || 0), 0);
            const colorTotalMeters = colorRolls.reduce((s, r) => s + (Number(r.meters ?? r.pieceCount) || 0), 0);
            const lines = colorRolls
              .map(
                r =>
                  `<div style="margin-left:16px;font-family:monospace;font-size:13px">${r.rollNumber}. top ${formatLayNumber(r.weightKg)} kg · tartı ${r.calculatedLayers} kat · sayaç ${r.countedLayers ?? 0} kat${
                    spreadingMode === 'spread-then-weight' ? ` · ${Number(r.meters ?? r.pieceCount).toFixed(1)} m` : ''
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
        `<div style="margin-top:10px;font-weight:700;font-size:13px">toplam ${totalRolls} top · ${formatLayNumber(totalRollWeightKg)} kg · sayaç ${countedRollEntries.reduce((sum, roll) => sum + (Number(roll.countedLayers) || 0), 0)} kat${
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
    selectedOrder && manualPastalPlan
      ? String(manualPastalPlan.plannedLayers)
      : selectedOrder && draftReport.asortiCount
      ? calculatePlanKat(selectedOrder.quantity, draftReport.asortiCount)
      : draftReport.planKat || '—';
  const fiberExitUnitLabel =
    fabricExitInfo?.unit === 'mixed' ? 'kg/m' : fabricExitInfo?.unit || draftReport.fabricExitUnit || 'kg';
  const productFabricInfo = productFabrics.get(selectedOrder?.productCode || '');
  const widthCm = Number(draftReport.fiiliOrtalamaKumasEni || 0);
  const pastelLengthM = Number(fabricExitDetails?.productLengthMeter || mtkRun.pastelMeter || 0);
  const actualGrammage = Number(draftReport.fiiliOrtalamaGramaj || 0);
  const cuttingGrammage =
    actualGrammage ||
    Number(productFabricInfo?.productAverageGrammage || productFabricInfo?.averageGrammage || 0);
  const useRecordedExitQuantities =
    !!fabricExitInfo &&
    (fabricExitInfo.unit === 'mixed' || autoFilledFields.has('fabricExitQuantity'));
  const enteredFabricQuantity = Number(draftReport.fabricExitQuantity || 0);
  const enteredFabricUnit = draftReport.fabricExitUnit || fabricExitInfo?.unit || 'kg';
  const fabricKgForCalculation = useRecordedExitQuantities
    ? Number(fabricExitInfo?.quantityKg || 0)
    : enteredFabricUnit === 'kg' ? enteredFabricQuantity : 0;
  const fabricMetersForCalculation = useRecordedExitQuantities
    ? Number(fabricExitInfo?.quantityM || 0)
    : enteredFabricUnit === 'm' ? enteredFabricQuantity : 0;
  const calculatedOutputPieces = useMemo(() => {
    const layers = Number(draftReport.atilanKat || 0);
    return calculateOutputPieces(layers, currentAsorti);
  }, [draftReport.atilanKat, currentAsorti]);
  const pastalWeightKg = calculatePastalWeightKg(
    widthCm / 100,
    pastelLengthM,
    cuttingGrammage
  );
  const unitGrammage = calculateUnitGrammage(
    fabricKgForCalculation,
    fabricMetersForCalculation,
    widthCm,
    cuttingGrammage,
    calculatedOutputPieces || 0
  );
  const progressPercent = selectedOrder
    ? Math.min(((calculatedOutputPieces || 0) / Math.max(selectedOrder.quantity, 1)) * 100, 100)
    : 0;
  const progressComplete = progressPercent >= 99.5;
  const currentTimeLabel = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const currentSizeDistribution =
    productAsortiMap.get(selectedOrder?.productCode || '')?.sizeChart || DEFAULT_SIZE_DISTRIBUTION;
  const targetGrammage = Number(productFabricInfo?.productAverageGrammage || 0);
  const grammageTargetStatus =
    targetGrammage > 0 && actualGrammage > 0
      ? Math.abs(actualGrammage - targetGrammage) <= targetGrammage * 0.05
        ? 'Hedef tuttu'
        : actualGrammage > targetGrammage
          ? 'Hedef üstü (fire)'
          : 'Hedef altı (düşük gramaj)'
      : 'Hesaplanıyor';
  const grammageOnTarget = grammageTargetStatus === 'Hedef tuttu';
  const isLowGrammage = targetGrammage > 0 && actualGrammage > 0 && actualGrammage < targetGrammage;
  const cuttingWastePercent =
    targetGrammage > 0 && actualGrammage > 0 && actualGrammage > targetGrammage
      ? ((actualGrammage - targetGrammage) / targetGrammage) * 100
      : 0;
  const operatorDisplayName = operatorName;
  const operatorDisplayInitials =
    operatorDisplayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0]?.toUpperCase() || '')
      .join('') || 'S';
  const effectiveColorVariants = useMemo(() => {
    if (manualPastalPlan?.colors.length) return manualPastalPlan.colors.map(item => item.color);
    if (selectedOrder?.colorVariants && selectedOrder.colorVariants.length > 0) return selectedOrder.colorVariants;
    if (selectedOrder?.productColor) return [selectedOrder.productColor];
    return [];
  }, [manualPastalPlan, selectedOrder?.colorVariants, selectedOrder?.productColor]);
  const fallbackPastalPlan = useMemo<PastalPlan>(() => {
    const plannedLayers = Number(draftReport.planKat) || 0;
    const colors = effectiveColorVariants.map(color => ({ color, layers: plannedLayers, weightKg: 0 }));
    return {
      plannedLayers,
      colors,
      source: 'fallback',
      updatedAt: '',
    };
  }, [draftReport.planKat, effectiveColorVariants]);
  const activePastalPlan = manualPastalPlan || fallbackPastalPlan;
  const currentPlcLayer = Number(mtkRun.currentLayer ?? 0);
  const activeColorStartLayer = plcStartLayers[activeColor] ?? currentPlcLayer;
  const activeColorActualLayers = colorLayerEntries[activeColor]?.layers ??
    getActualLayersForColor(currentPlcLayer, activeColorStartLayer);
  const activeColorPlanIndex = activePastalPlan.colors.findIndex(item => item.color === activeColor);
  const activeColorPlan = activePastalPlan.colors[activeColorPlanIndex];
  const nextPlannedColor = activePastalPlan.colors[activeColorPlanIndex + 1]?.color ?? null;
  const manualCounterValue = Number(colorCounterDraft);
  const manualCounterResolution = resolveManualColorCounter(
    manualCounterValue,
    lastKnownCounter,
    colorCounterResetChoice,
  );
  const isManualLayerSource = selectedMachine?.layerSource === 'MANUAL';
  const manualCounterResetSuspected =
    isManualLayerSource &&
    lastKnownCounter > 0 &&
    Number.isInteger(manualCounterValue) &&
    manualCounterValue > 0 &&
    manualCounterValue <= lastKnownCounter;
  const layersToComplete = isManualLayerSource
    ? manualCounterResolution.kind === 'resolved' ? manualCounterResolution.layers : 0
    : activeColorActualLayers;
  const activeColorWeightKg = rollEntries
    .filter(roll => roll.color === activeColor)
    .reduce((sum, roll) => sum + (Number(roll.weightKg) || 0), 0);
  const isAutoFilled = (f: string) => autoFilledFields.has(f);

  useEffect(() => {
    if (!showColorTransition && !showPartialColorConfirm) return;
    setColorCounterDraft('');
    setColorCounterResetChoice(null);
  }, [activeColor, showColorTransition, showPartialColorConfirm]);

  useEffect(() => {
    if (
      !sessionRestoreReady ||
      !selectedOrder ||
      !spreadingStarted ||
      selectedMachine?.layerSource !== 'PLC' ||
      !activeColor ||
      !activeColorPlan ||
      pendingPlcReset ||
      pendingManualLayers > 0 ||
      activeColorActualLayers < activeColorPlan.layers ||
      promptedColorTransitions.includes(activeColor)
    ) {
      return;
    }
    setPromptedColorTransitions(previous =>
      previous.includes(activeColor) ? previous : [...previous, activeColor]
    );
    setShowColorTransition(true);
  }, [
    sessionRestoreReady,
    selectedOrder,
    spreadingStarted,
    selectedMachine?.layerSource,
    activeColor,
    activeColorPlan,
    pendingPlcReset,
    pendingManualLayers,
    activeColorActualLayers,
    promptedColorTransitions,
  ]);

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
                  const cuttingTableName = o.fasonTrackings.find(tracking => tracking.processType === 'KESIM')?.cuttingTable?.name;
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
                      {cuttingTableName && (
                        <div style={S.orderMeta}>
                          <span>Kesim masası: {cuttingTableName}</span>
                        </div>
                      )}
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
                        {calculatedOutputPieces || 0} / {selectedOrder.quantity} adet
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
                      tone={
                        grammageOnTarget
                          ? 'green'
                          : grammageTargetStatus === 'Hedef üstü (fire)' ||
                              grammageTargetStatus === 'Hedef altı (düşük gramaj)'
                            ? 'red'
                            : 'default'
                      }
                    />
                    <MetricTile
                      label="Çıkan"
                      value={calculatedOutputPieces ? String(calculatedOutputPieces) : '—'}
                      unit="adet"
                      tone={calculatedOutputPieces ? 'green' : 'default'}
                    />
                    <MetricTile
                      label="Pastal ağırlığı"
                      value={pastalWeightKg > 0 ? pastalWeightKg.toFixed(3) : '—'}
                      unit="kg"
                      tone="default"
                    />
                    <MetricTile
                      label="Birim gramaj"
                      value={unitGrammage !== null ? unitGrammage.toFixed(2) : '—'}
                      unit="g/adet"
                      tone="default"
                    />
                  </div>
                </div>

                <div style={S.stepBar}>
                  {[
                    { id: 1, label: 'Ölçüm', desc: 'Kat / en / gramaj' },
                    { id: 2, label: 'Serim', desc: 'Makine verisi' },
                    { id: 3, label: 'Tamamla', desc: 'Kesimi bitir' },
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
                        {savingOrderId === selectedOrder.id ? 'İşleniyor...' : '✓ Kesimi Tamamla'}
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
                        Raporu kaydet (kesimi bitirmeden)
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
                        disabled={scaleConnecting || !!scalePort || bridgeConnected}
                        tone={scalePort || bridgeConnected ? 'success' : 'primary'}
                      >
                        {scaleConnecting ? 'Bağlanıyor...' : scalePort || bridgeConnected ? 'Bağlı' : 'Tartı bağla'}
                      </SmallBtn>
                      <SmallBtn onClick={handleReadScale} tone="primary">
                        Tartıdan al
                      </SmallBtn>
                      {(scalePort || bridgeConnected) && (
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
                    {isLowGrammage ? (
                      <DetailItem
                        label="Düşük gramaj uyarısı"
                        value={
                          `%${(((targetGrammage - actualGrammage) / targetGrammage) * 100).toFixed(1)} ` +
                          `(${Math.round(targetGrammage - actualGrammage)} g/m² eksik)`
                        }
                        tone="red"
                      />
                    ) : cuttingWastePercent > 0 ? (
                      <DetailItem
                        label="Kesim firesi"
                        value={
                          `%${cuttingWastePercent.toFixed(1)} ` +
                          `(${Math.round(actualGrammage - targetGrammage)} g/m² fazla)`
                        }
                        tone={cuttingWastePercent > 5 ? 'red' : 'green'}
                      />
                    ) : (
                      <DetailItem label="Kesim firesi" value="—" />
                    )}
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
                          style={{
                            ...S.colorChip,
                            ...(activeColor === c ? S.colorChipActive : {}),
                            ...(spreadingStarted ? { opacity: 0.65, cursor: 'not-allowed' } : {}),
                          }}
                          onClick={() => {
                            if (!spreadingStarted) setActiveColor(c);
                          }}
                          aria-disabled={spreadingStarted}
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/70 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <strong className="text-sm">Pastal planı · {manualPastalPlan ? 'Manuel' : 'Otomatik fallback'}</strong>
                        <p className="mt-1 text-xs text-slate-400">
                          {activePastalPlan.plannedLayers || '—'} kat
                          {activePastalPlan.colors.length > 0 &&
                            ` · ${activePastalPlan.colors.map(item => `${item.color} (${item.layers} kat, ${item.weightKg} kg)`).join(' → ')}`}
                        </p>
                      </div>
                      <button
                        className="rounded-md border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800"
                        disabled={spreadingStarted}
                        onClick={() => setPastalPlanOpen(true)}
                        type="button"
                      >
                        {spreadingStarted ? 'Serim sırasında plan kilitli' : manualPastalPlan ? 'Planı düzenle' : 'Plan gir'}
                      </button>
                    </div>
                  </div>
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
                        label="Fiili kumaş gramajı"
                        value={draftReport.fiiliOrtalamaGramaj}
                        unit="g/m²"
                        auto={isAutoFilled('fiiliOrtalamaGramaj')}
                        readOnly
                      />
                    </div>
                    <div style={S.twoCol}>
                      <FieldTouch
                        label="Pastal ağırlığı"
                        value={pastalWeightKg > 0 ? pastalWeightKg.toFixed(3) : ''}
                        unit="kg"
                        readOnly
                      />
                      <FieldTouch
                        label="Birim gramaj"
                        value={unitGrammage !== null ? unitGrammage.toFixed(2) : ''}
                        unit="g/adet"
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
                  {mtkRun.machine}{' '}
                  <span style={S.demoBadge}>
                    {selectedMachine?.layerSource === 'MANUAL'
                      ? 'MANUEL SAYAÇ'
                      : isDemoMode
                        ? 'DEMO'
                        : mtkRun.source === 'SENSOR'
                          ? 'PLC / GATEWAY'
                          : 'PLC VERİSİ BEKLENİYOR'}
                  </span>
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
                        {m.name} · {m.cuttingTable.name} · {m.layerSource === 'PLC' ? 'PLC/Gateway' : 'Manuel'}
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
                        handleClearRollEntries();
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

              {mtkError && (
                <div role="alert" style={S.spreadingError}>
                  {mtkError}
                </div>
              )}
              {pendingPlcReset && (
                <div role="alert" className="mt-3 rounded-lg border border-amber-500 bg-amber-950/70 p-4 text-amber-100">
                  <strong>PLC sayacı sıfırlanmış olabilir.</strong>
                  <p className="mt-1 text-sm">
                    {activeColor || 'Aktif renk'} için son geçerli kat {pendingPlcReset.previousLayer};
                    yeni okuma {pendingPlcReset.currentLayer}. Renk başlangıç katı onay verilene kadar korunuyor.
                  </p>
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <label className="text-sm">
                      Onaylanacak toplam kat
                      <input
                        className="ml-2 w-28 rounded border border-amber-700 bg-slate-900 px-2 py-1"
                        min="0"
                        step="1"
                        type="number"
                        value={manualResetLayer}
                        onChange={event => setManualResetLayer(event.target.value)}
                      />
                    </label>
                    <button
                      className="rounded bg-amber-700 px-3 py-2 text-sm font-medium disabled:opacity-50"
                      disabled={savingOrderId === selectedOrder?.id}
                      onClick={() => void handleResolvePlcReset()}
                      type="button"
                    >
                      Manuel katı onayla
                    </button>
                    <button
                      className="rounded border border-amber-600 px-3 py-2 text-sm"
                      disabled={savingOrderId === selectedOrder?.id}
                      onClick={() => void handleResolvePlcReset(0)}
                      type="button"
                    >
                      Yeniden başlat (0’dan)
                    </button>
                  </div>
                </div>
              )}

              {spreadingStarted && selectedOrder && (
                <LayerCounter
                  key={selectedOrder.id}
                  orderId={selectedOrder.id}
                  run={mtkRun}
                  getHeaders={getAuthHeaders}
                  onPendingChange={setPendingManualLayers}
                  onRunChange={updatedRun => {
                    const nextRun = {
                      ...mtkRun,
                      ...updatedRun,
                      currentLayer: Number(updatedRun.currentLayer ?? 0),
                      layerSet: updatedRun.layerSet == null ? null : Number(updatedRun.layerSet),
                    };
                    plcLayerSampleRef.current = { layer: nextRun.currentLayer ?? 0, at: Date.now() };
                    setMtkRun(nextRun);
                    setSpreadingRunsByOrder(previous => ({ ...previous, [selectedOrder.id]: nextRun }));
                  }}
                  localOnly={isDemoMode && selectedMachine?.layerSource === 'MANUAL'}
                  onError={setError}
                  disabled={
                    spreadingCompleted ||
                    selectedMachine?.layerSource === 'PLC' ||
                    mtkRun.source === 'SENSOR' ||
                    showColorTransition ||
                    showPartialColorConfirm ||
                    Boolean(pendingPlcReset)
                  }
                />
              )}
              {spreadingStarted && activeColorPlan && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-indigo-700/60 bg-indigo-950/50 p-3">
                  <div>
                    <strong>{activeColor} · {activeColorActualLayers}/{activeColorPlan.layers} kat</strong>
                    <span className="ml-2 text-sm text-slate-300">
                      · {activeColorWeightKg.toFixed(2)} / {activeColorPlan.weightKg.toFixed(2)} kg
                    </span>
                  </div>
                  {(isManualLayerSource ? activeColorWeightKg > 0 : activeColorActualLayers > 0) &&
                    !showColorTransition &&
                    !showPartialColorConfirm && (
                    <button
                      className="rounded border border-amber-600 px-3 py-2 text-sm text-amber-100"
                      disabled={pendingManualLayers > 0 || Boolean(pendingPlcReset)}
                      onClick={() => {
                        if (isManualLayerSource || activeColorActualLayers >= activeColorPlan.layers) {
                          setShowColorTransition(true);
                        }
                        else setShowPartialColorConfirm(true);
                      }}
                      type="button"
                    >
                      {isManualLayerSource
                        ? 'Rengi tamamla ve sayaç gir'
                        : activeColorActualLayers >= activeColorPlan.layers
                          ? 'Renk geçişini aç'
                          : 'Rengi tamamla'}
                    </button>
                  )}
                </div>
              )}
              {spreadingStarted && activePastalPlan.colors.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2" aria-label="Renk kat kayıtları">
                  {activePastalPlan.colors.map(plan => {
                    const entry = colorLayerEntries[plan.color];
                    return (
                      <div
                        key={plan.color}
                        className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                      >
                        <span className={entry ? 'text-emerald-300' : 'text-slate-300'}>
                          {plan.color}: {entry ? `${entry.layers}/${plan.layers} kat` : `Bekliyor · ${plan.layers} kat`}
                        </span>
                        {entry && (
                          <button
                            className="rounded border border-slate-600 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
                            disabled={colorDecisionSaving}
                            onClick={() => void handleReopenColor(plan.color)}
                            type="button"
                          >
                            Düzelt
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

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
                        <SmallBtn onClick={handleReadScaleForSpreading} tone="primary" disabled={spreadingCompleted || showColorTransition || showPartialColorConfirm || Boolean(pendingPlcReset)}>
                          Tartıdan top
                        </SmallBtn>
                        <SmallBtn
                          onClick={() => {
                            const w = prompt('Top ağırlığı (kg):', '30');
                            if (w) handleAddRollManual(Number(w));
                          }}
                          tone="primary"
                          disabled={spreadingCompleted || showColorTransition || showPartialColorConfirm || Boolean(pendingPlcReset)}
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
                        disabled={spreadingCompleted || showColorTransition || showPartialColorConfirm || Boolean(pendingPlcReset)}
                      >
                        Top ekle (m)
                      </SmallBtn>
                    )}
                    {rollEntries.length > 0 && (
                      <SmallBtn onClick={handleClearRollEntries} tone="danger" disabled={spreadingStarted}>
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
                      disabled={spreadingCompleted || showColorTransition || showPartialColorConfirm || Boolean(pendingPlcReset)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRollBarcodeSubmit();
                      }}
                      placeholder="📷 Top barkodu oku (ör: 30.5 veya KOD|30.5)"
                      style={S.rollBarcodeInput}
                    />
                    <SmallBtn onClick={handleRollBarcodeSubmit} tone="success" disabled={spreadingCompleted || showColorTransition || showPartialColorConfirm || Boolean(pendingPlcReset)}>
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
                            {totals.rolls} top · {totals.weightKg.toFixed(2)} kg ·{' '}
                            {colorLayerEntries[color]?.layers ?? 'Kat bitişte girilecek'} kat
                          </span>
                        </div>
                        {countedRollEntries
                          .filter(r => (r.color || 'Renk bekleniyor') === color)
                          .map(r => (
                            <div key={r.id} style={S.rollRow}>
                              <span>{r.rollNumber}. top</span>
                              <span style={S.rollWeight}>{r.weightKg.toFixed(2)} kg</span>
                              {spreadingMode === 'spread-then-weight' && <span>{Number(r.meters ?? r.pieceCount).toFixed(1)} m</span>}
                              <button
                                onClick={() => handleRemoveRollEntry(r.id)}
                                disabled={spreadingStarted}
                                style={{ ...S.rollRemove, ...(spreadingStarted ? { opacity: 0.4, cursor: 'not-allowed' } : {}) }}
                              >
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
                        { color: activeColor, layerNumber: prev.length + 1, weightKg: 0, pieceCount: 0 },
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
        {selectedOrder && (
          <PastalPlanModal
            open={pastalPlanOpen}
            initialPlan={manualPastalPlan}
            fallbackPlan={fallbackPastalPlan}
            colorVariants={effectiveColorVariants}
            saving={pastalPlanSaving}
            onClose={() => setPastalPlanOpen(false)}
            onSave={handleSavePastalPlan}
          />
        )}
        {(showColorTransition || showPartialColorConfirm) && activeColorPlan && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4">
            <section
              aria-labelledby="color-transition-title"
              aria-modal="true"
              className="w-full max-w-lg rounded-xl border border-slate-600 bg-slate-900 p-6 text-slate-100 shadow-2xl"
              role="dialog"
            >
              <h2 className="text-xl font-semibold" id="color-transition-title">
                {isManualLayerSource
                  ? `${activeColor} bitiş sayacı`
                  : showPartialColorConfirm
                    ? 'Renk planın altında tamamlanıyor'
                    : `${activeColor} tamamlandı`}
              </h2>
              <p className="mt-3 text-slate-200">
                <strong>{activeColor}</strong> · {layersToComplete}/{activeColorPlan.layers} kat
                · {activeColorWeightKg.toFixed(2)} kg
              </p>
              {isManualLayerSource && (
                <div className="mt-4 rounded-lg border border-blue-700/60 bg-blue-950/40 p-4">
                  <label className="block text-sm font-semibold text-slate-100" htmlFor="color-counter-value">
                    Makine sayacında kaç yazıyor?
                  </label>
                  <p className="mt-1 text-xs text-slate-300">
                    {lastKnownCounter > 0
                      ? `Önceki renk sonu: ${lastKnownCounter} · Makinenin toplam sayacını girin.`
                      : 'Bu rengin başlangıcından beri makinenin toplam sayacını girin.'}
                  </p>
                  <input
                    autoFocus
                    id="color-counter-value"
                    inputMode="numeric"
                    min="1"
                    onChange={event => {
                      setColorCounterDraft(event.target.value);
                      setColorCounterResetChoice(null);
                    }}
                    step="1"
                    type="number"
                    value={colorCounterDraft}
                    className="mt-3 w-full rounded-lg border border-blue-600 bg-slate-950 px-4 py-3 text-center text-3xl font-bold text-white"
                  />
                  {manualCounterResetSuspected && (
                    <div role="alert" className="mt-3 rounded border border-amber-600/70 bg-amber-950/50 p-3">
                      <p className="text-sm text-amber-100">
                        Sayaç değeri ({manualCounterValue}) önceki renk sonuna ({lastKnownCounter}) eşit veya düşük.
                        Makine sayacı sıfırlandı mı?
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          className={`rounded px-3 py-2 text-sm ${colorCounterResetChoice === true ? 'bg-amber-600 text-white' : 'border border-amber-600 text-amber-100'}`}
                          onClick={() => setColorCounterResetChoice(true)}
                          type="button"
                        >
                          Evet, sıfırlandı
                        </button>
                        <button
                          className={`rounded px-3 py-2 text-sm ${colorCounterResetChoice === false ? 'bg-slate-600 text-white' : 'border border-slate-500 text-slate-100'}`}
                          onClick={() => setColorCounterResetChoice(false)}
                          type="button"
                        >
                          Hayır, devam ediyor
                        </button>
                      </div>
                    </div>
                  )}
                  {manualCounterResolution.kind === 'resolved' && (
                    <p className="mt-3 text-center text-sm font-semibold text-emerald-200">
                      Bu renk: {manualCounterResolution.layers} kat
                      {manualCounterResolution.hadCounterReset ? ' · sıfırlama onaylandı' : ''}
                    </p>
                  )}
                  {manualCounterResolution.kind === 'zero-layers' && (
                    <p role="alert" className="mt-3 text-sm text-amber-200">
                      Bu sayaç değeriyle renk 0 kat hesaplanıyor. Kat sayısı pozitif olana kadar tamamlama yapılamaz.
                    </p>
                  )}
                </div>
              )}
              {isManualLayerSource ? (
                <p className="mt-2 text-sm text-slate-300">
                  {layersToComplete > 0 && layersToComplete < activeColorPlan.layers
                    ? `${activeColorPlan.layers - layersToComplete} kat eksik. Sayaç değerini onaylayarak bu renk için kaydedin.`
                    : 'Girilen sayaç değeri onaylandığında renk katı kaydedilecek.'}
                  {' '}Operatör ve zaman bilgisi kayıt altına alınır.
                </p>
              ) : showPartialColorConfirm ? (
                <p className="mt-2 text-sm text-amber-200">
                  {Math.max(0, activeColorPlan.layers - layersToComplete)} kat eksik. Yine de
                  {nextPlannedColor ? ` ${nextPlannedColor} rengine` : ' serim tamamlamaya'} geçilsin mi?
                  Bu karar operatör ve zaman bilgisiyle kaydedilecek.
                </p>
              ) : (
                <p className="mt-2 text-sm text-slate-300">
                  Hedef kat sayısına ulaşıldı.
                  {nextPlannedColor ? ` ${nextPlannedColor} rengine geçilsin mi?` : ' Serim verileri iş emrine alınsın mı?'}
                </p>
              )}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  className="rounded-md border border-slate-600 px-4 py-2"
                  disabled={colorDecisionSaving}
                  onClick={() => {
                    setShowColorTransition(false);
                    setShowPartialColorConfirm(false);
                  }}
                  type="button"
                >
                  Vazgeç
                </button>
                <button
                  className="rounded-md bg-indigo-600 px-4 py-2 font-semibold disabled:opacity-50"
                  disabled={
                    colorDecisionSaving ||
                    Boolean(pendingPlcReset) ||
                    (isManualLayerSource && manualCounterResolution.kind !== 'resolved')
                  }
                  onClick={() => void handleColorCompletion()}
                  type="button"
                >
                  {colorDecisionSaving
                    ? 'Kaydediliyor...'
                    : nextPlannedColor
                    ? `${nextPlannedColor}'a Geç`
                    : 'Serimi Tamamla'}
                </button>
              </div>
            </section>
          </div>
        )}

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
              <p style={S.lockText}>
                {selectedOrder?.orderNo} için kesim aşaması tamamlanacak. İş emri kapanmaz; dikim aşamasına hazır
                olur ve Merkez Depo teslim aldığında kapanır.
              </p>
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
    gridTemplateColumns: '80px 110px 100px 80px 32px',
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
  rollLayerEdit: { display: 'flex', alignItems: 'center', gap: 5, color: '#94a3b8' },
  rollLayerInput: {
    width: 58,
    padding: '5px 6px',
    border: '1px solid #475569',
    borderRadius: 6,
    background: '#111827',
    color: '#f8fafc',
    font: 'inherit',
    textAlign: 'right',
  },
  spreadingError: {
    marginTop: 10,
    padding: '10px 12px',
    border: '1px solid rgba(248,113,113,0.55)',
    borderRadius: 8,
    background: 'rgba(127,29,29,0.3)',
    color: '#fecaca',
    fontSize: 13,
  },
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
