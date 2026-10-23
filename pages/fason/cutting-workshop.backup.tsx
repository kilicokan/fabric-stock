"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AuthGuard from "../../components/AuthGuard";
import { readParameterSettings } from "../../lib/parameters";
import { connectScale, readScaleWeight } from "../../lib/scale";
import type { ScaleReading, WebSerialPort } from "../../lib/scale";

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
  workshop?: {
    name: string;
  } | null;
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
  aciklama: ''
};

const DEFAULT_SIZE_DISTRIBUTION = ['S', 'M', 'L', 'XL'];
const DEFAULT_ASSORTI_TOTAL = 4;

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
        const sizes = sewingData.sizeChart
          .map(s => s.size?.trim())
          .filter(Boolean) as string[];
        if (sizes.length > 0) {
          result.sizeChart = sizes;
          result.defaultAsortiCount = sizes.length;
        }
      }
    }
  } catch {
  }
  return result;
};


const parseSewingNotes = (source?: string | null): { cuttingReport: CuttingReportData; checklist: ChecklistItem[] } => {
  if (!source) return { cuttingReport: defaultCuttingReport, checklist: [] };

  try {
    const parsed = JSON.parse(source);
    if (parsed && typeof parsed === "object") {
      const report = parsed.cuttingReport
        ? {
            ...defaultCuttingReport,
            ...(parsed.cuttingReport as CuttingReportData),
          }
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
  } catch {
  }

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
  }
) => {
  let parsed: Record<string, unknown> = { cuttingReport, checklist };

  if (source) {
    try {
      const existing = JSON.parse(source);
      if (existing && typeof existing === 'object') {
        parsed = { ...existing as Record<string, unknown>, cuttingReport, checklist };
      }
    } catch {
      parsed = {
        legacyNotes: source,
        cuttingReport,
        checklist,
      };
    }
  }

  if (spreading) {
    const rollColorTotals = spreading.rolls && spreading.rolls.length > 0
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
        Array.from(spreading.layers.reduce((totals, layer) => {
          const current = totals.get(layer.color.trim() || 'Renk bekleniyor') || { weightKg: 0, pieceCount: 0, layers: 0 };
          current.weightKg += Number(layer.weightKg) || 0;
          current.pieceCount += Number(layer.pieceCount) || 0;
          current.layers += 1;
          totals.set(layer.color.trim() || 'Renk bekleniyor', current);
          return totals;
        }, new Map<string, { weightKg: number; pieceCount: number; layers: number }>()))
      ),
      totalWeightKg: spreading.layers.reduce((sum, layer) => sum + (Number(layer.weightKg) || 0), 0),
      totalPieceCount: spreading.layers.reduce((sum, layer) => sum + (Number(layer.pieceCount) || 0), 0),
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

interface LayRow {
  color: string;
  kat: number;
  value: number;
  unit: 'kg' | 'm';
  kg: number;
}

const exitToKg = (exit: FabricExitDetail): number => {
  if (exit.unitType === 'kg') return Number(exit.productWeightKg || 0);
  if (exit.unitType === 'm') {
    const lengthM = Number(exit.productLengthMeter || 0);
    const grammage = Number(exit.grammage || 0);
    if (lengthM > 0 && grammage > 0) {
      const pastelEniCm = Number(exit.pastelEni || 0);
      const widthM = pastelEniCm > 0 ? pastelEniCm / 100 : 1;
      return Number((lengthM * widthM * grammage / 1000).toFixed(3));
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

const CuttingWorkshopPage = () => {
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
  const [mtkLoading, setMtkLoading] = useState(false);
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
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isDemoMode] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [spreadingPanelOpen, setSpreadingPanelOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);

  const QUICK_NOTES = [
    'Kalite uygun',
    'En dar — dikkat',
    'Kat eksik',
    'Gramaj hedef dışı',
    'Serim tamam',
    'Kumaş hatası',
  ];

  const selectedOrder = orders.find(order => order.id === selectedOrderId) || null;
  const spreadingCompleted = mtkRun.status === 'SERİM TAMAMLANDI' ||
    (spreadingStarted && mtkRun.layerSet !== null && mtkRun.currentLayer !== null && mtkRun.currentLayer >= mtkRun.layerSet);
  const selectedMachine = spreadingMachines.find(machine => machine.id === selectedMachineId);
  const colorTotals = spreadingLayers.reduce((totals, layer) => {
    const color = layer.color.trim() || 'Renk bekleniyor';
    const current = totals.get(color) || { weightKg: 0, pieceCount: 0, layers: 0 };
    current.weightKg += Number(layer.weightKg) || 0;
    current.pieceCount += Number(layer.pieceCount) || 0;
    current.layers += 1;
    totals.set(color, current);
    return totals;
  }, new Map<string, { weightKg: number; pieceCount: number; layers: number }>());
  const totalSpreadingWeightKg = Array.from(colorTotals.values()).reduce((sum, value) => sum + value.weightKg, 0);
  const totalSpreadingPieces = Array.from(colorTotals.values()).reduce((sum, value) => sum + value.pieceCount, 0);

  const rollTotalsByColor = calculateRollTotalsByColor(rollEntries);
  const totalRolls = rollEntries.length;
  const totalRollWeightKg = Array.from(rollTotalsByColor.values()).reduce((sum, v) => sum + v.weightKg, 0);
  const totalRollLayers = Array.from(rollTotalsByColor.values()).reduce((sum, v) => sum + v.layers, 0);
  const totalRollMeters = Array.from(rollTotalsByColor.values()).reduce((sum, v) => sum + v.pieceCount, 0);

  const loadMtkRun = useCallback(async () => {
    if (!selectedOrderId || !spreadingStarted) return;
    setMtkLoading(true);
    await new Promise(resolve => window.setTimeout(resolve, 150));
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
    setMtkLoading(false);
  }, [selectedOrderId, spreadingStarted]);

  const loadCuttingTables = async () => {
    try {
      const response = await fetch('/api/cutting-tables');
      if (!response.ok) return;
      const data = await response.json();
      const tables = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : [];
      setCuttingTables(tables.map((t: CuttingTable) => ({ id: Number(t.id), name: String(t.name) })));
    } catch (error) {
      console.error('Kesim masaları yüklenemedi.', error);
    }
  };

  const loadSpreadingMachines = async () => {
    try {
      const response = await fetch('/api/spreading-machines');
      if (!response.ok) throw new Error('Serim makineleri yüklenemedi.');
      const data = await response.json();
      setSpreadingMachines(Array.isArray(data.data) ? data.data : []);
    } catch (loadError) {
      console.error(loadError);
      setMtkError('Serim makineleri yüklenemedi.');
    }
  };

  const loadOrders = async (showNotifications = false): Promise<CuttingOrder[]> => {
    try {
      const response = await fetch('/api/fason/work-orders?limit=100&processType=KESIM&excludeProcessStatus=TESLIM_EDILDI');
      if (!response.ok) {
        throw new Error('Kesim iş emirleri yüklenemiyor.');
      }

      const data = await response.json();
      const items: CuttingOrder[] = (data.data || data || [])
        .filter((order: CuttingOrder) => Array.isArray(order.fasonTrackings))
        .map((order: CuttingOrder) => ({
          ...order,
          productColor: order.productColor || order.notes || 'Bilinmiyor'
        }));

      const currentIds = items.map(item => item.id);
      if (showNotifications && latestOrderIds.current.length > 0) {
        const added = currentIds.filter(id => !latestOrderIds.current.includes(id));
        if (added.length) {
          setInfoMessage(`${added.length} yeni kesim emri kesim ekranına düştü.`);
        }
      }
      latestOrderIds.current = currentIds;
      setOrders(items);
      return items;
    } catch (fetchError) {
      console.error(fetchError);
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
      const response = await fetch('/api/products', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error('Ürünler yüklenemiyor.');
      }

      const data = await response.json();
      const products = Array.isArray(data) ? data : (data.products || []);
      const map = new Map<string, FabricInfo>();

      products.forEach((product: {
        modelNo?: string;
        name?: string;
        averageGrammage?: number | null;
        fabric?: { width?: number | null; name?: string; averageGrammage?: number | null } | null;
      }) => {
        if (product.modelNo && product.fabric) {
          map.set(product.modelNo, {
            width: product.fabric.width ?? null,
            name: product.fabric.name || '',
            averageGrammage: product.averageGrammage ?? product.fabric.averageGrammage ?? null,
            productAverageGrammage: product.averageGrammage ?? null,
          });
        }
      });

      setProductFabrics(map);
    } catch (fetchError) {
      console.error(fetchError);
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
          const response = await fetch(`/api/fason/product-by-model?modelNo=${encodeURIComponent(code)}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!response.ok) return;
          const product = await response.json();
          const info = parseProductSewingNotes(product.sewingNotes);
          if (product.fabric) {
            if (product.fabric.width) {
              info.fabricWidth = product.fabric.width;
              info.fabricName = product.fabric.name || '';
            }
            info.fabricUnit = product.fabric.unit || '';
            info.fabricStockQuantity = product.fabric.stockQuantity ?? null;
          }
          map.set(code, info);
        } catch (fetchError) {
          console.error(`Product ${code} asorti yüklenirken hata:`, fetchError);
        }
      })
    );

    setProductAsortiMap(map);
  };

  const refreshFabricExitsForOrder = async (orderNo: string) => {
    setFabricExitLoading(true);
    try {
       const response = await fetch(`/api/fabric-exits?orderNo=${encodeURIComponent(orderNo.trim())}`);
       if (!response.ok) {
         setFabricExitInfo(null);
         setFabricExitDetails(null);
         setFabricExits([]);
         return;
       }

       const exits = await response.json();
       const rows: FabricExitDetail[] = Array.isArray(exits) ? exits : Array.isArray(exits.data) ? exits.data : [];
       if (!rows.length) {
         setFabricExitInfo(null);
         setFabricExitDetails(null);
         setFabricExits([]);
         return;
       }

       const unit = rows[0]?.unitType === 'm' ? 'm' : 'kg';
       const total = rows.reduce((sum, row) => {
         if (row.unitType === 'm') return sum + Number(row.productLengthMeter || 0);
         return sum + Number(row.productWeightKg || 0);
       }, 0);

       const latest = rows[0];
       setFabricExitInfo({ quantity: total, unit, reportNumber: latest?.reportNumber || null });
       setFabricExitDetails(latest || null);
       setFabricExits(rows);
       setDraftReport(prev => ({
        ...prev,
        fabricExitQuantity: String(total || prev.fabricExitQuantity || ''),
        fabricExitUnit: unit,
      }));
     } catch (error) {
       console.error('Fabric exit yüklenirken hata oluştu:', error);
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
      if (mounted && items.length > 0) {
        await loadProductAsortiDefaults(items);
      }
      if (mounted) setLoading(false);
    };

    initLoad();
    const refreshTimer = window.setInterval(() => loadOrders(true), 30000);
    return () => {
      mounted = false;
      window.clearInterval(refreshTimer);
    };
  }, []);

  useEffect(() => {
    loadMtkRun();
    const refreshTimer = window.setInterval(loadMtkRun, 10000);
    return () => window.clearInterval(refreshTimer);
  }, [loadMtkRun]);

  // Reset selected color variant when order changes
  useEffect(() => {
    if (!selectedOrder) {
      setSelectedColorVariant('');
      return;
    }
    const variants = selectedOrder.colorVariants && selectedOrder.colorVariants.length > 0
      ? selectedOrder.colorVariants
      : (selectedOrder.productColor ? [selectedOrder.productColor] : []);

    if (variants.length > 0) {
      setSelectedColorVariant(variants[0]);
    } else {
      setSelectedColorVariant('');
    }
  }, [selectedOrderId, selectedOrder?.colorVariants, selectedOrder?.productColor]);

  useEffect(() => {
    if (!selectedOrderId) return;
    const existingRun = spreadingRunsByOrder[selectedOrderId];
    if (existingRun) {
      setMtkRun(existingRun);
      setSpreadingStarted(existingRun.status !== 'HAZIR');
      return;
    }

    const initialRun = {
      ...MOCK_SPREADING_RUN,
      externalRunId: `DEMO-${selectedOrderId}`,
      currentLayer: 0,
      sourceUpdatedAt: new Date().toISOString(),
    };
    setMtkRun(initialRun);
    setSpreadingStarted(false);
    setSelectedMachineId(null);
    setSpreadingLayers([{ color: '', layerNumber: 1, weightKg: 0, pieceCount: 0 }]);
    setSpreadingRunsByOrder(runs => ({ ...runs, [selectedOrderId]: initialRun }));
  }, [selectedOrderId, spreadingRunsByOrder]);

  useEffect(() => {
    if (!orders.length) return;
    const params = new URLSearchParams(window.location.search);
    const orderNo = params.get('orderNo');
    const workOrderId = params.get('workOrderId');
    if (!orderNo && !workOrderId) return;

    const matched = orders.find(o => {
      if (workOrderId && String(o.id) === String(workOrderId)) return true;
      if (orderNo && o.orderNo.trim().toLowerCase() === orderNo.trim().toLowerCase()) return true;
      return false;
    });

    if (matched) {
      setSelectedOrderId(matched.id);
    }
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
        const reportWithPlanKat = {
          ...parsed.cuttingReport,
          asortiCount,
          planKat: asortiCount ? calculatePlanKat(selectedOrder.quantity, asortiCount) : parsed.cuttingReport.planKat
        };
        setDraftReport(reportWithPlanKat);
        setChecklist(parsed.checklist);
        setFabricExitInfo(null);
        setFabricExitDetails(null);
        setAutoFilledFields(autoFilled);
      }
      return;
    }

    const effectiveAsortiCount = parsed.cuttingReport.asortiCount || String(productDefaultAsorti);
    const reportWithPlanKat = {
      ...parsed.cuttingReport,
      asortiCount: effectiveAsortiCount,
      planKat: effectiveAsortiCount ? calculatePlanKat(selectedOrder.quantity, effectiveAsortiCount) : parsed.cuttingReport.planKat
    };
    setDraftReport(reportWithPlanKat);
    setChecklist(parsed.checklist);
    setFabricExitLoading(true);

    const fetchExitInfo = async () => {
      try {
        const response = await fetch(`/api/fabric-exits?orderNo=${encodeURIComponent(selectedOrder.orderNo.trim())}&aggregate=true`);
        if (!response.ok) {
          if (isMounted && requestId === fabricExitRequestId.current) {
            setFabricExitInfo(null);
            setFabricExitDetails(null);
            setFabricExits([]);
          }
          return;
        }

        const data = await response.json();
        const exits: FabricExitDetail[] = Array.isArray(data.rows) ? data.rows : [];
        const latestExit = exits[0] as FabricExitDetail | undefined;

        if (!latestExit) {
          if (isMounted && requestId === fabricExitRequestId.current) {
            setFabricExitInfo(null);
            setFabricExitDetails(null);
            setFabricExits([]);
          }
          return;
        }

        const totalKg = Number(data.totalKg || 0);
        const totalM = Number(data.totalM || 0);
        const unitType = totalM > 0 && totalKg === 0 ? 'm' : totalKg > 0 && totalM === 0 ? 'kg' : 'mixed';
        const quantity = unitType === 'm' ? totalM : unitType === 'kg' ? totalKg : Math.max(totalKg, totalM);

        if (isMounted && requestId === fabricExitRequestId.current) {
          setFabricExitInfo({
            quantity,
            unit: unitType,
            reportNumber: latestExit.reportNumber || data.latestReportNumber || null,
            quantityKg: totalKg,
            quantityM: totalM,
          });
          setFabricExitDetails(latestExit);
          setFabricExits(exits);

          setDraftReport(prev => {
            const updated: CuttingReportData = { ...prev };

            if (!prev.fabricExitQuantity && quantity > 0) {
              updated.fabricExitQuantity = String(quantity);
              updated.fabricExitUnit = unitType === 'mixed' ? 'kg' : unitType;
              autoFilled.add('fabricExitQuantity');
              autoFilled.add('fabricExitUnit');
            }

            const pastelEni = latestExit.pastelEni || 0;
            if (pastelEni > 0 && !autoFilled.has('fiiliOrtalamaKumasEni')) {
              updated.fiiliOrtalamaKumasEni = String(pastelEni);
              autoFilled.add('fiiliOrtalamaKumasEni');
            }

            const layerCount = latestExit.layerCount || 0;
            if (!prev.atilanKat && layerCount > 0) {
              updated.atilanKat = String(layerCount);
              autoFilled.add('atilanKat');
            }

            if (!prev.fiiliToplamAtılanKat && layerCount > 0) {
              updated.fiiliToplamAtılanKat = String(layerCount);
              autoFilled.add('fiiliToplamAtılanKat');
            }

            return updated;
          });
          setAutoFilledFields(autoFilled);
        }
      } catch (fetchError) {
        console.error('Fabric exit yüklenirken hata oluştu:', fetchError);
        if (isMounted && requestId === fabricExitRequestId.current) {
          setFabricExitInfo(null);
          setFabricExitDetails(null);
          setFabricExits([]);
        }
      } finally {
        if (isMounted && requestId === fabricExitRequestId.current) {
          setFabricExitLoading(false);
        }
      }
    };

    fetchExitInfo();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrder]);

  useEffect(() => {
    if (!selectedOrder) return;
    if (!productsLoaded) return;

    const fabricInfo = productFabrics.get(selectedOrder.productCode);
    const asortiInfo = productAsortiMap.get(selectedOrder.productCode);

    setDraftReport(prev => {
      const updated: CuttingReportData = { ...prev };
      const autoAdd = (field: string) => setAutoFilledFields(f => new Set([...f, field]));

      if (fabricInfo && fabricInfo.width && fabricInfo.width > 0 && !prev.fiiliOrtalamaKumasEni) {
        updated.fiiliOrtalamaKumasEni = String(fabricInfo.width);
        autoAdd('fiiliOrtalamaKumasEni');
      }

      if (asortiInfo && asortiInfo.fabricStockQuantity && asortiInfo.fabricStockQuantity > 0) {
        const unit = asortiInfo.fabricUnit === 'kg' ? 'kg' : 'm';
        if (!prev.fabricExitQuantity) {
          updated.fabricExitQuantity = String(asortiInfo.fabricStockQuantity);
          updated.fabricExitUnit = unit;
          autoAdd('fabricExitQuantity');
          autoAdd('fabricExitUnit');
        }
      }

      return updated;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        const calculatedGramaj = (totalCutKg * 1000) / (singleLayerArea * atilanKat);
        const roundedGramaj = Math.round(calculatedGramaj * 100) / 100;

        setDraftReport(prev => {
          if (prev.fiiliOrtalamaGramaj) return prev;
          return { ...prev, fiiliOrtalamaGramaj: String(roundedGramaj) };
        });
        setAutoFilledFields(prev => {
          if (prev.has('fiiliOrtalamaGramaj')) return prev;
          return new Set([...prev, 'fiiliOrtalamaGramaj']);
        });
      }
    }
  }, [selectedOrder, draftReport.atilanKat, draftReport.asortiCount, draftReport.fabricExitQuantity, fabricExitInfo, fabricExitDetails, draftReport.fiiliOrtalamaKumasEni, mtkRun.pastelMeter]);

  useEffect(() => {
    if (!selectedOrder) return;
    if (!productAsortiMap.size) return;

    const savedAsorti = parseSewingNotes(selectedOrder.sewingNotes).cuttingReport.asortiCount;
    if (savedAsorti) return;

    const productDefault = productAsortiMap.get(selectedOrder.productCode);
    if (!productDefault) return;

    const currentAsortiNum = Number(draftReport.asortiCount || 0);
    if (currentAsortiNum === DEFAULT_ASSORTI_TOTAL && productDefault.defaultAsortiCount !== DEFAULT_ASSORTI_TOTAL) {
      const newAsorti = String(productDefault.defaultAsortiCount);
      setDraftReport(prev => ({
        ...prev,
        asortiCount: newAsorti,
        planKat: calculatePlanKat(selectedOrder.quantity, newAsorti),
      }));
    }
  }, [selectedOrder, productAsortiMap, draftReport.asortiCount, selectedOrder?.quantity]);

  useEffect(() => {
    if (!selectedOrder) {
      setSizeCounts({});
      return;
    }
    const sizes = productAsortiMap.get(selectedOrder.productCode)?.sizeChart || DEFAULT_SIZE_DISTRIBUTION;
    setSizeCounts(prev => {
      const next: Record<string, number> = {};
      sizes.forEach(size => {
        next[size] = prev[size] ?? 1;
      });
      return next;
    });
  }, [selectedOrder?.id, selectedOrder?.productCode, productAsortiMap]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-cutting-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    if (!infoMessage) return;
    const t = window.setTimeout(() => setInfoMessage(null), 4000);
    return () => window.clearTimeout(t);
  }, [infoMessage]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), 6000);
    return () => window.clearTimeout(t);
  }, [error]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (pageRef.current) {
          await pageRef.current.requestFullscreen();
        }
      } else {
        await document.exitFullscreen();
      }
    } catch (fullscreenError) {
      console.error('Tam ekran islemi basarisiz:', fullscreenError);
    }
  };

  const handleSelectOrder = (orderId: number) => {
    setSelectedOrderId(orderId);
    setInfoMessage(null);
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
    setMtkRun(prev => ({
      ...prev,
      machine: selectedMachine.name,
      machineId: selectedMachine.id,
      cuttingTableId: selectedMachine.cuttingTable.id,
      status: 'SERİM DEVAM EDİYOR',
      sourceUpdatedAt: new Date().toISOString(),
    }));
    setInfoMessage(`${selectedMachine.name} / ${selectedMachine.cuttingTable.name} üzerinde serim başlatıldı.`);
  };

  const updateSpreadingLayer = (index: number, field: keyof SpreadingLayerInput, value: string) => {
    setSpreadingLayers(prev => prev.map((layer, layerIndex) => {
      if (layerIndex !== index) return layer;
      const numericFields = field === 'layerNumber' || field === 'weightKg' || field === 'pieceCount';
      return { ...layer, [field]: numericFields ? Number(value) || 0 : value };
    }));
  };

  const removeSpreadingLayer = (index: number) => {
    setSpreadingLayers(prev => {
      if (prev.length <= 1) return prev;
      return prev
        .filter((_, i) => i !== index)
        .map((layer, i) => ({ ...layer, layerNumber: i + 1 }));
    });
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

    if (scalePort) {
      reading = await readScaleWeight(scalePort);
    } else {
      const unusedReading = scaleReadings.find(entry => !entry.usedFor && entry.reading.weight > 0);
      if (unusedReading) {
        reading = unusedReading.reading;
      } else if (scaleReading) {
        reading = scaleReading;
      } else {
        const mockWeights = [28.5, 30.0, 32.4, 27.8, 35.2, 29.7];
        const randomWeight = mockWeights[Math.floor(Math.random() * mockWeights.length)];
        reading = {
          weight: randomWeight,
          unit: 'kg',
          stable: true,
          raw: `${randomWeight.toFixed(2)} kg`,
        };
      }
    }

    if (!reading || reading.weight <= 0) {
      setError('Tartıdan geçerli ağırlık okunamadı');
      return;
    }

    setScaleReading(reading);
    const existingUnusedIndex = scaleReadings.findIndex(entry => !entry.usedFor && entry.reading.weight === reading.weight);
    if (existingUnusedIndex !== -1) {
      setScaleReadings(prev => prev.map((entry, idx) =>
        idx === existingUnusedIndex ? { ...entry, usedFor: 'Serime verildi' } : entry
      ));
    } else if (scaleReadings.length > 0 && scaleReadings[0]?.reading.weight === reading.weight) {
      if (!scaleReadings[0].usedFor) {
        setScaleReadings(prev => prev.map((entry, idx) =>
          idx === 0 ? { ...entry, usedFor: 'Serime verildi' } : entry
        ));
      }
    } else {
      setScaleReadings(prev => [
        { reading, time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), usedFor: 'Serime verildi' },
        ...prev,
      ]);
    }

    const fabricInfo = productFabrics.get(selectedOrder.productCode);
    const asortiInfo = productAsortiMap.get(selectedOrder.productCode);
    const gramaje = Number(weightCalcInputs.gramaje) > 0
      ? weightCalcInputs.gramaje
      : (fabricInfo?.productAverageGrammage ?? fabricInfo?.averageGrammage ?? 0);
    const widthCm = Number(weightCalcInputs.widthCm) > 0
      ? weightCalcInputs.widthCm
      : (asortiInfo?.fabricWidth ?? fabricInfo?.width ?? 0);
    const lengthM = Number(weightCalcInputs.lengthM) > 0
      ? weightCalcInputs.lengthM
      : (fabricExitDetails?.productLengthMeter ?? mtkRun.pastelMeter ?? 0);
    const layers = calculateLayersFromWeight(reading.weight, gramaje, widthCm, lengthM);

    const color = selectedColorVariant || selectedOrder.productColor || 'Renk bekleniyor';
    const nextRollNumber = rollEntries.filter(r => (r.color || '') === color).length + 1;

    const newRoll: RollEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      color,
      rollNumber: nextRollNumber,
      weightKg: reading.weight,
      calculatedLayers: layers,
      pieceCount: 0,
      createdAt: new Date().toISOString(),
    };

    setRollEntries(prev => [...prev, newRoll]);
    setInfoMessage(`Tartıdan alındı: ${reading.weight.toFixed(3)} kg · ${layers} kat`);

    const layerWeight = layers > 0 ? reading.weight / layers : 0;
    const existingLayer = spreadingLayers.find(layer => (layer.color || '') === color);
    if (!existingLayer) {
      setSpreadingLayers([{ color, layerNumber: 1, weightKg: layerWeight, pieceCount: 0 }]);
    } else {
      setSpreadingLayers(prev => prev.map(layer => {
        if ((layer.color || '') === color) {
          return { ...layer, weightKg: layerWeight, layerNumber: layers };
        }
        return layer;
      }));
    }
  };

  const handleAddRollManual = (weightKg: number) => {
    if (!selectedOrder) return;
    const fabricInfo = productFabrics.get(selectedOrder.productCode);
    const asortiInfo = productAsortiMap.get(selectedOrder.productCode);
    const gramaje = Number(weightCalcInputs.gramaje) > 0
      ? weightCalcInputs.gramaje
      : (fabricInfo?.productAverageGrammage ?? fabricInfo?.averageGrammage ?? 0);
    const widthCm = Number(weightCalcInputs.widthCm) > 0
      ? weightCalcInputs.widthCm
      : (asortiInfo?.fabricWidth ?? fabricInfo?.width ?? 0);
    const lengthM = Number(weightCalcInputs.lengthM) > 0
      ? weightCalcInputs.lengthM
      : (fabricExitDetails?.productLengthMeter ?? mtkRun.pastelMeter ?? 0);
    const layers = calculateLayersFromWeight(weightKg, gramaje, widthCm, lengthM);

    const color = selectedColorVariant || selectedOrder.productColor || 'Renk bekleniyor';
    const nextRollNumber = rollEntries.filter(r => (r.color || '') === color).length + 1;

    const newRoll: RollEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      color,
      rollNumber: nextRollNumber,
      weightKg,
      calculatedLayers: layers,
      pieceCount: 0,
      createdAt: new Date().toISOString(),
    };

    setRollEntries(prev => [...prev, newRoll]);
   };

   const handleAddRollByMeter = (lengthM: number) => {
     if (!selectedOrder) return;
     const fabricInfo = productFabrics.get(selectedOrder.productCode);
     const asortiInfo = productAsortiMap.get(selectedOrder.productCode);
     const gramaje = Number(weightCalcInputs.gramaje) > 0
       ? weightCalcInputs.gramaje
       : (fabricInfo?.productAverageGrammage ?? fabricInfo?.averageGrammage ?? 0);
     const widthCm = Number(weightCalcInputs.widthCm) > 0
       ? weightCalcInputs.widthCm
       : (asortiInfo?.fabricWidth ?? fabricInfo?.width ?? 0);
     const widthM = widthCm / 100;
     const singleLayerArea = widthM * lengthM;
     const singleLayerWeightKg = (singleLayerArea * gramaje) / 1000;
     const layers = Math.max(1, Math.floor(30 / singleLayerWeightKg));
     const totalWeightKg = singleLayerWeightKg * layers;

     const color = selectedColorVariant || selectedOrder.productColor || 'Renk bekleniyor';
     const nextRollNumber = rollEntries.filter(r => (r.color || '') === color).length + 1;

     const newRoll: RollEntry = {
       id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
       color,
       rollNumber: nextRollNumber,
       weightKg: totalWeightKg,
       calculatedLayers: layers,
       pieceCount: lengthM,
       createdAt: new Date().toISOString(),
     };

     setRollEntries(prev => [...prev, newRoll]);
     setInfoMessage(`Top eklendi: ${lengthM.toFixed(1)} m · ${layers} kat · ${totalWeightKg.toFixed(2)} kg`);
   };

   const handleRemoveRollEntry = (id: string) => {
    setRollEntries(prev => prev.filter(entry => entry.id !== id));
  };

  const handleClearRollEntries = () => {
    setRollEntries([]);
  };

  const handleWeightCalcInputChange = (field: keyof WeightCalcInputs, value: string) => {
    setWeightCalcInputs(prev => ({ ...prev, [field]: Number(value) || 0 }));
  };

  const handleSizeCountChange = (size: string, value: string) => {
    const num = Math.max(0, Number(value) || 0);
    setSizeCounts(prev => ({ ...prev, [size]: num }));
  };

  const appendQuickNote = (note: string) => {
    setDraftReport(prev => ({
      ...prev,
      aciklama: prev.aciklama ? `${prev.aciklama.trim()} · ${note}` : note,
    }));
  };

  const handlePrintReport = () => {
    if (!selectedOrder) {
      setError('Yazdırmak için önce iş emri seçin.');
      return;
    }
    const sizeLines = Object.entries(sizeCounts)
      .map(([size, count]) => `${size}: ${count}`)
      .join(' · ');

    const { rows: layRows, totalKg: layTotalKg } = buildLayBreakdown(
      fabricExits,
      selectedOrder.productColor
    );
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
      layBreakdownHtml = colorOrder
        .map(color => {
          const colorRows = layRows.filter(r => r.color === color);
          const colorTotalKg = colorRows.reduce((sum, r) => sum + r.kg, 0);
          const lines = colorRows
            .map(r => `<div style="margin-left:16px;font-family:monospace;font-size:13px">${r.kat} kat ${formatLayNumber(r.value)} ${r.unit}</div>`)
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
        if (!seen.has(color)) { seen.add(color); colorOrder.push(color); }
      });
      rollBreakdownHtml = colorOrder
        .map(color => {
          const colorRolls = rollEntries.filter(r => (r.color || 'Renk bekleniyor') === color);
          const colorTotalKg = colorRolls.reduce((sum, r) => sum + (Number(r.weightKg) || 0), 0);
          const colorTotalLayers = colorRolls.reduce((sum, r) => sum + (Number(r.calculatedLayers) || 0), 0);
          const colorTotalMeters = colorRolls.reduce((sum, r) => sum + (Number(r.pieceCount) || 0), 0);
          const lines = colorRolls
            .map(r => `<div style="margin-left:16px;font-family:monospace;font-size:13px">${r.rollNumber}. top ${formatLayNumber(r.weightKg)} kg · ${r.calculatedLayers} kat${spreadingMode === 'spread-then-weight' ? ` · ${r.pieceCount.toFixed(1)} m` : ''}</div>`)
            .join('');
          return (
            `<div style="margin-top:8px">` +
            `<div style="font-weight:700;font-size:13px">${color}</div>` +
            lines +
            `<div style="margin-left:16px;font-size:12px;color:#64748b">${formatLayNumber(colorTotalKg)} kg · ${colorTotalLayers} kat${spreadingMode === 'spread-then-weight' ? ` · ${colorTotalMeters.toFixed(1)} m` : ''} (toplam renk)</div>` +
            `</div>`
          );
        })
        .join('') +
        `<div style="margin-top:10px;font-weight:700;font-size:13px">toplam ${totalRolls} top · ${formatLayNumber(totalRollWeightKg)} kg · ${totalRollLayers} kat${spreadingMode === 'spread-then-weight' ? ` · ${totalRollMeters.toFixed(1)} m` : ''}</div>`;
    }

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
        ${rollEntries.length > 0 ? `
        <div class="section">Top / Kat - Renk bazlı (${spreadingMode === 'weight-first' ? 'Tartı → Serim' : 'Serim → Tartı'})</div>
        <div>${rollBreakdownHtml}</div>
        ${spreadingMode === 'spread-then-weight' ? `
        <div class="section">Hesaplama</div>
        <div style="font-family:monospace;font-size:12px;color:#64748b">
          Tek Kat Alanı = En (m) × Boy (m) = ${(Number(weightCalcInputs.widthCm || 0)/100).toFixed(2)} m × ${weightCalcInputs.lengthM?.toFixed(2) || 0} m<br/>
          Tek Kat Ağırlığı = Alan × Gramaj / 1000<br/>
          Toplam Ağırlık = Tek Kat Ağırlığı × Kat Sayısı
        </div>
        ` : ''}
        ` : ''}
       <p style="margin-top:32px;font-size:11px;color:#94a3b8">Oluşturulma: ${new Date().toLocaleString('tr-TR')}</p>
      <script>window.onload=()=>{window.print();}</script>
      </body></html>`);
    win.document.close();
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

    const match = orders.find(order => {
      const orderNo = order.orderNo?.trim().toLowerCase() || '';
      const productCode = order.productCode?.trim().toLowerCase() || '';
      const termLower = term.toLowerCase();
      return orderNo.includes(termLower) || productCode.includes(termLower) || order.productName.toLowerCase().includes(termLower);
    });

    if (!match) {
      setError('Eşleşen kesim iş emri bulunamadı.');
      return;
    }

    setError(null);
    setBarcodeInput('');
    setSelectedOrderId(match.id);
    setInfoMessage(`${match.orderNo} iş emri seçildi.`);
  };

  const handleConnectScale = async () => {
    setScaleConnecting(true);
    try {
      const port = await connectScale(9600, msg => setError(msg));
      setScalePort(port);
      if (port) {
        setInfoMessage('Tartı bağlandı');
        setScaleReading(null);
      }
    } finally {
      setScaleConnecting(false);
    }
  };

  const handleReadScale = async () => {
    let reading: ScaleReading | null = null;

    if (scalePort) {
      reading = await readScaleWeight(scalePort);
    } else {
      const mockWeights = [28.5, 30.0, 32.4, 27.8, 35.2, 29.7, 42.1, 38.6];
      const randomWeight = mockWeights[Math.floor(Math.random() * mockWeights.length)];
      reading = {
        weight: randomWeight,
        unit: 'kg',
        stable: true,
        raw: `${randomWeight.toFixed(2)} kg`,
      };
    }

    if (reading && reading.weight > 0) {
      setScaleReading(reading);
       setScaleReadings(prev => [
        { reading, time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), usedFor: 'Çıkış için' },
        ...prev,
      ]);
      setFabricExitQuantityDraft(String(reading.weight.toFixed(3)));
      setFabricExitUnit('kg');
      setInfoMessage(`Tartıdan alındı: ${reading.weight.toFixed(3)} kg`);
    } else {
      setError('Tartıdan geçerli ağırlık okunamadı');
    }
  };

  const handleDisconnectScale = async () => {
    if (scalePort) {
      try {
        await scalePort.close();
      } catch {
      }
    }
    setScalePort(null);
    setScaleReading(null);
    setInfoMessage('Tartı bağlantısı kesildi');
  };

  const handleInputChange = (field: keyof CuttingReportData, value: string) => {
    setDraftReport(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'atilanKat') {
        const asortiNum = Number.parseFloat(prev.asortiCount || '0');
        const layerValue = Number.parseFloat(value || '0');
        if (Number.isFinite(asortiNum) && asortiNum > 0 && Number.isFinite(layerValue) && layerValue > 0) {
          next.planKat = String(Math.round(layerValue * asortiNum));
        }
      }
      return next;
    });
  };

  const handleAsortiChange = (value: string) => {
    const layerValue = Number.parseFloat(draftReport.atilanKat || '0');
    const asortiNum = Number.parseFloat(value || '0');
    const calculated = Number.isFinite(layerValue) && layerValue > 0 && Number.isFinite(asortiNum) && asortiNum > 0
      ? String(Math.round(layerValue * asortiNum))
      : selectedOrder
        ? calculatePlanKat(selectedOrder.quantity, value)
        : '';

    setDraftReport(prev => ({
      ...prev,
      asortiCount: value,
      planKat: calculated,
    }));
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
      const response = await fetch('/api/fabric-exits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
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
          createdAt: new Date().toISOString(),
        })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Kumaş çıkışı kaydedilemedi.');
      }

      const created = await response.json().catch(() => null);
      setDraftReport(prev => ({
        ...prev,
        fabricExitQuantity: String(Number(prev.fabricExitQuantity || 0) + quantity),
        fabricExitUnit: fabricExitUnit,
      }));
      setFabricExitQuantityDraft('');
      setInfoMessage(`Kumaş çıkışı eklendi: ${quantity} ${fabricExitUnit}.`);
      await refreshFabricExitsForOrder(selectedOrder.orderNo);
      if (created?.id) {
        setFabricExitDetails(created);
      }
    } catch (catchError) {
      console.error(catchError);
      setError(catchError instanceof Error ? catchError.message : 'Kumaş çıkışı kaydedilemedi.');
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
        : (defectiveReasonDraft || 'Kesim hatası');
      const response = await fetch('/api/fabrics/returns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          fabricName,
          quantityKg: quantity,
          reason: reasonWithColor,
          createdBy: token ? 'operator' : null,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || body?.message || 'Hatalı kumaş kaydedilemedi.');
      }

      setDefectiveQuantityDraft('');
      setDefectiveReasonDraft('');
      setInfoMessage(`Hatalı kumaş kaydedildi: ${quantity} kg.`);
    } catch (catchError) {
      console.error(catchError);
      setError(catchError instanceof Error ? catchError.message : 'Hatalı kumaş kaydedilemedi.');
    } finally {
      setDefectiveSubmitting(false);
    }
  };

  const handleToggleChecklistItem = (i: number) => {
    const updated = [...checklist];
    const item = updated[i];
    if (item.checkedBy) {
      updated[i] = { ...item, checkedBy: undefined, checkedAt: undefined };
    } else {
      updated[i] = { ...item, checkedBy: "admin", checkedAt: new Date().toLocaleString("tr-TR") };
    }
    setChecklist(updated);
  };

  const handleSave = async () => {
    if (!selectedOrder) return;
    setSavingOrderId(selectedOrder.id);
    setError(null);

    try {
      const token = getAuthToken();
      const response = await fetch(`/api/fason/work-orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          sewingNotes: mergeSewingNotes(selectedOrder.sewingNotes, draftReport, checklist)
        })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Güncelleme başarısız oldu.');
      }

      const updatedOrder = await response.json();
      setOrders(prev => prev.map(order => order.id === selectedOrder.id ? { ...order, sewingNotes: updatedOrder.sewingNotes || selectedOrder.sewingNotes } : order));
      setInfoMessage('Kesim raporu başarıyla kaydedildi.');
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof Error ? saveError.message : 'Kesim raporu kaydedilemedi.');
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
      const response = await fetch(`/api/fason/work-orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
           sewingNotes: mergeSewingNotes(selectedOrder.sewingNotes, spreadingReport, checklist, {
            machine: mtkRun.machine,
            cuttingTable: selectedMachine?.cuttingTable.name || 'Tanımsız',
            layers: spreadingLayers.filter(layer => layer.color.trim()),
            mode: spreadingMode,
            rolls: rollEntries,
          })
        })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Serim verisi iş emrine alınamadı.');
      }

      const updatedOrder = await response.json();
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
        }
      }));
      setOrders(prev => prev.map(order => order.id === selectedOrder.id
        ? { ...order, sewingNotes: updatedOrder.sewingNotes || mergeSewingNotes(selectedOrder.sewingNotes, spreadingReport, checklist, {
            machine: mtkRun.machine,
            cuttingTable: selectedMachine?.cuttingTable.name || 'Tanımsız',
            layers: spreadingLayers.filter(layer => layer.color.trim()),
            mode: spreadingMode,
            rolls: rollEntries,
          }) }
        : order));
      setInfoMessage(`Serim verileri ${selectedOrder.orderNo} iş emrine alındı.`);
    } catch (saveError) {
      console.error('Serim verisi iş emrine alınamadı:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Serim verisi kaydedilemedi.');
    } finally {
      setSavingOrderId(null);
    }
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
      const response = await fetch(`/api/fason/work-orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          status: 'TESLIM_EDILDI',
          sewingNotes: mergeSewingNotes(selectedOrder.sewingNotes, draftReport, checklist)
        })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Kesim tamamlama işlemi başarısız oldu.');
      }

      setOrders(prev => prev.filter(order => order.id !== selectedOrder.id));
      setSelectedOrderId(null);
      setInfoMessage(`${selectedOrder.orderNo} kesim tamamlandı.`);
    } catch (completeError) {
      console.error('Kesim tamamlama hatası:', completeError);
      setError(completeError instanceof Error ? completeError.message : 'Kesim tamamlama işlemi başarısız oldu.');
    } finally {
      setSavingOrderId(null);
    }
  };

  const currentAsorti = selectedOrder ? Number(draftReport.asortiCount || productAsortiMap.get(selectedOrder.productCode)?.defaultAsortiCount || DEFAULT_ASSORTI_TOTAL) : 0;
  const currentPlanKat = selectedOrder && draftReport.asortiCount
    ? calculatePlanKat(selectedOrder.quantity, draftReport.asortiCount)
    : draftReport.planKat || '—';
  const currentCutFabric = Number(draftReport.fabricExitQuantity || fabricExitInfo?.quantity || 0);
  const fiberExitUnitLabel = fabricExitInfo?.unit === 'mixed' ? 'kg/m' : fabricExitInfo?.unit || draftReport.fabricExitUnit || 'kg';
  const calculatedOutputPieces = useMemo(() => {
    const layers = Number(draftReport.atilanKat || 0);
    const quantity = Number(draftReport.fabricExitQuantity || fabricExitInfo?.quantity || 0);
    if (layers > 0 && quantity > 0) {
      return Math.round(layers * quantity);
    }
    return null;
  }, [draftReport.atilanKat, draftReport.fabricExitQuantity, fabricExitInfo?.quantity]);
  const progressPercent = selectedOrder
    ? Math.min((currentCutFabric / Math.max(selectedOrder.quantity, 1)) * 100, 100)
    : 0;
  const progressComplete = progressPercent >= 99.5;
  const currentTimeLabel = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const currentSizeDistribution = productAsortiMap.get(selectedOrder?.productCode || '')?.sizeChart || DEFAULT_SIZE_DISTRIBUTION;
  const productFabricInfo = productFabrics.get(selectedOrder?.productCode || '');
  const actualGrammage = Number(draftReport.fiiliOrtalamaGramaj || 0);
  const targetGrammage = Number(productFabricInfo?.productAverageGrammage || 0);
  const grammageTargetStatus = targetGrammage > 0 && actualGrammage > 0
    ? Math.abs(actualGrammage - targetGrammage) <= targetGrammage * 0.05 ? 'Hedef tuttu' : 'Hedef dışı'
    : 'Hesap için değer bekleniyor';
  const grammageOnTarget = grammageTargetStatus === 'Hedef tuttu';
  const cuttingWastePercent = targetGrammage > 0 && actualGrammage > 0
    ? Math.max(0, ((targetGrammage - actualGrammage) / targetGrammage) * 100)
    : 0;
  const cuttingWasteGramaj = targetGrammage > 0 && actualGrammage > 0 ? targetGrammage - actualGrammage : 0;
  const sizeDistributionValues = Array(Number(draftReport.asortiCount || currentSizeDistribution.length || DEFAULT_ASSORTI_TOTAL)).fill(1);
  const operatorDisplayName = selectedOrder?.customerName?.trim() || 'Sistem';
  const operatorDisplayInitials = operatorDisplayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('') || 'S';

  const effectiveColorVariants = useMemo(() => {
    if (selectedOrder?.colorVariants && selectedOrder.colorVariants.length > 0) {
      return selectedOrder.colorVariants;
    }
    if (selectedOrder?.productColor) {
      return [selectedOrder.productColor];
    }
    return [];
  }, [selectedOrder?.colorVariants, selectedOrder?.productColor]);

  const isAutoFilled = (field: string) => autoFilledFields.has(field);
  const autoInputStyle = (field: string): React.CSSProperties =>
    isAutoFilled(field)
      ? { ...styles.formInput, ...styles.autoFilledInput }
      : styles.formInput;

  if (loading) {
    return (
      <AuthGuard requireAuth={true} requiredAccess="fason">
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner} />
          <p style={styles.loadingText}>Kesim ekranı yükleniyor...</p>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard requireAuth={true} requiredAccess="fason">
      <div
        ref={pageRef}
        style={{
          ...styles.appShell,
          ...(isDarkMode ? styles.appShellDark : {}),
        }}
        data-cutting-workshop
        data-theme={isDarkMode ? 'dark' : 'light'}
      >
        <header style={styles.topBar}>
          <div style={styles.brandBlock}>
            <div style={styles.brandMark} aria-hidden="true">K</div>
            <div style={styles.brandTitle}>Kesim takip</div>
          </div>

          <div style={styles.topBarActions}>
            <div style={styles.headerMeta}>
              <span style={styles.statusDot} />
              <span>{selectedOrder ? selectedOrder.orderNo : 'İş emri yok'}</span>
              <span style={styles.headerMetaSep}>·</span>
              <span>{currentTimeLabel}</span>
              <span style={styles.headerMetaSep}>·</span>
              <span style={scalePort ? styles.headerMetaOk : undefined}>
                {scalePort ? 'Tartı bağlı' : 'Tartı yok'}
              </span>
            </div>
            <button
              onClick={() => setIsDarkMode(prev => !prev)}
              style={styles.headerTextButton}
              aria-label={isDarkMode ? 'Açık tema' : 'Koyu tema'}
            >
              {isDarkMode ? 'Açık' : 'Koyu'}
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              style={styles.fullscreenButton}
              aria-label={isFullscreen ? 'Tam ekrandan çık' : 'Tam ekran'}
            >
              {isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran'}
            </button>
            <div style={styles.operatorChip}>
              <div style={styles.operatorAvatar}>{operatorDisplayInitials}</div>
              <strong style={styles.operatorName}>{operatorDisplayName}</strong>
            </div>
            <button
              onClick={() => setIsOperatorLocked(prev => !prev)}
              style={{
                ...styles.lockButton,
                backgroundColor: isOperatorLocked ? '#334155' : '#0f766e',
              }}
              aria-label={isOperatorLocked ? 'Ekran kilidini aç' : 'Ekranı kilitle'}
            >
              {isOperatorLocked ? 'Aç' : 'Kilitle'}
            </button>
          </div>
        </header>

        <div style={styles.pageShell} className="cutting-page-shell">
          <section style={styles.pageHeading} className="cutting-page-heading">
            <div style={styles.headingMain}>
              <h1 style={styles.headingTitle}>Kesim operasyonu</h1>
              {selectedOrder ? (
                <p style={styles.headingNote}>
                  Teslim {formatDate(selectedOrder.deliveryDate)}
                  {' · '}
                  {selectedOrder.customerName || 'Müşteri yok'}
                </p>
              ) : (
                <p style={styles.headingNote}>İş emri seçin, raporu tamamlayın.</p>
              )}
            </div>
            <div style={styles.headingActions}>
              <button
                onClick={handlePrintReport}
                style={styles.secondaryButton}
                disabled={!selectedOrder}
              >
                Yazdır
              </button>
              <button onClick={() => loadOrders(true)} style={styles.secondaryButton}>
                Yenile
              </button>
            </div>
          </section>

          <div style={styles.dashboardGrid} className="cutting-dashboard-grid">
            <aside style={styles.panel}>
              <div style={styles.panelHeader}>
                <div>
                  <p style={styles.panelKicker}>PLANLAMA</p>
                  <h2 style={styles.panelTitle}>İş emirleri <span style={styles.countBadge}>{orders.length}</span></h2>
                </div>
              </div>

              <div style={styles.searchBox}>
                <input
                  ref={barcodeInputRef}
                  value={barcodeInput}
                  onChange={e => setBarcodeInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleBarcodeLookup();
                  }}
                  placeholder="Barkod veya iş emri no..."
                  aria-label="Barkod veya iş emri ara"
                  style={styles.searchInput}
                  autoFocus
                />
              </div>

              <div style={styles.orderList}>
                {orders.filter(order => {
                  const term = barcodeInput.trim().toLowerCase();
                  if (!term) return true;
                  return [order.orderNo, order.productCode, order.productName, order.customerName].some(value =>
                    (value || '').toLowerCase().includes(term)
                  );
                }).map(order => (
                  <button
                    key={order.id}
                    onClick={() => handleSelectOrder(order.id)}
                    style={{
                      ...styles.orderItem,
                      ...(selectedOrderId === order.id ? styles.orderItemSelected : {}),
                    }}
                  >
                    <div style={styles.orderItemTop}>
                      <span style={{
                        ...styles.statusLabel,
                        ...(order.status === 'BEKLIYOR' ? styles.statusAmber : order.status === 'TESLIM_EDILDI' ? styles.statusGreen : styles.statusBlue)
                      }}>{order.status}</span>
                      <span style={styles.orderTime}>{formatDate(order.deliveryDate)}</span>
                    </div>
                    <strong style={styles.orderId}>{order.orderNo}</strong>
                    <span style={styles.orderProduct}>{order.productName}</span>
                    <div style={styles.orderMeta}>
                      <span>{order.customerName || '-'}</span>
                      <span>{order.quantity} adet</span>
                    </div>
                    <div style={styles.miniProgress}>
                      <span style={{
                        width: order.status === 'TESLIM_EDILDI' ? '100%' : order.status === 'BEKLIYOR' ? '12%' : '45%',
                        background: order.status === 'TESLIM_EDILDI' ? '#22c55e' : order.status === 'BEKLIYOR' ? '#f59e0b' : '#3b82f6',
                      }} />
                    </div>
                    <span style={styles.orderChevron}>›</span>
                  </button>
                ))}
              </div>

              <div style={styles.panelFooter}>Senkronize</div>
            </aside>

            <section style={styles.centerColumn}>
              <div style={styles.workPanel}>
                {selectedOrder ? (
                  <>
                    <div style={styles.workTop}>
                      <div>
                        <div style={styles.workLabel}>Aktif iş emri</div>
                        <h2 style={styles.workTitle}>{selectedOrder.orderNo}</h2>
                        <p style={styles.workMetaText}>{selectedOrder.customerName} <span style={styles.metaDivider}>·</span> {selectedOrder.productName}</p>
                      </div>
                      <div style={styles.workActions}>
                        <span style={{
                          ...styles.statusLabel,
                          ...(selectedOrder.status === 'BEKLIYOR' ? styles.statusAmber : selectedOrder.status === 'TESLIM_EDILDI' ? styles.statusGreen : styles.statusBlue)
                        }}>{selectedOrder.status}</span>
                        <span style={styles.updatedText}>{selectedOrder.productCode || 'Kod yok'}</span>
                      </div>
                    </div>

                    <div style={styles.progressArea}>
                      <div style={styles.progressHeading}>
                        <span>Kesim ilerlemesi</span>
                        <strong style={{ color: progressComplete ? '#059669' : undefined }}>
                          {progressPercent.toFixed(0)}%
                          {progressComplete ? ' ✓' : ''}
                        </strong>
                      </div>
                      <div style={styles.largeProgress}>
                        <span style={{
                          width: `${progressPercent}%`,
                          background: progressComplete
                            ? 'linear-gradient(90deg, #059669, #34d399)'
                            : 'linear-gradient(90deg, #2563eb, #38bdf8)',
                          transition: 'width 400ms ease',
                        }} />
                      </div>
                      <div style={styles.progressCaption}>
                        <span>Seçim <b>{selectedOrder.orderNo}</b></span>
                        <span>Son güncelleme <b>{currentTimeLabel}</b></span>
                        <span>Son teslim <b>{formatDate(selectedOrder.deliveryDate)}</b></span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRequestComplete}
                        disabled={isOperatorLocked || savingOrderId === selectedOrder.id || selectedOrder.status === 'TESLIM_EDILDI'}
                        style={{
                          ...styles.completeCuttingButton,
                          opacity: isOperatorLocked || savingOrderId === selectedOrder.id || selectedOrder.status === 'TESLIM_EDILDI' ? 0.55 : 1,
                          cursor: isOperatorLocked || savingOrderId === selectedOrder.id || selectedOrder.status === 'TESLIM_EDILDI' ? 'not-allowed' : 'pointer',
                          marginTop: '12px',
                        }}
                      >
                        {savingOrderId === selectedOrder.id ? 'İşleniyor...' : selectedOrder.status === 'TESLIM_EDILDI' ? 'Tamamlandı' : 'Kesimi Tamamla'}
                      </button>
                    </div>

                    <div style={styles.metricGrid} className="cutting-metric-grid">
                      <MetricCard label="Toplam adet" value={`${selectedOrder.quantity}`} unit="adet" />
                      <MetricCard label="Plan kat" value={String(currentPlanKat || currentAsorti || 0)} unit="kat" />
                      <MetricCard label="Kesilen" value={String(currentCutFabric || 0)} unit={fiberExitUnitLabel} />
                      <MetricCard label="Kumaş eni" value={draftReport.fiiliOrtalamaKumasEni || '—'} unit="cm" />
                    </div>

                    <div style={styles.assortSummaryBox}>
                      <div style={styles.assortSummaryHeader}>Asorti beden dağılımı</div>
                      <div style={styles.assortEditGrid}>
                        {currentSizeDistribution.map(size => (
                          <div key={size} style={styles.assortEditCell}>
                            <span style={styles.assortSize}>{size}</span>
                            <input
                              type="number"
                              min="0"
                              value={sizeCounts[size] ?? 1}
                              onChange={e => handleSizeCountChange(size, e.target.value)}
                              style={styles.assortEditInput}
                              disabled={isOperatorLocked}
                              aria-label={`${size} adet`}
                            />
                          </div>
                        ))}
                      </div>
                       <div style={styles.assortResultText}>
                         {currentAsorti || currentSizeDistribution.length || DEFAULT_ASSORTI_TOTAL} asorti
                         {' / '}
                         {currentSizeDistribution.join(' ')}
                         {' · '}
                         {currentPlanKat || '—'} plan kat
                         {' · '}
                         toplam {Object.values(sizeCounts).reduce((s, n) => s + n, 0)}
                       </div>
                    </div>
                  </>
                ) : (
                  <div style={styles.emptyState}>
                    <h3 style={styles.emptyStateTitle}>İş emri seçilmedi</h3>
                    <p style={styles.emptyStateText}>
                      Sol listeden bir iş emri seçin veya barkod / iş emri numarasını okutun.
                    </p>
                  </div>
                )}
              </div>

              <div style={styles.panel}>
                <button
                  type="button"
                  onClick={() => setDetailsOpen(prev => !prev)}
                  style={styles.accordionHeader}
                  aria-expanded={detailsOpen}
                  disabled={!selectedOrder}
                >
                  <div>
                    <p style={styles.panelKicker}>DETAY</p>
                    <h2 style={styles.panelTitle}>
                      {selectedOrder ? 'Üretim özeti' : 'Üretim bilgileri'}
                    </h2>
                  </div>
                  <span style={styles.accordionChevron}>{detailsOpen ? '−' : '+'}</span>
                </button>

                {selectedOrder ? (
                  <>
                    <div style={styles.detailSummaryRow}>
                      <span>{productFabrics.get(selectedOrder.productCode)?.name || 'Kumaş yok'}</span>
                      <span style={styles.metaDivider}>·</span>
                      <span>{selectedOrder.productColor || '—'}</span>
                      <span style={styles.metaDivider}>·</span>
                      <span style={{
                        color: grammageOnTarget ? '#059669' : grammageTargetStatus === 'Hedef dışı' ? '#dc2626' : undefined,
                        fontWeight: 700,
                      }}>
                        {grammageTargetStatus}
                      </span>
                    </div>
                    {detailsOpen && (
                      <div style={styles.accordionBody}>
                         <div style={styles.detailGrid}>
                           <DetailBox label="Kumaş türü" value={productFabrics.get(selectedOrder.productCode)?.name || '—'} />
                           <DetailBox label="Stok" value={productAsortiMap.get(selectedOrder.productCode)?.fabricStockQuantity != null ? `${productAsortiMap.get(selectedOrder.productCode)?.fabricStockQuantity} ${productAsortiMap.get(selectedOrder.productCode)?.fabricUnit || 'kg'}` : '—'} />
                           <DetailBox label="Renk" value={selectedOrder.productColor || '-'} swatch />
                            <DetailBox label="Atılan kat" value={draftReport.atilanKat || '—'} />
                            {calculatedOutputPieces && (
                              <DetailBox label="Çıkan adet" value={`${calculatedOutputPieces} adet`} highlight="success" />
                            )}
                            <DetailBox label="Kesim masası" value={fabricExitDetails?.cuttingTable?.name || selectedOrder.fasonTrackings.find(t => t.processType === 'KESIM')?.workshop?.name || 'Henüz atanmamış'} />
                           <DetailBox label="Çıkış belge no" value={fabricExitLoading ? 'Yükleniyor...' : (fabricExitInfo?.reportNumber || '—')} mono />
                           <DetailBox label="Kalıp no" value={selectedOrder.productCode || '—'} mono />
                           <DetailBox label="Hedef gramaj" value={productFabricInfo?.productAverageGrammage ? `${productFabricInfo.productAverageGrammage} g/m²` : '—'} />
                           <DetailBox label="Fiili gramaj" value={actualGrammage > 0 ? `${actualGrammage} g/m²` : '—'} />
                           <DetailBox label="Kumaş ort. gramaj" value={productFabricInfo?.averageGrammage ? `${productFabricInfo.averageGrammage} g/m²` : '—'} />
                            <DetailBox
                              label="Gramaj hedefi"
                              value={grammageTargetStatus}
                              highlight={grammageOnTarget ? 'success' : grammageTargetStatus === 'Hedef dışı' ? 'danger' : undefined}
                            />
                            {cuttingWastePercent > 0 && (
                              <DetailBox
                                label="Kesim firesi"
                                value={`%${cuttingWastePercent.toFixed(1)} · ${cuttingWasteGramaj > 0 ? '+' : ''}${cuttingWasteGramaj.toFixed(1)}`}
                                highlight="danger"
                              />
                            )}
                          </div>
                        <div style={styles.barcodeStrip}>
                          <span style={styles.barcodeText}>{selectedOrder.orderNo}</span>
                          <small style={styles.barcodeSmall}>İş emri</small>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={styles.emptyStateCompact}>
                    <p>Detayları görmek için bir iş emri seçin.</p>
                  </div>
                )}
              </div>
            </section>

            <aside style={styles.reportPanel}>
              <div style={styles.reportHeading}>
                <div>
                  <p style={styles.panelKicker}>KAYIT</p>
                  <h2 style={styles.panelTitle}>Kesim raporu</h2>
                </div>
              </div>

              {selectedOrder ? (
                <div style={styles.formContent}>
                  {/* GRUP 1: Zorunlu ölçümler */}
                  <div style={styles.formGroup}>
                    <div style={styles.formGroupTitle}>Ölçüm</div>

                    <div style={styles.formTwoCol}>
                      <label style={styles.fieldLabel}>
                        <span style={styles.fieldLabelRow}>
                          Kesilen
                          {isAutoFilled('fabricExitQuantity') && <span style={styles.autoBadge}>oto</span>}
                        </span>
                        <input
                          value={draftReport.fabricExitQuantity || fabricExitInfo?.quantity || ''}
                          onChange={e => handleInputChange('fabricExitQuantity', e.target.value)}
                          inputMode="numeric"
                          style={autoInputStyle('fabricExitQuantity')}
                          disabled={isOperatorLocked}
                        />
                      </label>
                      <label style={styles.fieldLabel}>
                        <span style={styles.fieldLabelRow}>
                          Atılan kat
                          {isAutoFilled('atilanKat') && <span style={styles.autoBadge}>oto</span>}
                        </span>
                        <input
                          value={draftReport.atilanKat}
                          onChange={e => handleInputChange('atilanKat', e.target.value)}
                          inputMode="numeric"
                          style={autoInputStyle('atilanKat')}
                          disabled={isOperatorLocked}
                        />
                      </label>
                    </div>

                    <div style={styles.formTwoCol}>
                      <label style={styles.fieldLabel}>
                        Asorti
                        <input
                          value={draftReport.asortiCount}
                          onChange={e => handleAsortiChange(e.target.value)}
                          inputMode="numeric"
                          style={styles.formInput}
                          disabled={isOperatorLocked}
                        />
                      </label>
                      <label style={styles.fieldLabel}>
                        Plan kat
                        <input
                          value={draftReport.planKat}
                          readOnly
                          style={{ ...styles.formInput, backgroundColor: '#f3f6fb' }}
                        />
                      </label>
                     </div>

                      {calculatedOutputPieces && (
                        <div style={{ ...styles.fieldLabel, fontSize: 12, marginTop: 8 }}>
                          <span style={styles.fieldLabelRow}>Çıkan adet</span>
                          <div style={{ ...styles.formInput, backgroundColor: '#f3f6fb', color: 'oklch(0.22 0.035 220)', fontSize: 14, fontWeight: 700, minHeight: 36, display: 'flex', alignItems: 'center' }}>
                            {calculatedOutputPieces} adet
                          </div>
                        </div>
                      )}

                      <label style={styles.fieldLabel}>
                        <span style={styles.fieldLabelRow}>
                          Kumaş eni (cm)
                         {isAutoFilled('fiiliOrtalamaKumasEni') && <span style={styles.autoBadge}>oto</span>}
                       </span>
                       <input
                         value={draftReport.fiiliOrtalamaKumasEni}
                         onChange={e => handleInputChange('fiiliOrtalamaKumasEni', e.target.value)}
                         inputMode="decimal"
                         style={autoInputStyle('fiiliOrtalamaKumasEni')}
                         disabled={isOperatorLocked}
                       />
                     </label>

                     <label style={styles.fieldLabel}>
                       <span style={styles.fieldLabelRow}>
                         Birim gramaj (g/m²)
                         {isAutoFilled('fiiliOrtalamaGramaj') && <span style={styles.autoBadge}>oto</span>}
                       </span>
                       <input
                         value={draftReport.fiiliOrtalamaGramaj}
                         readOnly
                         style={{ ...styles.formInput, backgroundColor: '#f3f6fb', color: 'oklch(0.22 0.035 220)' }}
                         disabled={isOperatorLocked}
                       />
                     </label>

                    <div style={styles.fabricExitInlinePanel}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                        <button
                          onClick={handleConnectScale}
                          disabled={isOperatorLocked || scaleConnecting}
                          style={{
                            ...styles.smallAddButton,
                            flex: 1,
                            minHeight: 44,
                            fontSize: 13,
                            background: scalePort ? '#059669' : '#2563eb',
                          }}
                        >
                          {scaleConnecting ? 'Bağlanıyor...' : scalePort ? 'Tartı bağlı' : 'Tartı bağla'}
                        </button>
                         <button
                           onClick={handleReadScale}
                           disabled={isOperatorLocked}
                           style={{
                            ...styles.smallAddButton,
                            flex: 1,
                            minHeight: 44,
                            fontSize: 13,
                            background: '#0f766e',
                          }}
                        >
                          Tartıdan al
                        </button>
                        {scalePort && (
                          <button
                            onClick={handleDisconnectScale}
                            disabled={isOperatorLocked}
                            style={{
                              ...styles.smallAddButton,
                              minWidth: 64,
                              minHeight: 44,
                              fontSize: 13,
                              background: '#dc2626',
                            }}
                          >
                            Kes
                          </button>
                        )}
                      </div>

                      <label style={{ ...styles.fieldLabel, fontSize: 12 }}>
                        Kumaş çıkışı ekle
                        <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'flex-end' }}>
                          <input
                            value={fabricExitQuantityDraft}
                            onChange={e => setFabricExitQuantityDraft(e.target.value)}
                            inputMode="decimal"
                            placeholder="0.000"
                            style={{ ...styles.formInput, flex: 1, minHeight: 44, fontSize: 16, fontWeight: 700 }}
                            disabled={isOperatorLocked}
                          />
                          <select
                            value={fabricExitUnit}
                            onChange={e => setFabricExitUnit(e.target.value as 'kg' | 'm')}
                            style={{ ...styles.formInput, width: 72, minHeight: 44, fontSize: 14 }}
                            disabled={isOperatorLocked}
                          >
                            <option value="kg">kg</option>
                            <option value="m">m</option>
                          </select>
                          <button
                            onClick={handleCreateFabricExit}
                            style={{
                              ...styles.smallAddButton,
                              minWidth: 72,
                              minHeight: 44,
                              fontSize: 13,
                            }}
                            disabled={isOperatorLocked || fabricExitCreating}
                          >
                            {fabricExitCreating ? '...' : 'Ekle'}
                          </button>
                        </div>
                      </label>
                      {scaleReading && (
                        <div style={{ marginTop: 6, fontSize: 12, color: '#0f766e' }}>
                          Son okuma: {scaleReading.weight.toFixed(3)} kg {scaleReading.stable ? '(stabil)' : '(kararsız)'}
                        </div>
                      )}
                      {scaleReadings.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Tartı geçmişi ({scaleReadings.length})</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 150, overflowY: 'auto' }}>
                            {scaleReadings.map((entry, i) => (
                                <div
                                 key={`${entry.time}-${i}`}
                                 style={{
                                   fontSize: 11,
                                   color: '#1e293b',
                                   padding: '4px 8px',
                                   borderRadius: 4,
                                   background: entry.reading.stable ? '#dcfce7' : '#fef9c4',
                                   border: `1px solid ${entry.reading.stable ? '#a7f3d0' : '#fef08a'}`,
                                 }}
                               >
                                 {entry.time} · {entry.reading.weight.toFixed(3)} kg {entry.reading.stable ? '(stabil)' : '(kararsız)'} {entry.usedFor ? `· ${entry.usedFor}` : ''}
                               </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                     <div style={styles.fabricInfoBar}>
                       <span style={styles.fabricInfoLabel}>Birim</span>
                       <span style={styles.fabricInfoValue}>{productAsortiMap.get(selectedOrder.productCode)?.fabricUnit === 'kg' ? 'kg' : 'm'}</span>
                       <span style={styles.fabricInfoDivider}>·</span>
                       <span style={styles.fabricInfoLabel}>Stok</span>
                       <span style={styles.fabricInfoValue}>{productAsortiMap.get(selectedOrder.productCode)?.fabricStockQuantity ?? '—'}</span>
                     </div>

<div style={{ ...styles.fabricInfoBar, marginTop: 8, borderTop: '1px dashed #e5e7eb', paddingTop: 10 }}>
                        {effectiveColorVariants.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ ...styles.fabricInfoLabel, color: '#b91c1c', minWidth: 100 }}>Renk varyantı</span>
                            <select
                              value={defectiveColorVariant}
                              onChange={e => setDefectiveColorVariant(e.target.value)}
                              disabled={isOperatorLocked || defectiveSubmitting}
                              style={{ ...styles.formInput, minWidth: 140, minHeight: 36 }}
                            >
                              {effectiveColorVariants.map(color => (
                                <option key={color} value={color}>{color}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        <span style={{ ...styles.fabricInfoLabel, color: '#b91c1c' }}>Hatalı kumaş (kg)</span>
                       <input
                         value={defectiveQuantityDraft}
                         onChange={e => setDefectiveQuantityDraft(e.target.value)}
                         inputMode="decimal"
                         placeholder="0.000"
                         style={{ ...styles.formInput, width: 120, minHeight: 36, fontSize: 14, fontWeight: 700 }}
                         disabled={isOperatorLocked || defectiveSubmitting}
                       />
                       <input
                         value={defectiveReasonDraft}
                         onChange={e => setDefectiveReasonDraft(e.target.value)}
                         placeholder="Neden"
                         style={{ ...styles.formInput, flex: 1, minHeight: 36, fontSize: 13 }}
                         disabled={isOperatorLocked || defectiveSubmitting}
                       />
                       <button
                         type="button"
                         onClick={handleCreateDefectiveFabric}
                         disabled={isOperatorLocked || defectiveSubmitting}
                         style={{
                           ...styles.smallAddButton,
                           minWidth: 64,
                           minHeight: 36,
                           fontSize: 12,
                           background: '#dc2626',
                           color: '#fff',
                         }}
                       >
                         {defectiveSubmitting ? '...' : 'İade'}
                       </button>
                     </div>
                   </div>

                  {/* GRUP 2: Notlar & kontrol (accordion) */}
                  <div style={styles.formGroup}>
                    <button
                      type="button"
                      onClick={() => setNotesOpen(prev => !prev)}
                      style={styles.formAccordionToggle}
                      aria-expanded={notesOpen}
                    >
                      <span style={styles.formGroupTitle}>Notlar ve kontrol</span>
                      <span style={styles.accordionChevron}>{notesOpen ? '−' : '+'}</span>
                    </button>
                    {notesOpen && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <label style={styles.fieldLabel}>
                          Operatör notu
                          <textarea
                            value={draftReport.aciklama}
                            onChange={e => handleInputChange('aciklama', e.target.value)}
                            placeholder="Not ekleyin..."
                            style={{ ...styles.formInput, ...styles.textarea }}
                            disabled={isOperatorLocked}
                          />
                        </label>
                        <div style={styles.quickNotesRow}>
                          {QUICK_NOTES.map(note => (
                            <button
                              key={note}
                              type="button"
                              onClick={() => appendQuickNote(note)}
                              disabled={isOperatorLocked}
                              style={styles.quickNoteChip}
                            >
                              {note}
                            </button>
                          ))}
                        </div>
                        <div style={styles.checklist}>
                          <div style={styles.checklistTitleRow}>
                            <span style={styles.checklistTitleText}>Kontrol</span>
                            <small style={styles.checklistCount}>
                              {checklist.filter(item => item.checkedBy).length}/{checklist.length || 0}
                            </small>
                          </div>
                          {checklist.length > 0 ? checklist.map((item, index) => (
                            <button
                              key={`${item.text}-${index}`}
                              onClick={() => handleToggleChecklistItem(index)}
                              style={{
                                ...styles.checkRow,
                                ...(item.checkedBy ? styles.checkRowChecked : {})
                              }}
                              disabled={isOperatorLocked}
                            >
                              <span style={{
                                ...styles.checkBox,
                                ...(item.checkedBy ? styles.checkBoxChecked : {})
                              }}>{item.checkedBy ? '✓' : ''}</span>
                              {item.text}
                            </button>
                          )) : (
                            <div style={styles.emptyChecklist}>Kontrol listesi yok.</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={styles.stickySaveBar}>
                    <button
                      onClick={handleSave}
                      style={{
                        ...styles.saveButton,
                        opacity: isOperatorLocked ? 0.55 : 1,
                        cursor: isOperatorLocked ? 'not-allowed' : 'pointer'
                      }}
                      disabled={savingOrderId === selectedOrder.id || isOperatorLocked}
                    >
                      {savingOrderId === selectedOrder.id ? 'Kaydediliyor...' : 'Raporu kaydet'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={styles.emptyStateCompact}>
                  <p>Rapor formunu doldurmak için sol listeden bir iş emri seçin.</p>
                </div>
              )}
            </aside>
          </div>

          {/* Serim paneli — altta, daraltılabilir */}
          <section style={{ ...styles.panel, ...styles.spreadingDock, marginTop: '18px' }}>
            <button
              type="button"
              onClick={() => setSpreadingPanelOpen(prev => !prev)}
              style={styles.spreadingToggle}
              aria-expanded={spreadingPanelOpen}
            >
              <div style={styles.spreadingToggleLeft}>
                <span
                  style={{
                    ...styles.statusLight,
                    ...(spreadingCompleted
                      ? styles.statusLightCompleted
                      : spreadingStarted
                        ? styles.statusLightRunning
                        : styles.statusLightIdle),
                  }}
                />
                <div>
                  <p style={styles.panelKicker}>SERİM / MAKİNE</p>
                  <h2 style={styles.panelTitle}>
                    Makine verisi{' '}
                    <span style={isDemoMode ? styles.demoBadge : styles.liveBadge}>
                      {isDemoMode ? 'DEMO' : 'CANLI'}
                    </span>
                  </h2>
                </div>
              </div>
              <div style={styles.spreadingToggleRight}>
                <strong style={styles.spreadingToggleStatus}>
                  {spreadingCompleted ? 'Tamamlandı' : spreadingStarted ? 'Devam ediyor' : 'Başlatılmadı'}
                </strong>
                <span style={styles.spreadingChevron}>{spreadingPanelOpen ? '−' : '+'}</span>
              </div>
            </button>

            {spreadingPanelOpen && (
              <div style={styles.spreadingBody}>
                <div style={styles.spreadingControls}>
                  <label style={styles.spreadingMachineField}>
                    <span>Serim makinesi</span>
                    <select
                      value={selectedMachineId ?? ''}
                      onChange={event => setSelectedMachineId(event.target.value ? Number(event.target.value) : null)}
                      disabled={spreadingStarted || isOperatorLocked}
                      style={styles.formInput}
                    >
                      <option value="">Makine seçin</option>
                      {spreadingMachines.map(machine => (
                        <option key={machine.id} value={machine.id}>
                          {machine.name} · {machine.cuttingTable.name}
                        </option>
                      ))}
                    </select>
                  </label>
                   {selectedOrder?.colorVariants && selectedOrder.colorVariants.length > 0 && (
                     <label style={styles.spreadingMachineField}>
                       <span>Renk varyantı</span>
                       <select
                         value={selectedColorVariant}
                         onChange={event => setSelectedColorVariant(event.target.value)}
                         disabled={spreadingStarted || isOperatorLocked}
                         style={styles.formInput}
                       >
                         {selectedOrder.colorVariants.map(color => (
                           <option key={color} value={color}>{color}</option>
                         ))}
                       </select>
                     </label>
                   )}
                   <label style={styles.spreadingMachineField}>
                     <span>Çalışma modu</span>
                     <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                       <button
                         type="button"
                         onClick={() => { setSpreadingMode('weight-first'); setRollEntries([]); }}
                         disabled={spreadingStarted || isOperatorLocked}
                         style={{
                           ...styles.modeToggleButton,
                           ...(spreadingMode === 'weight-first' ? styles.modeToggleButtonActive : styles.modeToggleButtonInactive),
                         }}
                       >
                         Tartı → Serim
                       </button>
                       <button
                         type="button"
                         onClick={() => setSpreadingMode('spread-then-weight')}
                         disabled={spreadingStarted || isOperatorLocked}
                         style={{
                           ...styles.modeToggleButton,
                           ...(spreadingMode === 'spread-then-weight' ? styles.modeToggleButtonActive : styles.modeToggleButtonInactive),
                         }}
                       >
                         Serim → Tartı
                       </button>
                     </div>
                   </label>
                   {spreadingMode === 'weight-first' && (
                     <label style={{ ...styles.spreadingMachineField, marginTop: 8 }}>
                       <span>Kat hesabı (gramaj / en / uzunluk)</span>
                       <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                         <input
                           type="number"
                           min="0"
                           step="0.1"
                           value={weightCalcInputs.gramaje || ''}
                           onChange={e => handleWeightCalcInputChange('gramaje', e.target.value)}
                           placeholder="g/m²"
                           style={{ ...styles.formInput, flex: 1, minHeight: 36, fontSize: 13 }}
                           disabled={isOperatorLocked}
                         />
                         <input
                           type="number"
                           min="0"
                           step="1"
                           value={weightCalcInputs.widthCm || ''}
                           onChange={e => handleWeightCalcInputChange('widthCm', e.target.value)}
                           placeholder="cm"
                           style={{ ...styles.formInput, flex: 1, minHeight: 36, fontSize: 13 }}
                           disabled={isOperatorLocked}
                         />
                         <input
                           type="number"
                           min="0"
                           step="0.01"
                           value={weightCalcInputs.lengthM || ''}
                           onChange={e => handleWeightCalcInputChange('lengthM', e.target.value)}
                           placeholder="m"
                           style={{ ...styles.formInput, flex: 1, minHeight: 36, fontSize: 13 }}
                           disabled={isOperatorLocked}
                         />
                       </div>
                     </label>
                   )}
                   <button
                     onClick={handleStartSpreading}
                     disabled={!selectedOrder || !selectedMachine || spreadingStarted || isOperatorLocked}
                     style={{
                       ...styles.startSpreadingButton,
                       opacity: !selectedOrder || !selectedMachine || spreadingStarted || isOperatorLocked ? 0.55 : 1,
                     }}
                   >
                    {spreadingStarted ? 'Serim başladı' : 'Serimi başlat'}
                  </button>
                </div>
                 {selectedMachine ? (
                   <div style={styles.machineBinding}>
                     Bağlı kesim masası: <strong>{selectedMachine.cuttingTable.name}</strong>
                   </div>
                 ) : null}
                 {spreadingMode === 'weight-first' && selectedOrder && (
                   <div style={styles.rollEntrySection}>
                     <div style={styles.rollEntryHeader}>
                       <span>Top / Kat takibi (Tartı → Serim)</span>
                       <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={handleReadScaleForSpreading}
                            disabled={isOperatorLocked || !selectedOrder}
                            style={{
                              ...styles.smallAddButton,
                              flex: 1,
                              minHeight: 36,
                              fontSize: 12,
                              background: '#0f766e',
                            }}
                          >
                            {scalePort ? 'Tartıdan top ekle' : 'Tartıdan top ekle (demo)'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const w = prompt('Top ağırlığını girin (kg):', '30');
                              if (w) handleAddRollManual(Number(w));
                            }}
                            disabled={!selectedOrder || isOperatorLocked}
                            style={{
                              ...styles.smallAddButton,
                              flex: 1,
                              minHeight: 36,
                              fontSize: 12,
                              background: '#2563eb',
                            }}
                          >
                            Top ekle
                          </button>
                          {rollEntries.length > 0 && (
                            <button
                              type="button"
                              onClick={handleClearRollEntries}
                              disabled={isOperatorLocked}
                              style={{
                                ...styles.smallAddButton,
                                minWidth: 64,
                                minHeight: 36,
                                fontSize: 12,
                                background: '#dc2626',
                              }}
                            >
                              Temizle
                            </button>
                          )}
                        </div>
                     </div>
                     {rollEntries.length > 0 ? (
                       <div>
                         {Array.from(rollTotalsByColor.entries()).map(([color, totals]) => (
                           <div key={color} style={styles.rollColorGroup}>
                             <div style={styles.rollColorHeader}>
                               <strong style={styles.rollColorName}>{color}</strong>
                               <span style={styles.rollColorTotal}>
                                 {totals.rolls} top · {totals.weightKg.toFixed(2)} kg · {totals.layers} kat
                               </span>
                             </div>
                             {rollEntries.filter(r => (r.color || 'Renk bekleniyor') === color).map(roll => (
                               <div key={roll.id} style={styles.rollEntryRow}>
                                 <span style={styles.rollEntryColor}>{roll.color || 'Renk bekleniyor'}</span>
                                 <span style={styles.rollEntryNumber}>{roll.rollNumber}. top</span>
                                 <span style={styles.rollEntryWeight}>{roll.weightKg.toFixed(2)} kg</span>
                                 <span style={styles.rollEntryLayers}>{roll.calculatedLayers} kat</span>
                                 <button
                                   type="button"
                                   onClick={() => handleRemoveRollEntry(roll.id)}
                                   disabled={isOperatorLocked}
                                   style={styles.rollRemoveButton}
                                   aria-label="Topu sil"
                                 >
                                   ×
                                 </button>
                               </div>
                             ))}
                           </div>
                         ))}
                         <div style={styles.rollGrandTotal}>
                           Toplam: {totalRolls} top · {totalRollWeightKg.toFixed(2)} kg · {totalRollLayers} kat
                         </div>
                       </div>
                     ) : (
                       <div style={styles.rollEmpty}>
                         Top eklenmedi. Tartı bağlanıp "Tartıdan top ekle" veya "Top ekle" butonunu kullanın.
                       </div>
                     )}
                   </div>
                  )}
                  {spreadingMode === 'spread-then-weight' && selectedOrder && (
                    <div style={styles.rollEntrySection}>
                      <div style={styles.rollEntryHeader}>
                        <span>Top / Metre takibi (Serim → Tartı)</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => {
                              const w = prompt('Top metre sayısını girin:', '200');
                              if (w) handleAddRollByMeter(Number(w));
                            }}
                            disabled={!selectedOrder || isOperatorLocked}
                            style={{
                              ...styles.smallAddButton,
                              flex: 1,
                              minHeight: 36,
                              fontSize: 12,
                              background: '#2563eb',
                            }}
                          >
                            Top ekle (m)
                          </button>
                          {rollEntries.length > 0 && (
                            <button
                              type="button"
                              onClick={handleClearRollEntries}
                              disabled={isOperatorLocked}
                              style={{
                                ...styles.smallAddButton,
                                minWidth: 64,
                                minHeight: 36,
                                fontSize: 12,
                                background: '#dc2626',
                              }}
                            >
                              Temizle
                            </button>
                          )}
                        </div>
                      </div>
                      {rollEntries.length > 0 ? (
                        <div>
                          {Array.from(rollTotalsByColor.entries()).map(([color, totals]) => (
                            <div key={color} style={styles.rollColorGroup}>
                              <div style={styles.rollColorHeader}>
                                <strong style={styles.rollColorName}>{color}</strong>
                                <span style={styles.rollColorTotal}>
                                  {totals.rolls} top · {totals.weightKg.toFixed(2)} kg · {totals.layers} kat · {totals.pieceCount} m
                                </span>
                              </div>
                              {rollEntries.filter(r => (r.color || 'Renk bekleniyor') === color).map(roll => (
                                <div key={roll.id} style={styles.rollEntryRow}>
                                  <span style={styles.rollEntryColor}>{roll.color || 'Renk bekleniyor'}</span>
                                  <span style={styles.rollEntryNumber}>{roll.rollNumber}. top</span>
                                  <span style={styles.rollEntryWeight}>{roll.calculatedLayers} kat</span>
                                  <span style={styles.rollEntryLayers}>{roll.pieceCount.toFixed(0)} m</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveRollEntry(roll.id)}
                                    disabled={isOperatorLocked}
                                    style={styles.rollRemoveButton}
                                    aria-label="Topu sil"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          ))}
                          <div style={styles.rollGrandTotal}>
                            Toplam: {totalRolls} top · {totalRollWeightKg.toFixed(2)} kg · {totalRollLayers} kat · {totalRollMeters.toFixed(1)} m
                          </div>
                          <div style={{ marginTop: 12, padding: 8, backgroundColor: '#f0fdf4', borderRadius: 6, fontSize: 13 }}>
                            <strong>Hesaplama:</strong> Tek kat alanı (m²) = En (m) × Boy (m). Tek kat ağırlığı = Alan × Gramaj / 1000. Toplam kat ağırlığı = Tek kat × Kat sayısı.
                          </div>
                        </div>
                      ) : (
                        <div style={styles.rollEmpty}>
                          Top eklenmedi. Metre girerek "Top ekle (m)" butonunu kullanın.
                        </div>
                      )}
                    </div>
                  )}
                  {mtkError ? (
                   <div style={styles.autoFillLine}>{mtkError} Gateway ve PLC bağlantısını kontrol edin.</div>
                 ) : (
                   <div>
                    <div style={styles.metricGrid} className="cutting-metric-grid">
                      <MetricCard label="Makine" value={mtkRun.machine} unit={mtkRun.status} />
                      <MetricCard label="Anlık kat" value={String(mtkRun.currentLayer ?? '—')} unit={`/ ${mtkRun.layerSet ?? '—'}`} />
                      <MetricCard label="Pastal" value={String(mtkRun.pastelMeter ?? '—')} unit="m" />
                      <MetricCard label="En" value={String(mtkRun.widthCm ?? '—')} unit="cm" />
                    </div>
                    <div style={styles.layerPanel}>
                      <div style={styles.layerPanelHeader}>
                        <strong>Kat / kg / adet</strong>
                        <button
                          type="button"
                          onClick={() => setSpreadingLayers(prev => [...prev, {
                            color: selectedColorVariant,
                            layerNumber: prev.length + 1,
                            weightKg: 0,
                            pieceCount: 0,
                          }])}
                          disabled={!spreadingStarted || isOperatorLocked}
                          style={styles.addLayerButton}
                        >
                          + Kat
                        </button>
                      </div>
                      <div style={styles.layerHeaderRow} className="cutting-layer-row">
                        <span>Renk</span>
                        <span>Kat</span>
                        <span>Kg</span>
                        <span>Adet</span>
                        <span />
                      </div>
                      {spreadingLayers.map((layer, index) => (
                        <div key={`${index}-${layer.layerNumber}`} style={styles.layerRow} className="cutting-layer-row">
                          {effectiveColorVariants.length > 0 ? (
                            <select
                              value={layer.color || selectedColorVariant || ''}
                              onChange={event => updateSpreadingLayer(index, 'color', event.target.value)}
                              style={styles.layerInput}
                              disabled={isOperatorLocked}
                              aria-label="Renk"
                            >
                              <option value="" disabled>Renk seçin</option>
                              {effectiveColorVariants.map(color => (
                                <option key={color} value={color}>{color}</option>
                              ))}
                            </select>
                          ) : (
                            <input value={layer.color} onChange={event => updateSpreadingLayer(index, 'color', event.target.value)} placeholder="Renk" style={styles.layerInput} disabled={isOperatorLocked} />
                          )}
                          <input type="number" min="1" value={layer.layerNumber} onChange={event => updateSpreadingLayer(index, 'layerNumber', event.target.value)} aria-label="Kat" style={styles.layerInput} disabled={isOperatorLocked} />
                          <input type="number" min="0" step="0.01" value={layer.weightKg} onChange={event => updateSpreadingLayer(index, 'weightKg', event.target.value)} aria-label="Kg" style={styles.layerInput} disabled={isOperatorLocked} />
                          <input type="number" min="0" value={layer.pieceCount} onChange={event => updateSpreadingLayer(index, 'pieceCount', event.target.value)} aria-label="Adet" style={styles.layerInput} disabled={isOperatorLocked} />
                          <button
                            type="button"
                            onClick={() => removeSpreadingLayer(index)}
                            disabled={isOperatorLocked || spreadingLayers.length <= 1}
                            style={styles.removeLayerButton}
                            aria-label="Katı sil"
                          >
                            Sil
                          </button>
                        </div>
                      ))}
                      <div style={styles.colorTotals}>
                        {Array.from(colorTotals.entries()).map(([color, total]) => (
                          <span key={color}>{color}: {total.weightKg.toFixed(2)} kg · {total.pieceCount} adet · {total.layers} kat</span>
                        ))}
                        <strong>Toplam: {totalSpreadingWeightKg.toFixed(2)} kg · {totalSpreadingPieces} adet</strong>
                      </div>
                    </div>
                    <button
                      onClick={requestSpreadingComplete}
                      disabled={!selectedOrder || !spreadingStarted || savingOrderId === selectedOrder?.id || isOperatorLocked || spreadingCompleted}
                      style={{
                        ...styles.spreadingCompleteButton,
                        opacity: !selectedOrder || savingOrderId === selectedOrder?.id || isOperatorLocked || spreadingCompleted ? 0.55 : 1,
                        cursor: !selectedOrder || savingOrderId === selectedOrder?.id || isOperatorLocked || spreadingCompleted ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {spreadingCompleted
                        ? 'Serim verileri alındı'
                        : savingOrderId === selectedOrder?.id
                          ? 'Kaydediliyor...'
                          : 'Serim tamamlandı — iş emrine al'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {isOperatorLocked && (
          <div style={styles.lockOverlay}>
            <div style={styles.lockCard}>
              <h2 style={styles.lockTitle}>Ekran kilitlendi</h2>
              <p style={styles.lockText}>Devam etmek için kilidi açın.</p>
              <button onClick={() => setIsOperatorLocked(false)} style={styles.primaryButton}>Ekranı aç</button>
            </div>
          </div>
        )}

        {showSpreadingConfirm && (
          <div style={styles.lockOverlay}>
            <div style={styles.confirmCard}>
              <h2 style={styles.lockTitle}>Serim verisini iş emrine al?</h2>
              <p style={styles.lockText}>
                {selectedOrder?.orderNo} iş emrine makine kat / en / metre bilgileri yazılacak.
                Bu işlem mevcut rapor alanlarını günceller.
              </p>
              <div style={styles.confirmActions}>
                <button onClick={() => setShowSpreadingConfirm(false)} style={styles.secondaryButton}>
                  Vazgeç
                </button>
                <button onClick={handleSpreadingComplete} style={styles.primaryButton}>
                  Onayla ve kaydet
                </button>
              </div>
            </div>
          </div>
        )}

        {showCompleteConfirm && (
          <div style={styles.lockOverlay}>
            <div style={styles.confirmCard}>
              <h2 style={styles.lockTitle}>Kesimi tamamla?</h2>
              <p style={styles.lockText}>
                {selectedOrder?.orderNo} iş emri kesim tamamlandı olarak işaretlenecek.
                {progressPercent < 100 ? ` İlerleme %${progressPercent.toFixed(0)} tamamlanmış.` : ''}
                İş emri listeden kalkacak.
              </p>
              <div style={styles.confirmActions}>
                <button onClick={() => setShowCompleteConfirm(false)} style={styles.secondaryButton}>
                  Vazgeç
                </button>
                <button onClick={handleCompleteCutting} style={styles.primaryButton}>
                  Onayla ve tamamla
                </button>
              </div>
            </div>
          </div>
        )}

        {infoMessage ? <div style={styles.infoToast}>{infoMessage}</div> : null}
        {error ? <div style={styles.errorToast}>{error}</div> : null}
      </div>
    </AuthGuard>
  );
};

const styles: Record<string, React.CSSProperties> = {
  appShell: {
    minHeight: '100vh',
    background: '#f4f6f9',
    color: '#0f172a',
    fontFamily: 'Inter, system-ui, Arial, sans-serif',
    letterSpacing: '-0.01em',
  },
  topBar: {
    minHeight: '56px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 24px',
    background: '#0f172a',
    color: '#ffffff',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    gap: '16px',
    flexWrap: 'wrap' as const,
  },
  brandBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  headerMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: 'rgba(255,255,255,0.72)',
    fontWeight: 500,
  },
  headerMetaSep: {
    color: 'rgba(255,255,255,0.28)',
  },
  headerMetaOk: {
    color: '#6ee7b7',
    fontWeight: 600,
  },
  headingMain: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  iconButton: {
    display: 'grid',
    placeItems: 'center',
    width: '44px',
    height: '44px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent',
    color: '#fff',
    fontSize: '18px',
    cursor: 'pointer'
  },
  brandMark: {
    display: 'grid',
    placeItems: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: '#1d4ed8',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 800,
  },
  brandTitle: {
    fontSize: '15px',
    fontWeight: 700,
    letterSpacing: '-0.01em',
    lineHeight: 1,
    color: '#ffffff',
  },
  brandSubtitle: {
    display: 'none',
  },
  topBarActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  headerPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: 'oklch(.86 .02 220)'
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '99px',
    background: 'oklch(.72 .16 155)',
    display: 'inline-block'
  },
  mutedDivider: {
    color: 'oklch(.45 .03 220)'
  },
  headerIcon: {
    position: 'relative',
    display: 'grid',
    placeItems: 'center',
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    border: 'none',
    background: 'transparent',
    color: '#fff',
    fontSize: '18px',
    cursor: 'pointer'
  },
  notificationDot: {
    position: 'absolute',
    top: '5px',
    right: '5px',
    width: '6px',
    height: '6px',
    borderRadius: '99px',
    background: 'oklch(.68 .17 35)'
  },
  operatorChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  operatorAvatar: {
    display: 'grid',
    placeItems: 'center',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: '#1e293b',
    color: '#cbd5e1',
    fontSize: '10px',
    fontWeight: 700,
  },
  operatorName: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: '#fff',
  },
  operatorRole: {
    display: 'none',
  },
  lockButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '64px',
    height: '36px',
    padding: '0 12px',
    borderRadius: '8px',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 700,
  },
  headerTextButton: {
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'transparent',
    color: 'oklch(.86 .02 220)',
    borderRadius: '8px',
    minHeight: '34px',
    padding: '0 12px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  fullscreenButton: {
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'transparent',
    color: 'oklch(.86 .02 220)',
    borderRadius: '8px',
    minHeight: '34px',
    padding: '0 12px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  pageShell: {
    maxWidth: '1480px',
    margin: '0 auto',
    padding: '20px 20px 32px',
  },
  pageHeading: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '16px',
  },
  eyebrow: {
    display: 'none',
  },
  headingTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: '#0f172a',
  },
  headingNote: {
    margin: 0,
    color: '#64748b',
    fontSize: '13px',
  },
  headingActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  shiftCard: {
    display: 'none',
  },
  secondaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    minHeight: '36px',
    borderRadius: '8px',
    padding: '0 12px',
    background: '#ffffff',
    color: '#0f172a',
    border: '1px solid #e2e8f0',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
  },
  secondaryButtonSmall: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    minHeight: '44px',
    borderRadius: '9px',
    padding: '0 12px',
    background: '#ffffff',
    color: 'oklch(0.22 0.035 220)',
    border: '1px solid #dfe7f1',
    fontWeight: 700,
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease'
  },
  dashboardGrid: {
    display: 'grid',
     gridTemplateColumns: '260px minmax(0, 1fr) 420px',
    gap: '14px',
    alignItems: 'start',
  },
  centerColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  panel: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    boxShadow: 'none',
    overflow: 'hidden',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px 12px',
    borderBottom: '1px solid #f1f5f9',
  },
  panelKicker: {
    margin: '0 0 2px',
    color: '#94a3b8',
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
  },
  panelTitle: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 700,
    letterSpacing: '-0.01em',
    color: '#0f172a',
  },
  countBadge: {
    display: 'inline-grid',
    placeItems: 'center',
    minWidth: '21px',
    height: '19px',
    borderRadius: '5px',
    background: 'oklch(0.94 0.015 220)',
    color: 'oklch(0.48 0.035 220)',
    fontSize: '10px',
    marginLeft: '6px'
  },
  smallIcon: {
    display: 'grid',
    placeItems: 'center',
    width: '30px',
    height: '30px',
    borderRadius: '6px',
    border: '1px solid #dfe7f1',
    background: '#ffffff',
    color: 'oklch(0.22 0.035 220)',
    cursor: 'pointer',
    fontSize: '18px'
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    margin: '14px 14px 14px',
    height: '48px',
    border: '1px solid #dfe7f1',
    background: 'oklch(0.98 0.006 220)',
    padding: '0 10px',
    borderRadius: '9px',
    color: 'oklch(0.48 0.035 220)',
    transition: 'border-color 160ms ease, box-shadow 160ms ease'
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: '16px',
    color: 'oklch(0.22 0.035 220)'
  },
  keyboardHint: {
    fontSize: '9px',
    border: '1px solid #dfe7f1',
    borderRadius: '3px',
    padding: '2px 4px',
    color: 'oklch(0.48 0.035 220)'
  },
  orderList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '0 8px 10px',
    maxHeight: 'min(62vh, 640px)',
    overflowY: 'auto' as const,
  },
  orderItem: {
    position: 'relative',
    textAlign: 'left',
    border: '1px solid transparent',
    background: 'transparent',
    borderRadius: '10px',
    padding: '15px 28px 14px 14px',
    minHeight: '90px',
    cursor: 'pointer',
    width: '100%',
    transition: 'background 160ms ease, border-color 160ms ease, transform 160ms ease'
  },
  orderItemSelected: {
    background: 'oklch(.96 .025 215)',
    borderColor: 'oklch(.86 .06 215)',
    boxShadow: 'inset 3px 0 var(--primary)' 
  },
  orderItemTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px'
  },
  statusLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 7px',
    borderRadius: '4px',
    fontSize: '9px',
    fontWeight: 800,
    textTransform: 'uppercase'
  },
  statusBlue: {
    background: 'oklch(.92 .06 215)',
    color: 'oklch(.42 .13 220)'
  },
  statusAmber: {
    background: 'oklch(.95 .07 85)',
    color: 'oklch(.48 .13 75)'
  },
  statusGreen: {
    background: 'oklch(.92 .08 155)',
    color: 'oklch(.39 .12 155)'
  },
  orderTime: {
    color: 'oklch(0.48 0.035 220)',
    fontSize: '9px'
  },
  orderId: {
    display: 'block',
    fontSize: '12px',
    marginTop: '10px',
    color: 'oklch(0.22 0.035 220)'
  },
  orderProduct: {
    display: 'block',
    color: 'oklch(0.48 0.035 220)',
    fontSize: '10px',
    marginTop: '3px'
  },
  orderMeta: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    marginTop: '10px',
    color: 'oklch(0.48 0.035 220)',
    fontSize: '9px'
  },
  miniProgress: {
    overflow: 'hidden',
    background: 'oklch(0.94 0.015 220)',
    borderRadius: '99px',
    height: '3px',
    marginTop: '9px'
  },
  orderChevron: {
    position: 'absolute',
    right: '9px',
    top: '50%',
    color: 'oklch(0.48 0.035 220)',
    fontSize: '14px'
  },
  panelFooter: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    padding: '13px 15px',
    borderTop: '1px solid #e3e8ef',
    color: 'oklch(0.48 0.035 220)',
    fontSize: '10px'
  },
  workPanel: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    boxShadow: 'none',
    padding: '18px 18px 16px',
  },
  workTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '20px'
  },
  workLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    color: 'oklch(0.48 0.035 220)',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.02em',
  },
  liveDot: {
    width: '8px',
    height: '8px',
    borderRadius: '99px',
    background: 'oklch(.72 .16 155)',
    display: 'inline-block'
  },
  workTitle: {
    fontSize: '22px',
    marginTop: '4px',
    marginBottom: 0,
    letterSpacing: '-0.02em',
    fontWeight: 700,
  },
  workMetaText: {
    color: 'oklch(0.48 0.035 220)',
    fontSize: '11px',
    marginTop: '5px'
  },
  metaDivider: {
    margin: '0 5px',
    color: '#dfe7f1'
  },
  workActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  progressArea: {
    marginTop: '29px',
    padding: '16px 0 2px',
    borderTop: '1px solid #eef2f7'
  },
  progressHeading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '11px',
    fontWeight: 700,
    color: 'oklch(0.48 0.035 220)'
  },
  largeProgress: {
    height: '10px',
    overflow: 'hidden',
    background: 'oklch(0.94 0.015 220)',
    borderRadius: '99px',
    marginTop: '9px'
  },
  progressCaption: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    color: 'oklch(0.48 0.035 220)',
    fontSize: '9px',
    marginTop: '9px'
  },
  assortSummaryBox: {
    marginTop: '18px',
    borderRadius: '10px',
    border: '1px solid #dfe7f1',
    background: 'linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%)',
    padding: '12px 14px'
  },
  assortSummaryHeader: {
    fontSize: '10px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    fontWeight: 800,
    color: 'oklch(0.48 0.035 220)',
    marginBottom: '8px'
  },
  assortRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '8px',
    alignItems: 'center'
  },
  assortSize: {
    textAlign: 'center',
    fontSize: '12px',
    fontWeight: 800,
    color: 'oklch(0.22 0.035 220)'
  },
  assortValue: {
    textAlign: 'center',
    fontSize: '12px',
    fontWeight: 700,
    color: 'oklch(0.48 0.035 220)',
    background: '#fff',
    border: '1px solid #dfe7f1',
    borderRadius: '5px',
    padding: '4px 0'
  },
  assortResultText: {
    marginTop: '10px',
    fontSize: '11px',
    fontWeight: 700,
    color: 'oklch(0.22 0.035 220)',
    letterSpacing: '0.02em'
  },
  autoFillLine: {
    marginTop: '14px',
    borderRadius: '7px',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    color: '#1d4ed8',
    padding: '8px 10px',
    fontSize: '10px',
    fontWeight: 700
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '10px',
    marginTop: '28px',
    paddingTop: '19px',
    borderTop: '1px solid #e3e8ef'
  },
  metricCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minHeight: '64px',
    padding: '12px 14px',
    borderRadius: '10px',
    background: '#f8fafc',
    border: '1px solid #e8eef5',
  },
  metricGlyph: {
    display: 'none',
  },
  spreadingDock: {
    minHeight: 'auto',
    overflow: 'hidden',
  },
  spreadingToggle: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '16px 20px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    textAlign: 'left' as const,
  },
  spreadingToggleLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  spreadingToggleRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  spreadingToggleStatus: {
    fontSize: '12px',
    color: 'oklch(0.42 0.04 220)',
    fontWeight: 700,
  },
  spreadingChevron: {
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    border: '1px solid #dfe7f1',
    display: 'grid',
    placeItems: 'center',
    fontSize: '16px',
    fontWeight: 700,
    color: 'oklch(0.42 0.04 220)',
    background: '#fff',
  },
  spreadingBody: {
    padding: '0 20px 20px',
    borderTop: '1px solid #eef2f7',
  },
  accordionHeader: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '18px 20px 12px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    textAlign: 'left' as const,
  },
  accordionChevron: {
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    border: '1px solid #dfe7f1',
    display: 'grid',
    placeItems: 'center',
    fontSize: '16px',
    fontWeight: 700,
    color: 'oklch(0.42 0.04 220)',
    background: '#fff',
    flexShrink: 0,
  },
  accordionBody: {
    padding: '0 20px 16px',
  },
  detailSummaryRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
    gap: '6px',
    padding: '0 20px 14px',
    fontSize: '12px',
    color: 'oklch(0.42 0.04 220)',
    fontWeight: 600,
  },
  formTwoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  formAccordionToggle: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: 0,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    textAlign: 'left' as const,
  },
  metricLabel: {
    display: 'block',
    color: 'oklch(0.48 0.035 220)',
    fontSize: '10px'
  },
  metricValue: {
    fontSize: '18px',
    fontWeight: 700,
    color: 'oklch(0.22 0.035 220)'
  },
  metricUnit: {
    fontSize: '10px',
    color: 'oklch(0.48 0.035 220)',
    marginLeft: '2px'
  },
  updatedText: {
    color: 'oklch(0.48 0.035 220)',
    fontSize: '10px'
  },
  spreadingControls: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '12px',
    padding: '0 20px 12px',
    flexWrap: 'wrap'
  },
  modeToggleButton: {
    minHeight: '36px',
    fontSize: '12px',
    fontWeight: 700,
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 120ms ease',
  },
  modeToggleButtonActive: {
    background: '#2563eb',
    color: '#fff',
    borderColor: '#2563eb',
  },
  modeToggleButtonInactive: {
    background: '#f1f5f9',
    color: '#64748b',
  },
  rollEntrySection: {
    marginTop: '14px',
    padding: '12px 20px',
    border: '1px solid #e3e8ef',
    borderRadius: '8px',
    background: '#f8fafc',
  },
  rollEntryHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
    fontSize: '11px',
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  rollColorGroup: {
    marginBottom: '12px',
  },
  rollColorHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '6px',
    fontSize: '12px',
    fontWeight: 700,
    color: '#0f172a',
  },
  rollColorName: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  rollColorTotal: {
    color: '#64748b',
    fontSize: '11px',
    fontWeight: 600,
  },
  rollEntryRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(80px, 1fr) 80px 90px 80px 26px',
    gap: '8px',
    alignItems: 'center',
    padding: '6px 8px',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '5px',
    fontSize: '12px',
    color: '#1e293b',
  },
  rollEntryColor: {
    color: '#64748b',
    fontSize: '11px',
  },
  rollEntryNumber: {
    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
    fontWeight: 700,
  },
  rollEntryWeight: {
    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
    fontWeight: 700,
    color: '#0f766e',
  },
  rollEntryLayers: {
    color: '#2563eb',
    fontWeight: 700,
  },
  rollRemoveButton: {
    width: '24px',
    height: '24px',
    borderRadius: '4px',
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#dc2626',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'grid',
    placeItems: 'center',
  },
  rollGrandTotal: {
    marginTop: '8px',
    padding: '8px 12px',
    borderRadius: '6px',
    background: '#0f766e',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 700,
    textAlign: 'center' as const,
  },
  rollEmpty: {
    padding: '16px',
    textAlign: 'center' as const,
    color: '#94a3b8',
    fontSize: '12px',
    fontStyle: 'italic',
  },
  spreadingMachineField: {
    display: 'grid',
    gap: '5px',
    minWidth: '260px',
    color: 'oklch(0.48 0.035 220)',
    fontSize: '10px',
    fontWeight: 700
  },
  startSpreadingButton: {
    minHeight: '42px',
    padding: '0 16px',
    border: 'none',
    borderRadius: '7px',
    background: '#2563eb',
    color: '#fff',
    fontWeight: 800,
    cursor: 'pointer'
  },
  machineBinding: {
    padding: '0 20px 14px',
    color: 'oklch(0.48 0.035 220)',
    fontSize: '11px'
  },
  layerPanel: {
    marginTop: '16px',
    padding: '14px',
    border: '1px solid #e3e8ef',
    borderRadius: '8px',
    background: '#f8fafc'
  },
  layerPanelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
    fontSize: '12px'
  },
  addLayerButton: {
    border: '1px solid #bfdbfe',
    borderRadius: '6px',
    background: '#eff6ff',
    color: '#1d4ed8',
    padding: '6px 9px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  layerRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(100px, 1fr) 64px 80px 80px 36px',
    gap: '8px',
    marginBottom: '8px',
    alignItems: 'center',
  },
  layerHeaderRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(100px, 1fr) 64px 80px 80px 36px',
    gap: '8px',
    marginBottom: '6px',
    padding: '0 2px',
    fontSize: '10px',
    fontWeight: 700,
    color: 'oklch(0.48 0.035 220)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  },
  removeLayerButton: {
    width: '34px',
    height: '34px',
    borderRadius: '6px',
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#dc2626',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'grid',
    placeItems: 'center',
  },
  layerInput: {
    minWidth: 0,
    minHeight: '34px',
    border: '1px solid #dbe3ec',
    borderRadius: '5px',
    padding: '0 8px',
    background: '#fff',
    fontSize: '12px'
  },
  colorTotals: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px 16px',
    paddingTop: '6px',
    color: 'oklch(0.42 0.04 220)',
    fontSize: '11px'
  },
  spreadingStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },
  statusLight: {
    width: '12px',
    height: '12px',
    borderRadius: '999px',
    display: 'inline-block',
    boxShadow: '0 0 0 3px rgba(15, 23, 42, 0.06)'
  },
  statusLightRunning: {
    background: '#facc15',
    boxShadow: '0 0 0 3px rgba(250, 204, 21, 0.22), 0 0 12px rgba(250, 204, 21, 0.7)'
  },
  statusLightIdle: {
    background: '#94a3b8',
    boxShadow: '0 0 0 3px rgba(148, 163, 184, 0.22)'
  },
  statusLightCompleted: {
    background: '#22c55e',
    boxShadow: '0 0 0 3px rgba(34, 197, 94, 0.22), 0 0 12px rgba(34, 197, 94, 0.7)'
  },
  spreadingCompleteButton: {
    marginTop: '18px',
    width: '100%',
    minHeight: '46px',
    border: 'none',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #0f766e, #0d9488)',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer'
  },
  completeCuttingButton: {
    width: '100%',
    minHeight: '46px',
    border: 'none',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: 800,
    cursor: 'pointer'
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '14px',
    padding: '0 20px 20px'
  },
  detailCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  detailLabel: {
    color: 'oklch(0.48 0.035 220)',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em'
  },
  detailValue: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    fontWeight: 700,
    color: 'oklch(0.22 0.035 220)'
  },
  swatch: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: '#111827',
    border: '1px solid rgba(15, 23, 42, 0.08)'
  },
  monoCell: {
    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
    letterSpacing: '0.03em'
  },
  barcodeStrip: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    margin: '0 20px 20px',
    padding: '12px 14px',
    borderRadius: '8px',
    background: 'linear-gradient(90deg, rgba(242,246,255,0.9), rgba(255,255,255,1))',
    border: '1px solid #dfe7f1',
    color: 'oklch(0.22 0.035 220)'
  },
  barcodeText: {
    flex: 1,
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.08em'
  },
  barcodeSmall: {
    fontSize: '9px',
    color: 'oklch(0.48 0.035 220)',
    textTransform: 'uppercase'
  },
  reportPanel: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    boxShadow: 'none',
    overflow: 'hidden',
    minWidth: '380px',
  },
  reportHeading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px 12px',
    borderBottom: '1px solid #f1f5f9',
  },
  formContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '12px 14px 14px',
  },
  fieldLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    color: 'oklch(0.22 0.035 220)',
    fontSize: '11px',
    fontWeight: 700
  },
  formInput: {
    width: '100%',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    background: '#fff',
    minHeight: '42px',
    padding: '8px 12px',
    fontSize: '14px',
    color: '#0f172a',
    boxSizing: 'border-box' as const,
  },
  textarea: {
    minHeight: '72px',
    resize: 'vertical'
  },
  fabricExitInlinePanel: {
    marginTop: '2px'
  },
  fabricExitInlineRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  smallAddButton: {
    minHeight: '48px',
    padding: '0 18px',
    borderRadius: '7px',
    border: '1px solid #93c5fd',
    background: '#2563eb',
    color: '#ffffff',
    fontWeight: 800,
    fontSize: '14px',
    cursor: 'pointer'
  },
   quickPanel: {
     border: '1px solid #dfe7f1',
     borderRadius: '8px',
     padding: '12px',
     background: '#f8fafc'
   },
   quickHeader: {
     fontSize: '11px',
     fontWeight: 800,
     letterSpacing: '0.08em',
     textTransform: 'uppercase',
     color: 'oklch(0.48 0.035 220)',
     marginBottom: '10px'
   },
   quickActionGrid: {
     display: 'grid',
     gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
     gap: '8px'
   },
    quickActionButton: {
      minHeight: '48px',
      borderRadius: '7px',
      border: '1px solid #cfe0ff',
      background: '#edf4ff',
      color: '#1d4ed8',
      fontWeight: 700,
      fontSize: '14px',
      cursor: 'pointer'
    },
   quickValues: {
     display: 'flex',
     alignItems: 'center',
     gap: '8px',
     flexWrap: 'wrap'
   },
   quickLabel: {
     fontSize: '10px',
     color: 'oklch(0.48 0.035 220)',
     textTransform: 'uppercase',
     letterSpacing: '0.08em',
     marginRight: '2px'
   },
    quickValueButton: {
      minWidth: '48px',
      minHeight: '44px',
      borderRadius: '6px',
      border: '1px solid #dfe7f1',
      background: '#fff',
      color: 'oklch(0.22 0.035 220)',
      fontSize: '14px',
      fontWeight: 700,
      cursor: 'pointer'
    },
   fabricInfoBar: {
     display: 'flex',
     alignItems: 'center',
     gap: '8px',
     padding: '8px 12px',
     borderRadius: '6px',
     background: '#f0fdf9',
     border: '1px solid #a7f3d0',
     fontSize: '11px',
     fontWeight: 600,
     color: '#0f766e'
   },
   fabricInfoLabel: {
     color: 'oklch(0.48 0.035 220)',
     fontWeight: 600
   },
   fabricInfoValue: {
     color: 'oklch(0.22 0.035 220)',
     fontWeight: 700
   },
   fabricInfoDivider: {
     color: '#94a3b8',
     margin: '0 2px'
   },
   checklist: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  checklistTitleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px'
  },
  checklistTitleText: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    color: 'oklch(0.48 0.035 220)',
    textTransform: 'uppercase'
  },
  checklistCount: {
    fontSize: '10px',
    color: 'oklch(0.48 0.035 220)'
  },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 14px',
    borderRadius: '7px',
    border: '1px solid #e3e8ef',
    background: '#ffffff',
    cursor: 'pointer',
    fontSize: '14px',
    minHeight: '48px',
    textAlign: 'left',
    color: 'oklch(0.22 0.035 220)'
  },
  checkRowChecked: {
    background: '#ecfdf3',
    borderColor: '#a7f3d0'
  },
  checkBox: {
    width: '18px',
    height: '18px',
    borderRadius: '4px',
    border: '1px solid #dfe7f1',
    display: 'inline-grid',
    placeItems: 'center',
    background: '#fff',
    color: 'transparent',
    fontSize: '12px',
    fontWeight: 700
  },
  checkBoxChecked: {
    background: 'oklch(.72 .16 155)',
    borderColor: 'oklch(.72 .16 155)',
    color: '#fff'
  },
  saveButton: {
    marginTop: 0,
    width: '100%',
    minHeight: '48px',
    borderRadius: '8px',
    border: 'none',
    background: '#1d4ed8',
    color: '#fff',
    fontWeight: 700,
    fontSize: '14px',
    letterSpacing: '0',
    cursor: 'pointer',
    boxShadow: 'none',
  },
  emptyChecklist: {
    padding: '12px',
    borderRadius: '8px',
    background: '#f8fafc',
    border: '1px dashed #dfe7f1',
    color: 'oklch(0.48 0.035 220)',
    fontSize: '12px'
  },
  lockOverlay: {
    position: 'fixed',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    background: 'rgba(15, 23, 42, 0.42)',
    zIndex: 20
  },
  lockCard: {
    width: '320px',
    maxWidth: 'calc(100vw - 32px)',
    padding: '24px',
    borderRadius: '16px',
    background: '#fff',
    border: '1px solid #e3e8ef',
    textAlign: 'center',
    boxShadow: '0 30px 80px rgba(15, 23, 42, 0.2)'
  },
  lockSymbol: {
    fontSize: '32px',
    marginBottom: '12px'
  },
  lockTitle: {
    margin: 0,
    fontSize: '22px',
    color: 'oklch(0.22 0.035 220)'
  },
  lockText: {
    marginTop: '8px',
    color: 'oklch(0.48 0.035 220)',
    fontSize: '13px'
  },
  primaryButton: {
    width: '100%',
    marginTop: '18px',
    minHeight: '42px',
    borderRadius: '7px',
    border: 'none',
    background: 'oklch(0.55 0.14 218)',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer'
  },
  infoToast: {
    position: 'fixed',
    right: '24px',
    bottom: '24px',
    background: '#dbeafe',
    border: '1px solid #93c5fd',
    color: '#1d4ed8',
    padding: '12px 16px',
    borderRadius: '10px',
    zIndex: 22,
    fontSize: '13px',
    boxShadow: '0 8px 24px rgba(37, 99, 235, 0.12)',
  },
  errorToast: {
    position: 'fixed',
    right: '24px',
    bottom: '72px',
    background: '#fee2e2',
    border: '1px solid #fecaca',
    color: '#991b1b',
    padding: '12px 16px',
    borderRadius: '10px',
    zIndex: 22,
    fontSize: '13px',
    boxShadow: '0 8px 24px rgba(220, 38, 38, 0.12)',
  },
  loadingContainer: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    gap: '16px',
    background: 'oklch(0.97 0.012 220)',
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '3px solid #dbeafe',
    borderTopColor: '#2563eb',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    margin: 0,
    color: 'oklch(0.48 0.035 220)',
    fontSize: '14px',
    fontWeight: 600,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '56px 24px',
    minHeight: '240px',
  },
  emptyStateIcon: {
    display: 'none',
  },
  emptyStateTitle: {
    margin: '0 0 8px',
    fontSize: '17px',
    fontWeight: 700,
    color: 'oklch(0.22 0.035 220)',
    letterSpacing: '-0.02em',
  },
  emptyStateText: {
    margin: 0,
    maxWidth: '320px',
    color: 'oklch(0.48 0.035 220)',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  emptyStateHint: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '18px',
    color: 'oklch(0.48 0.035 220)',
    fontSize: '12px',
  },
  emptyStateCompact: {
    padding: '28px 20px',
    textAlign: 'center',
    color: 'oklch(0.48 0.035 220)',
    fontSize: '13px',
  },
  emptyStateIconSmall: {
    fontSize: '28px',
    marginBottom: '10px',
    opacity: 0.5,
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '12px',
    borderRadius: '8px',
    background: '#f8fafc',
    border: '1px solid #eef2f7',
  },
  formGroupTitle: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.02em',
    color: '#64748b',
    marginBottom: 0,
  },
  fieldLabelRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  autoBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 6px',
    borderRadius: '4px',
    background: '#d1fae5',
    color: '#047857',
    fontSize: '9px',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
  },
  autoFilledInput: {
    borderColor: '#6ee7b7',
    background: '#ecfdf5',
    boxShadow: '0 0 0 1px rgba(16, 185, 129, 0.15)',
  },
  autoFillBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    marginRight: '8px',
    padding: '2px 6px',
    borderRadius: '4px',
    background: '#dbeafe',
    color: '#1d4ed8',
    fontSize: '9px',
    fontWeight: 800,
    letterSpacing: '0.04em',
  },
  stickySaveBar: {
    position: 'sticky' as const,
    bottom: 0,
    marginTop: '8px',
    paddingTop: '12px',
    paddingBottom: '4px',
    background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, #ffffff 28%)',
    zIndex: 2,
  },
  appShellDark: {
    background: 'oklch(0.18 0.025 240)',
    color: 'oklch(0.92 0.02 220)',
  },
  demoBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    marginLeft: '8px',
    padding: '2px 7px',
    borderRadius: '4px',
    background: '#fef3c7',
    color: '#b45309',
    fontSize: '9px',
    fontWeight: 800,
    letterSpacing: '0.06em',
    verticalAlign: 'middle',
  },
  liveBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    marginLeft: '8px',
    padding: '2px 7px',
    borderRadius: '4px',
    background: '#dcfce7',
    color: '#15803d',
    fontSize: '9px',
    fontWeight: 800,
    letterSpacing: '0.06em',
    verticalAlign: 'middle',
  },
  scaleConnectedPill: {
    background: 'rgba(16, 185, 129, 0.18)',
    color: '#6ee7b7',
    padding: '4px 10px',
    borderRadius: '999px',
    fontWeight: 700,
  },
  scaleDisconnectedPill: {
    background: 'rgba(148, 163, 184, 0.15)',
    color: 'oklch(.72 .03 220)',
    padding: '4px 10px',
    borderRadius: '999px',
  },
  assortEditGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(64px, 1fr))',
    gap: '8px',
  },
  assortEditCell: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '4px',
  },
  assortEditInput: {
    width: '100%',
    minHeight: '36px',
    textAlign: 'center' as const,
    border: '1px solid #dfe7f1',
    borderRadius: '6px',
    background: '#fff',
    fontSize: '14px',
    fontWeight: 700,
    color: 'oklch(0.22 0.035 220)',
  },
  quickNotesRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '6px',
  },
  quickNoteChip: {
    border: '1px solid #cfe0ff',
    background: '#edf4ff',
    color: '#1d4ed8',
    borderRadius: '999px',
    padding: '6px 10px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  confirmCard: {
    width: '380px',
    maxWidth: 'calc(100vw - 32px)',
    padding: '24px',
    borderRadius: '16px',
    background: '#fff',
    border: '1px solid #e3e8ef',
    textAlign: 'center' as const,
    boxShadow: '0 30px 80px rgba(15, 23, 42, 0.2)',
  },
  confirmActions: {
    display: 'flex',
    gap: '10px',
    marginTop: '18px',
    justifyContent: 'center',
  },
};

function MetricCard({ label, value, unit }: { label: string; value: string; unit: string; glyph?: string }) {
  return (
    <div style={styles.metricCard}>
      <div>
        <span style={styles.metricLabel}>{label}</span>
        <div style={{ marginTop: '4px' }}>
          <strong style={styles.metricValue}>{value}</strong>
          <span style={styles.metricUnit}>{unit}</span>
        </div>
      </div>
    </div>
  );
}

function DetailBox({
  label,
  value,
  swatch,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  swatch?: boolean;
  mono?: boolean;
  highlight?: 'success' | 'danger';
}) {
  const valueStyle: React.CSSProperties = {
    ...styles.detailValue,
    ...(mono ? { fontFamily: 'ui-monospace, SFMono-Regular, monospace', letterSpacing: '0.03em' } : {}),
    ...(highlight === 'success' ? { color: '#059669' } : {}),
    ...(highlight === 'danger' ? { color: '#dc2626' } : {}),
  };
  return (
    <div style={styles.detailCard}>
      <span style={styles.detailLabel}>{label}</span>
      <strong style={valueStyle}>
        {swatch ? <span style={styles.swatch} /> : null}
        {value}
      </strong>
    </div>
  );
}

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    [data-cutting-workshop] .cutting-dashboard-grid > aside:last-child {
      display: flex;
      flex-direction: column;
    }
    [data-cutting-workshop] .cutting-dashboard-grid > aside:last-child > div:last-child {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    [data-cutting-workshop] [style*="overflow: hidden"][style*="border-radius: 99px"] > span {
      display: block;
      height: 100%;
      border-radius: 99px;
      transition: width 400ms ease;
    }
    [data-cutting-workshop] button:not(:disabled):hover {
      transform: translateY(-1px);
    }
    [data-cutting-workshop] button:not(:disabled):focus-visible,
    [data-cutting-workshop] input:focus-visible,
    [data-cutting-workshop] select:focus-visible,
    [data-cutting-workshop] textarea:focus-visible {
      outline: 3px solid rgba(37, 99, 235, 0.18);
      outline-offset: 1px;
    }
    [data-cutting-workshop] * {
      box-sizing: border-box;
    }
    @media (max-width: 1180px) {
      [data-cutting-workshop] .cutting-dashboard-grid {
        grid-template-columns: 250px minmax(0, 1fr);
      }
      [data-cutting-workshop] .cutting-dashboard-grid > aside:last-child {
        grid-column: 1 / -1;
        min-height: auto;
      }
    }
    @media (max-width: 760px) {
      [data-cutting-workshop] {
        overflow-x: hidden;
      }
      [data-cutting-workshop] header {
        align-items: flex-start;
      }
      [data-cutting-workshop] header > div:last-child {
        width: 100%;
        justify-content: space-between;
      }
      [data-cutting-workshop] .cutting-dashboard-grid {
        grid-template-columns: 1fr;
      }
      [data-cutting-workshop] .cutting-dashboard-grid > aside:last-child {
        grid-column: auto;
      }
      [data-cutting-workshop] .cutting-metric-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      [data-cutting-workshop] .cutting-layer-row {
        grid-template-columns: minmax(80px, 1fr) repeat(3, minmax(52px, 0.7fr)) 32px;
      }
    }
    @media (max-width: 560px) {
      [data-cutting-workshop] .cutting-page-shell {
        padding: 22px 14px 30px;
      }
      [data-cutting-workshop] .cutting-page-heading {
        align-items: stretch;
        flex-direction: column;
      }
      [data-cutting-workshop] .cutting-page-heading > * {
        width: 100%;
      }
      [data-cutting-workshop] .cutting-metric-grid {
        grid-template-columns: 1fr;
      }
      [data-cutting-workshop] .cutting-layer-row {
        grid-template-columns: 1fr 1fr;
      }
      [data-cutting-workshop] .cutting-layer-row > *:last-child {
        grid-column: 1 / -1;
      }
    }
    [data-cutting-workshop][data-theme="dark"] {
      background: oklch(0.18 0.025 240);
      color: oklch(0.92 0.02 220);
    }
    [data-cutting-workshop][data-theme="dark"] header {
      background: oklch(0.14 0.03 240);
    }
  `;
  document.head.appendChild(style);
}

export default CuttingWorkshopPage;
