import {
  checkAssignmentAgainstRoute,
  checkRouteCompleteForCentralReceive,
  resolveProcessTypeForWorkshop,
  validateRouteSteps,
} from '@/lib/product-route';

describe('product-route', () => {
  const route = ['KESIM', 'DIKIM', 'BASKI', 'UTU', 'MERKEZ_DEPO'] as const;

  it('validates route steps', () => {
    expect(validateRouteSteps(['DIKIM', 'UTU', 'MERKEZ_DEPO']).valid).toBe(true);
    expect(validateRouteSteps(['DIKIM', 'X']).valid).toBe(false);
    expect(validateRouteSteps(['DIKIM', 'DIKIM']).valid).toBe(false);
    expect(validateRouteSteps(['MERKEZ_DEPO', 'DIKIM']).valid).toBe(false);
  });

  it('allows anything when the product has no route', () => {
    expect(checkAssignmentAgainstRoute([], 'UTU', []).ok).toBe(true);
  });

  it('rejects steps that are not in the route', () => {
    expect(checkAssignmentAgainstRoute([...route], 'NAKIS', []).ok).toBe(false);
  });

  it('requires previous steps to be completed in route order', () => {
    expect(checkAssignmentAgainstRoute([...route], 'UTU', []).ok).toBe(false);
    expect(checkAssignmentAgainstRoute([...route], 'BASKI', []).ok).toBe(false);
    expect(
      checkAssignmentAgainstRoute([...route], 'BASKI', [{ processType: 'DIKIM', status: 'HAZIR' }]).ok
    ).toBe(true);
    expect(
      checkAssignmentAgainstRoute([...route], 'UTU', [
        { processType: 'DIKIM', status: 'HAZIR' },
        { processType: 'BASKI', status: 'TESLIM_EDILDI' },
      ]).ok
    ).toBe(true);
  });

  it('resolves workshop process type from the route', () => {
    const result = resolveProcessTypeForWorkshop([...route], 'BASKI_NAKIS', [
      { processType: 'DIKIM', status: 'HAZIR' },
    ]);
    expect(result).toEqual({ ok: true, processType: 'BASKI' });
    expect(resolveProcessTypeForWorkshop([...route], 'UTU', []).ok).toBe(false);
    expect(resolveProcessTypeForWorkshop([], 'UTU', [])).toEqual({ ok: true, processType: 'UTU' });
  });

  it('blocks central warehouse receive until route steps are done', () => {
    expect(
      checkRouteCompleteForCentralReceive([...route], [{ processType: 'DIKIM', status: 'HAZIR' }]).ok
    ).toBe(false);
    expect(
      checkRouteCompleteForCentralReceive([...route], [
        { processType: 'DIKIM', status: 'HAZIR' },
        { processType: 'BASKI', status: 'HAZIR' },
        { processType: 'UTU', status: 'HAZIR' },
      ]).ok
    ).toBe(true);
  });

  it('treats custom steps as assignable route steps', () => {
    const custom = ['KESIM', 'DIKIM', 'OZEL:Pul', 'UTU', 'MERKEZ_DEPO'];
    expect(checkAssignmentAgainstRoute(custom, 'OZEL', [], 'Pul').ok).toBe(false);
    expect(
      checkAssignmentAgainstRoute(custom, 'OZEL', [{ processType: 'DIKIM', status: 'HAZIR' }], 'Pul').ok
    ).toBe(true);
    expect(checkAssignmentAgainstRoute(custom, 'OZEL', [{ processType: 'DIKIM', status: 'HAZIR' }], 'Yok').ok).toBe(false);
    expect(
      checkRouteCompleteForCentralReceive(custom, [
        { processType: 'DIKIM', status: 'HAZIR' },
        { processType: 'UTU', status: 'HAZIR' },
      ]).ok
    ).toBe(false);
  });
});
