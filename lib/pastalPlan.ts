export interface PastalPlanColor {
  color: string;
  layers: number;
  weightKg: number;
}

export interface PastalPlan {
  plannedLayers: number;
  colors: PastalPlanColor[];
  source: "manual" | "fallback";
  updatedAt: string;
}

export interface PastalPlanEvent {
  type: "color-completed" | "color-reopened";
  color: string;
  actualLayers?: number;
  targetLayers?: number;
  missingLayers?: number;
  operator: string;
  at: string;
  rawCounterValue?: number;
  counterStartValue?: number;
  hadCounterReset?: boolean;
}

export const parsePastalPlan = (sewingNotes: string | null | undefined): PastalPlan | null => {
  if (!sewingNotes) return null;
  try {
    const notes: unknown = JSON.parse(sewingNotes);
    if (!notes || typeof notes !== "object" || !("pastalPlan" in notes)) return null;
    const plan = (notes as { pastalPlan?: unknown }).pastalPlan;
    if (!plan || typeof plan !== "object") return null;
    const value = plan as Partial<PastalPlan>;
    if (!Number.isInteger(value.plannedLayers) || Number(value.plannedLayers) <= 0 || !Array.isArray(value.colors)) {
      return null;
    }
    const colors = value.colors
      .filter((item): item is PastalPlanColor =>
        Boolean(
          item &&
          typeof item.color === "string" &&
          item.color.trim() &&
          Number.isInteger(item.layers) &&
          item.layers > 0 &&
          Number.isFinite(item.weightKg) &&
          item.weightKg >= 0,
        ),
      )
      .map(item => ({ color: item.color.trim(), layers: item.layers, weightKg: item.weightKg }));
    if (colors.length === 0) return null;

    return {
      plannedLayers: Number(value.plannedLayers),
      colors,
      source: "manual",
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
    };
  } catch {
    return null;
  }
};

export const mergePastalPlan = (sewingNotes: string | null | undefined, plan: PastalPlan): string => {
  let notes: Record<string, unknown> = {};
  if (sewingNotes) {
    try {
      const parsed: unknown = JSON.parse(sewingNotes);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        notes = parsed as Record<string, unknown>;
      } else {
        notes = { legacyNotes: sewingNotes };
      }
    } catch {
      notes = { legacyNotes: sewingNotes };
    }
  }
  return JSON.stringify({ ...notes, pastalPlan: plan });
};

export const appendPastalPlanEvent = (sewingNotes: string | null | undefined, event: PastalPlanEvent): string => {
  let notes: Record<string, unknown> = {};
  if (sewingNotes) {
    try {
      const parsed: unknown = JSON.parse(sewingNotes);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        notes = parsed as Record<string, unknown>;
      } else {
        notes = { legacyNotes: sewingNotes };
      }
    } catch {
      notes = { legacyNotes: sewingNotes };
    }
  }
  const existing = Array.isArray(notes.pastalPlanEvents)
    ? notes.pastalPlanEvents.filter(item => item && typeof item === "object")
    : [];
  return JSON.stringify({ ...notes, pastalPlanEvents: [...existing, event].slice(-100) });
};
