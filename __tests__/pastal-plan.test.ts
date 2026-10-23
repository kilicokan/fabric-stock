import { appendPastalPlanEvent, mergePastalPlan, parsePastalPlan } from '../lib/pastalPlan';
import type { PastalPlan } from '../lib/pastalPlan';

const plan: PastalPlan = {
  plannedLayers: 45,
  colors: [{ color: 'Siyah', layers: 45, weightKg: 230 }],
  source: 'manual',
  updatedAt: '2026-10-23T08:00:00.000Z',
};

describe('pastal plan sewingNotes persistence', () => {
  it('round-trips a manual plan and preserves existing notes', () => {
    const original = JSON.stringify({ checklist: [{ text: 'Kontrol' }], cuttingReport: { planKat: '12' } });
    const merged = mergePastalPlan(original, plan);

    expect(parsePastalPlan(merged)).toEqual(plan);
    expect(JSON.parse(merged)).toMatchObject({
      checklist: [{ text: 'Kontrol' }],
      cuttingReport: { planKat: '12' },
    });
  });

  it('preserves non-JSON legacy notes while adding a plan', () => {
    const merged = mergePastalPlan('Eski açıklama', plan);

    expect(JSON.parse(merged)).toMatchObject({ legacyNotes: 'Eski açıklama', pastalPlan: plan });
  });

  it('ignores invalid or missing plans so the caller can use the fallback', () => {
    expect(parsePastalPlan(null)).toBeNull();
    expect(parsePastalPlan('{invalid')).toBeNull();
    expect(parsePastalPlan(JSON.stringify({ pastalPlan: { plannedLayers: 0, colors: [] } }))).toBeNull();
  });

  it('appends an operator and timestamp event without overwriting work order data', () => {
    const event = {
      type: 'color-completed' as const,
      color: 'Siyah',
      actualLayers: 40,
      targetLayers: 45,
      missingLayers: 5,
      operator: 'Operatör A',
      at: '2026-10-23T08:00:00.000Z',
    };
    const merged = appendPastalPlanEvent(JSON.stringify({ pastalPlan: plan }), event);
    const notes = JSON.parse(merged);

    expect(notes.pastalPlan).toEqual(plan);
    expect(notes.pastalPlanEvents).toEqual([event]);
  });
});
