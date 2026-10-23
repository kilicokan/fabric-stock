import type { ProcessType, WorkshopType } from "@prisma/client";

export const ROUTE_STEP_KEYS = [
  "KESIM",
  "DIKIM",
  "BASKI",
  "NAKIS",
  "ILIK_DUGME",
  "UTU",
  "MERKEZ_DEPO",
] as const;

export const CUSTOM_STEP_PREFIX = "OZEL:";
export type BuiltinRouteStep = (typeof ROUTE_STEP_KEYS)[number];
// Kullanıcı tanımlı adım: "OZEL:<ad>". Atamalarda processType=OZEL + stepName olarak saklanır.
export type RouteStep = BuiltinRouteStep | `OZEL:${string}`;

export const isCustomStep = (step: string) => step.startsWith(CUSTOM_STEP_PREFIX);
export const customStepName = (step: string) => step.slice(CUSTOM_STEP_PREFIX.length);

/** Bir rota adımının tracking kaydındaki karşılığı. MERKEZ_DEPO için null. */
export function processForStep(step: RouteStep): { processType: ProcessType; stepName?: string } | null {
  if (step === "MERKEZ_DEPO") return null;
  if (isCustomStep(step)) return { processType: "OZEL", stepName: customStepName(step) };
  return { processType: STEP_PROCESS_TYPE[step as Exclude<BuiltinRouteStep, "MERKEZ_DEPO">] };
}

const STEP_PROCESS_TYPE: Record<Exclude<BuiltinRouteStep, "MERKEZ_DEPO">, ProcessType> = {
  KESIM: "KESIM",
  DIKIM: "DIKIM",
  BASKI: "BASKI",
  NAKIS: "NAKIS",
  ILIK_DUGME: "ILIK_DUGME",
  UTU: "UTU",
};

const STEP_LABELS: Record<BuiltinRouteStep, string> = {
  KESIM: "Kesim",
  DIKIM: "Dikim",
  BASKI: "Baskı",
  NAKIS: "Nakış",
  ILIK_DUGME: "İlik Düğme",
  UTU: "Ütü",
  MERKEZ_DEPO: "Merkez Depo",
};

export const routeStepLabel = (step: string) =>
  isCustomStep(step) ? step.slice(CUSTOM_STEP_PREFIX.length) : STEP_LABELS[step as BuiltinRouteStep] ?? step;

const MAX_CUSTOM_NAME = 40;

export const isRouteStep = (value: unknown): value is RouteStep => {
  if (typeof value !== "string") return false;
  if (isCustomStep(value)) {
    const name = value.slice(CUSTOM_STEP_PREFIX.length);
    return name.trim() === name && name.length > 0 && name.length <= MAX_CUSTOM_NAME;
  }
  return (ROUTE_STEP_KEYS as readonly string[]).includes(value);
};

export function validateRouteSteps(
  value: unknown
): { valid: true; steps: RouteStep[] } | { valid: false; message: string } {
  if (!Array.isArray(value)) {
    return { valid: false, message: "Ürün rotası bir liste olmalıdır." };
  }
  const steps: RouteStep[] = [];
  for (const item of value) {
    if (!isRouteStep(item)) {
      return { valid: false, message: `Geçersiz rota adımı: ${String(item)}` };
    }
    if (steps.includes(item)) {
      return { valid: false, message: `Rota adımı tekrar ediyor: ${routeStepLabel(item)}` };
    }
    steps.push(item);
  }
  const depoIndex = steps.indexOf("MERKEZ_DEPO");
  if (depoIndex !== -1 && depoIndex !== steps.length - 1) {
    return { valid: false, message: "Merkez Depo rotanın son adımı olmalıdır." };
  }
  return { valid: true, steps };
}

/** Veritabanından gelen Json değerini güvenli şekilde adım listesine çevirir. */
export function parseStoredRoute(value: unknown): RouteStep[] {
  if (!Array.isArray(value)) return [];
  const out: RouteStep[] = [];
  for (const item of value) {
    if (isRouteStep(item) && !out.includes(item)) out.push(item);
  }
  return out;
}

/** Bir kayıt processType'ının hangi rota adımlarını karşıladığı (eski BASKI_NAKIS hem baskı hem nakış). */
function stepsCoveredByProcessType(processType: ProcessType, stepName?: string | null): RouteStep[] {
  if (processType === "BASKI_NAKIS") return ["BASKI", "NAKIS"];
  if (processType === "OZEL") return stepName ? [`${CUSTOM_STEP_PREFIX}${stepName}`] : [];
  return [processType as RouteStep];
}

/** Atölye uzmanlığının üstlenebileceği rota adımları (özel adımları her atölye üstlenebilir). */
export function stepsForSpecialization(specialization: WorkshopType): RouteStep[] {
  switch (specialization) {
    case "TUM":
      return ROUTE_STEP_KEYS.filter((step) => step !== "MERKEZ_DEPO");
    case "BASKI_NAKIS":
      return ["BASKI", "NAKIS"];
    default:
      return [specialization as RouteStep];
  }
}

export interface RouteTrackingLike {
  processType: ProcessType;
  status: string;
  stepName?: string | null;
}

const DONE_STATUSES = ["HAZIR", "TESLIM_EDILDI"];

export function isStepDone(step: RouteStep, trackings: RouteTrackingLike[]): boolean {
  return trackings.some(
    (t) =>
      DONE_STATUSES.includes(t.status) &&
      stepsCoveredByProcessType(t.processType, t.stepName).includes(step)
  );
}

export function hasStepRecord(step: RouteStep, trackings: RouteTrackingLike[]): boolean {
  return trackings.some(
    (t) =>
      t.status !== "IPTAL_EDILDI" &&
      stepsCoveredByProcessType(t.processType, t.stepName).includes(step)
  );
}

/** Atölye adımlarını (Merkez Depo hariç) döndürür. */
const workshopSteps = (route: RouteStep[]) => route.filter((step) => step !== "MERKEZ_DEPO");

/**
 * Rotaya göre bir atamanın yapılıp yapılamayacağını denetler.
 * Boş rota = eski davranış (kısıtlama yok); özel adım ise rota olmadan atanamaz.
 */
export function checkAssignmentAgainstRoute(
  route: RouteStep[],
  processType: ProcessType,
  trackings: RouteTrackingLike[],
  stepName?: string | null
): { ok: true } | { ok: false; message?: string } {
  const steps = workshopSteps(route);
  const covered = stepsCoveredByProcessType(processType, stepName);
  const label = routeStepLabel(covered[0] ?? processType);

  if (processType === "OZEL" && !steps.some((step) => covered.includes(step))) {
    return { ok: false, message: `Bu ürünün rotasında ${label} adımı yok.` };
  }
  if (steps.length === 0 || processType === "KESIM") return { ok: true };

  const index = steps.findIndex((step) => covered.includes(step));
  if (index === -1) {
    return {
      ok: false,
      message: `Bu ürünün rotasında ${label} adımı yok. Rota: ${route
        .map(routeStepLabel)
        .join(" → ")}`,
    };
  }

  for (const previous of steps.slice(0, index)) {
    if (previous === "KESIM") continue;
    if (!isStepDone(previous, trackings)) {
      return {
        ok: false,
        message: `Ürün rotasına göre önce ${routeStepLabel(previous)} adımı tamamlanmalıdır.`,
      };
    }
  }
  return { ok: true };
}

/**
 * Atölye uzmanlığına ve rotaya göre bu atölyenin yapacağı sıradaki adımı bulur.
 * Rota yoksa eski uzmanlık eşlemesi kullanılır.
 */
export function resolveProcessTypeForWorkshop(
  route: RouteStep[],
  specialization: WorkshopType,
  trackings: RouteTrackingLike[]
): { ok: true; processType: ProcessType; stepName?: string } | { ok: false; message?: string } {
  if (workshopSteps(route).length === 0) {
    const legacy: Partial<Record<WorkshopType, ProcessType>> = {
      UTU: "UTU",
      BASKI_NAKIS: "BASKI_NAKIS",
      KESIM: "KESIM",
      ILIK_DUGME: "ILIK_DUGME",
    };
    return { ok: true, processType: legacy[specialization] ?? "DIKIM" };
  }

  const supported = stepsForSpecialization(specialization);
  const candidates = workshopSteps(route).filter(
    (step) => (supported.includes(step) || isCustomStep(step)) && !hasStepRecord(step, trackings)
  );
  for (const step of candidates) {
    const target = processForStep(step);
    if (!target) continue;
    const check = checkAssignmentAgainstRoute(route, target.processType, trackings, target.stepName);
    if (check.ok) {
      return { ok: true, processType: target.processType, stepName: target.stepName };
    }
  }

  return {
    ok: false,
    message: `Ürün rotasına (${route.map(routeStepLabel).join(" → ")}) göre bu atölye için uygun sıradaki adım yok.`,
  };
}

/** Rotadaki tüm atölye adımları tamamlandı mı (Merkez Depo teslimi için)? */
export function checkRouteCompleteForCentralReceive(
  route: RouteStep[],
  trackings: RouteTrackingLike[]
): { ok: true } | { ok: false; message?: string } {
  for (const step of workshopSteps(route)) {
    if (step === "KESIM") continue;
    if (!isStepDone(step, trackings)) {
      return {
        ok: false,
        message: `Ürün rotasına göre ${routeStepLabel(step)} adımı tamamlanmadan merkez depoya teslim alınamaz.`,
      };
    }
  }
  return { ok: true };
}

export function nextRouteStep(route: RouteStep[], trackings: RouteTrackingLike[]): RouteStep | null {
  for (const step of route) {
    if (step === "MERKEZ_DEPO") return step;
    if (step === "KESIM") continue;
    if (!isStepDone(step, trackings)) return step;
  }
  return null;
}
