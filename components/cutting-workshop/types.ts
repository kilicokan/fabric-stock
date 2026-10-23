/**
 * Kesimhane API ve domain tipleri
 */

export interface MtkSpreadingRun {
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
  externalRunId?: string;
}

/**
 * GET /api/spreading-runs?orderId={id}
 *
 * Başarı (200):
 * {
 *   "data": MtkSpreadingRun
 * }
 * veya doğrudan MtkSpreadingRun
 *
 * Hata (4xx/5xx):
 * { "error": string, "code"?: string }
 *
 * Poll aralığı (istemci): ~10s, sadece serim başladıktan sonra.
 */
export interface SpreadingRunApiResponse {
  data?: MtkSpreadingRun;
  error?: string;
  code?: string;
}

/**
 * PUT /api/fason/work-orders/{id}
 * body: { sewingNotes?: string, status?: string }
 */
export interface WorkOrderUpdateBody {
  sewingNotes?: string;
  status?: string;
}

export type SpreadingMode = 'weight-first' | 'spread-then-weight';
export type SpreadingTab = 'machine' | 'rolls' | 'layers';
export type WorkflowStepId = 'select' | 'spread' | 'scale' | 'report' | 'complete';

export interface WorkflowStep {
  id: WorkflowStepId;
  label: string;
  shortLabel: string;
}

export const WORKFLOW_STEPS: WorkflowStep[] = [
  { id: 'select', label: 'İş emri seç', shortLabel: 'Seç' },
  { id: 'spread', label: 'Serim', shortLabel: 'Serim' },
  { id: 'scale', label: 'Tartı / çıkış', shortLabel: 'Tartı' },
  { id: 'report', label: 'Rapor', shortLabel: 'Rapor' },
  { id: 'complete', label: 'Tamamla', shortLabel: 'Tamamla' },
];

export interface OfflineQueueItem {
  id: string;
  createdAt: string;
  orderId: number;
  orderNo: string;
  method: 'PUT';
  url: string;
  body: WorkOrderUpdateBody;
  attempts: number;
  lastError?: string;
}
