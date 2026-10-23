/**
 * Kesimhane saf hesap fonksiyonları (UI'dan bağımsız).
 * Unit test: node cuttingCalculations.test.mjs
 */

export type RollLike = {
  id?: string;
  color: string;
  weightKg: number;
  calculatedLayers: number;
  pieceCount: number;
  meters?: number;
  createdAt?: string;
  startLayer?: number;
  countedLayers?: number;
};

export type RollTotals = {
  weightKg: number;
  layers: number;
  pieceCount: number;
  rolls: number;
};

export type SpreadingLayer = {
  color: string;
  layerNumber: number;
  weightKg: number;
  pieceCount: number;
};

/** Sayaç aralığını top başlangıçlarına göre renk/top bazında hesaplar. */
export function assignCountedLayers<T extends RollLike>(rolls: T[], currentLayer: number): T[] {
  const ordered = [...rolls].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  const counted = new Map<T, number>();
  ordered.forEach((roll, index) => {
    const start = roll.startLayer ?? 0;
    const end = index < ordered.length - 1 ? ordered[index + 1].startLayer ?? start : currentLayer;
    counted.set(roll, Math.max(0, end - start));
  });
  return rolls.map(roll => ({ ...roll, countedLayers: counted.get(roll) ?? 0 }));
}

export function layerMismatch(calculated: number, counted: number, tolerance = 1): boolean {
  return calculated > 0 && counted > 0 && Math.abs(calculated - counted) > tolerance;
}

export function calculateLayersFromMeters(params: {
  lengthM: number;
  widthCm: number;
  gramaje: number;
  rollKg: number;
}): { layers: number; totalWeightKg: number } | null {
  const { lengthM, widthCm, gramaje, rollKg } = params;
  if (![lengthM, widthCm, gramaje, rollKg].every(value => Number.isFinite(value) && value > 0)) return null;
  const singleLayerKg = ((widthCm / 100) * lengthM * gramaje) / 1000;
  if (singleLayerKg <= 0) return null;
  const layers = Math.max(1, Math.floor(rollKg / singleLayerKg));
  return { layers, totalWeightKg: Number((singleLayerKg * layers).toFixed(3)) };
}

/** Plan kat: atılan kat × asorti veya sipariş / asorti (yukarı yuvarla) */
export function calculatePlanKat(
  orderQuantity: number,
  asortiCount: string | number,
  atilanKat?: string | number
): string {
  const asortiNum = typeof asortiCount === 'number' ? asortiCount : parseFloat(String(asortiCount));
  if (!asortiNum || asortiNum <= 0 || !orderQuantity || orderQuantity <= 0) return '';

  const layerValue =
    typeof atilanKat === 'number' ? atilanKat : Number.parseFloat(String(atilanKat || ''));
  if (Number.isFinite(layerValue) && layerValue > 0) {
    return String(Math.round(layerValue * asortiNum));
  }

  return String(Math.ceil(orderQuantity / asortiNum));
}

/**
 * Ağırlıktan kat sayısı:
 * tekKatKg = (en_m × boy_m × gramaj) / 1000
 * kat = floor(topKg / tekKatKg)
 */
export function calculateLayersFromWeight(
  weightKg: number,
  gramaje: number,
  widthCm: number,
  lengthM: number
): number {
  if (gramaje <= 0 || widthCm <= 0 || lengthM <= 0 || weightKg <= 0) return 0;
  const widthM = widthCm / 100;
  const areaPerLayerM2 = widthM * lengthM;
  if (areaPerLayerM2 <= 0) return 0;
  const weightPerLayerKg = (areaPerLayerM2 * gramaje) / 1000;
  if (weightPerLayerKg <= 0) return 0;
  return Math.floor(weightKg / weightPerLayerKg);
}

/** Tek kat ağırlığı (kg) */
export function calculateSingleLayerWeightKg(
  gramaje: number,
  widthCm: number,
  lengthM: number
): number {
  if (gramaje <= 0 || widthCm <= 0 || lengthM <= 0) return 0;
  const widthM = widthCm / 100;
  return (widthM * lengthM * gramaje) / 1000;
}

export function calculatePastalWeightKg(
  widthM: number,
  lengthM: number,
  arealWeight: number,
  arealWeightUnit: 'g/m2' | 'kg/m2' = 'g/m2'
): number {
  if (
    !Number.isFinite(widthM) ||
    !Number.isFinite(lengthM) ||
    !Number.isFinite(arealWeight) ||
    widthM <= 0 ||
    lengthM <= 0 ||
    arealWeight <= 0
  ) {
    return 0;
  }
  const weightKgPerSquareMeter = arealWeightUnit === 'g/m2' ? arealWeight / 1000 : arealWeight;
  return widthM * lengthM * weightKgPerSquareMeter;
}

export function calculateOutputPieces(layerCount: number, assortmentCount: number): number | null {
  if (
    !Number.isInteger(layerCount) ||
    !Number.isInteger(assortmentCount) ||
    layerCount <= 0 ||
    assortmentCount <= 0
  ) {
    return null;
  }
  return layerCount * assortmentCount;
}

export function calculateUnitGrammage(
  fabricKg: number,
  fabricMeters: number,
  widthCm: number,
  grammageGsm: number,
  outputPieces: number
): number | null {
  if (
    !Number.isFinite(fabricKg) ||
    !Number.isFinite(fabricMeters) ||
    !Number.isInteger(outputPieces) ||
    fabricKg < 0 ||
    fabricMeters < 0 ||
    outputPieces <= 0 ||
    (fabricKg === 0 && fabricMeters === 0)
  ) {
    return null;
  }

  let totalFabricGrams = fabricKg * 1000;
  if (fabricMeters > 0) {
    if (
      !Number.isFinite(widthCm) ||
      !Number.isFinite(grammageGsm) ||
      widthCm <= 0 ||
      grammageGsm <= 0
    ) {
      return null;
    }
    totalFabricGrams += fabricMeters * (widthCm / 100) * grammageGsm;
  }
  return Math.round((totalFabricGrams / outputPieces) * 100) / 100;
}

/**
 * Fiili gramaj (g/m²):
 * gramaj = (toplamKg × 1000) / (en_m × boy_m × kat)
 */
export function calculateActualGrammage(
  totalCutKg: number,
  widthCm: number,
  lengthM: number,
  layerCount: number
): number {
  if (totalCutKg <= 0 || widthCm <= 0 || lengthM <= 0 || layerCount <= 0) return 0;
  const fabricWidthM = widthCm / 100;
  const singleLayerArea = fabricWidthM * lengthM;
  if (singleLayerArea <= 0) return 0;
  const gramaj = (totalCutKg * 1000) / (singleLayerArea * layerCount);
  return Math.round(gramaj * 100) / 100;
}

/** Metre bazlı top için tahmini kat (referans ~30 kg top varsayımı) */
export function estimateLayersFromMeter(
  lengthM: number,
  gramaje: number,
  widthCm: number,
  referenceRollKg = 30
): { layers: number; totalWeightKg: number } {
  const single = calculateSingleLayerWeightKg(gramaje, widthCm, lengthM);
  if (single <= 0) return { layers: 0, totalWeightKg: 0 };
  const layers = Math.max(1, Math.floor(referenceRollKg / single));
  return { layers, totalWeightKg: single * layers };
}

export function calculateRollTotalsByColor(rolls: RollLike[]): Map<string, RollTotals> {
  const totals = new Map<string, RollTotals>();
  rolls.forEach(roll => {
    const color = (roll.color || '').trim() || 'Renk bekleniyor';
    const current = totals.get(color) || { weightKg: 0, layers: 0, pieceCount: 0, rolls: 0 };
    current.weightKg += Number(roll.weightKg) || 0;
    current.layers += Number(roll.calculatedLayers) || 0;
    current.pieceCount += Number(roll.pieceCount) || 0;
    current.rolls += 1;
    totals.set(color, current);
  });
  return totals;
}

export function rollEntriesToSpreadingLayers(
  rolls: Array<RollLike & { color: string }>
): SpreadingLayer[] {
  const layersByColor = new Map<string, SpreadingLayer>();
  for (const roll of rolls) {
    const color = roll.color.trim() || 'Renk bekleniyor';
    const layer = layersByColor.get(color) || {
      color,
      layerNumber: 0,
      weightKg: 0,
      pieceCount: 0,
    };
    layer.layerNumber += Number(roll.calculatedLayers) || 0;
    layer.weightKg += Number(roll.weightKg) || 0;
    layer.pieceCount += Number(roll.meters ?? roll.pieceCount) || 0;
    layersByColor.set(color, layer);
  }
  return layersByColor.size > 0
    ? Array.from(layersByColor.values())
    : [{ color: '', layerNumber: 1, weightKg: 0, pieceCount: 0 }];
}

/** Plan kat ile gerçek kat sapma oranı (0–1+); eşik dışı true */
export function isLayerPlanMismatch(
  planKat: number,
  actualLayers: number,
  toleranceRatio = 0.15
): boolean {
  if (planKat <= 0 || actualLayers <= 0) return false;
  return Math.abs(actualLayers - planKat) > planKat * toleranceRatio;
}
