import {
  getActualLayersForColor,
  isPlcCounterReset,
  resolveManualColorCounter,
} from '../lib/cuttingWorkflow';

describe('cutting color and PLC counter workflow', () => {
  it('measures each color from its persisted PLC start layer', () => {
    expect(getActualLayersForColor(45, 0)).toBe(45);
    expect(getActualLayersForColor(90, 45)).toBe(45);
    expect(getActualLayersForColor(44, 45)).toBe(0);
  });

  it('detects a drop greater than five layers within five seconds', () => {
    expect(isPlcCounterReset({ layer: 42, at: 1000 }, 0, 5000)).toBe(true);
    expect(isPlcCounterReset({ layer: 42, at: 1000 }, 37, 5000)).toBe(false);
    expect(isPlcCounterReset({ layer: 42, at: 1000 }, 0, 6001)).toBe(false);
  });

  it('requests reset confirmation when a later color counter is not greater than the previous end', () => {
    expect(resolveManualColorCounter(45, 45, null)).toEqual({ kind: 'confirm-reset' });
    expect(resolveManualColorCounter(44, 45, null)).toEqual({ kind: 'confirm-reset' });
  });

  it('uses cumulative totals unless a reset is confirmed, and rejects zero produced layers', () => {
    expect(resolveManualColorCounter(90, 45, null)).toEqual({
      kind: 'resolved',
      layers: 45,
      counterStartLayer: 45,
      hadCounterReset: false,
    });
    expect(resolveManualColorCounter(45, 45, true)).toEqual({
      kind: 'resolved',
      layers: 45,
      counterStartLayer: 0,
      hadCounterReset: true,
    });
    expect(resolveManualColorCounter(45, 45, false)).toEqual({ kind: 'zero-layers' });
    expect(resolveManualColorCounter(45, 0, null)).toMatchObject({ kind: 'resolved', layers: 45 });
  });
});
