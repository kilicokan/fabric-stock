export interface PlcLayerSample {
  layer: number;
  at: number;
}

export const getActualLayersForColor = (currentLayer: number, startLayer: number): number =>
  Math.max(0, currentLayer - startLayer);

export const isPlcCounterReset = (
  previous: PlcLayerSample | null,
  currentLayer: number,
  now: number,
): boolean =>
  previous !== null &&
  now - previous.at <= 5000 &&
  previous.layer - currentLayer > 5;

export type ManualColorCounterResolution =
  | { kind: 'invalid' }
  | { kind: 'confirm-reset' }
  | { kind: 'zero-layers' }
  | { kind: 'resolved'; layers: number; counterStartLayer: number; hadCounterReset: boolean };

export const resolveManualColorCounter = (
  rawCounterValue: number,
  counterStartLayer: number,
  resetConfirmed: boolean | null,
): ManualColorCounterResolution => {
  if (
    !Number.isInteger(rawCounterValue) ||
    rawCounterValue <= 0 ||
    !Number.isInteger(counterStartLayer) ||
    counterStartLayer < 0
  ) {
    return { kind: 'invalid' };
  }

  const suspectedReset = counterStartLayer > 0 && rawCounterValue <= counterStartLayer;
  if (suspectedReset && resetConfirmed === null) return { kind: 'confirm-reset' };
  if (suspectedReset && resetConfirmed === false) return { kind: 'zero-layers' };

  const hadCounterReset = suspectedReset && resetConfirmed === true;
  const counterStart = hadCounterReset ? 0 : counterStartLayer;
  const layers = rawCounterValue - counterStart;
  if (layers <= 0) return { kind: 'zero-layers' };
  return { kind: 'resolved', layers, counterStartLayer: counterStart, hadCounterReset };
};
