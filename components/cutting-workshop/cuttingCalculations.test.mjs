/**
 * Basit node test — çalıştır: node cuttingCalculations.test.mjs
 * (TypeScript derlemesi yok; mantığı burada kopyalayıp doğrularız)
 */

function calculatePlanKat(orderQuantity, asortiCount, atilanKat) {
  const asortiNum = parseFloat(asortiCount);
  if (!asortiNum || asortiNum <= 0 || !orderQuantity || orderQuantity <= 0) return '';
  const layerValue = Number.parseFloat(atilanKat || '');
  if (Number.isFinite(layerValue) && layerValue > 0) {
    return String(Math.round(layerValue * asortiNum));
  }
  return String(Math.ceil(orderQuantity / asortiNum));
}

function calculateLayersFromWeight(weightKg, gramaje, widthCm, lengthM) {
  if (gramaje <= 0 || widthCm <= 0 || lengthM <= 0 || weightKg <= 0) return 0;
  const widthM = widthCm / 100;
  const areaPerLayerM2 = widthM * lengthM;
  if (areaPerLayerM2 <= 0) return 0;
  const weightPerLayerKg = (areaPerLayerM2 * gramaje) / 1000;
  if (weightPerLayerKg <= 0) return 0;
  return Math.floor(weightKg / weightPerLayerKg);
}

function calculateActualGrammage(totalCutKg, widthCm, lengthM, layerCount) {
  if (totalCutKg <= 0 || widthCm <= 0 || lengthM <= 0 || layerCount <= 0) return 0;
  const fabricWidthM = widthCm / 100;
  const singleLayerArea = fabricWidthM * lengthM;
  if (singleLayerArea <= 0) return 0;
  const gramaj = (totalCutKg * 1000) / (singleLayerArea * layerCount);
  return Math.round(gramaj * 100) / 100;
}

function calculatePastalWeightKg(widthM, lengthM, arealWeight, arealWeightUnit = 'g/m2') {
  if (widthM <= 0 || lengthM <= 0 || arealWeight <= 0) return 0;
  const weightKgPerSquareMeter = arealWeightUnit === 'g/m2' ? arealWeight / 1000 : arealWeight;
  return widthM * lengthM * weightKgPerSquareMeter;
}

function calculateOutputPieces(layerCount, assortmentCount) {
  if (!Number.isInteger(layerCount) || !Number.isInteger(assortmentCount) || layerCount <= 0 || assortmentCount <= 0) {
    return null;
  }
  return layerCount * assortmentCount;
}

function calculateUnitGrammage(fabricKg, fabricMeters, widthCm, grammageGsm, outputPieces) {
  if (fabricKg < 0 || fabricMeters < 0 || !Number.isInteger(outputPieces) || outputPieces <= 0 || (fabricKg === 0 && fabricMeters === 0)) return null;
  let totalFabricGrams = fabricKg * 1000;
  if (fabricMeters > 0) {
    if (widthCm <= 0 || grammageGsm <= 0) return null;
    totalFabricGrams += fabricMeters * (widthCm / 100) * grammageGsm;
  }
  return Math.round((totalFabricGrams / outputPieces) * 100) / 100;
}

function isLayerPlanMismatch(planKat, actualLayers, toleranceRatio = 0.15) {
  if (planKat <= 0 || actualLayers <= 0) return false;
  return Math.abs(actualLayers - planKat) > planKat * toleranceRatio;
}

function rollEntriesToSpreadingLayers(rolls) {
  const layersByColor = new Map();
  for (const roll of rolls) {
    const color = roll.color.trim() || 'Renk bekleniyor';
    const layer = layersByColor.get(color) || { color, layerNumber: 0, weightKg: 0, pieceCount: 0 };
    layer.layerNumber += Number(roll.calculatedLayers) || 0;
    layer.weightKg += Number(roll.weightKg) || 0;
    layer.pieceCount += Number(roll.pieceCount) || 0;
    layersByColor.set(color, layer);
  }
  return layersByColor.size > 0
    ? Array.from(layersByColor.values())
    : [{ color: '', layerNumber: 1, weightKg: 0, pieceCount: 0 }];
}

function assignCountedLayers(rolls, currentLayer) {
  const ordered = [...rolls].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const counted = new Map();
  ordered.forEach((roll, index) => {
    const start = roll.startLayer ?? 0;
    const end = index < ordered.length - 1 ? ordered[index + 1].startLayer ?? start : currentLayer;
    counted.set(roll.id, Math.max(0, end - start));
  });
  return rolls.map(roll => ({ ...roll, countedLayers: counted.get(roll.id) ?? 0 }));
}

function layerMismatch(calculated, counted, tolerance = 1) {
  return calculated > 0 && counted > 0 && Math.abs(calculated - counted) > tolerance;
}

function calculateLayersFromMeters({ lengthM, widthCm, gramaje, rollKg }) {
  if (![lengthM, widthCm, gramaje, rollKg].every(v => Number.isFinite(v) && v > 0)) return null;
  const singleLayerKg = ((widthCm / 100) * lengthM * gramaje) / 1000;
  if (singleLayerKg <= 0) return null;
  const layers = Math.max(1, Math.floor(rollKg / singleLayerKg));
  return { layers, totalWeightKg: Number((singleLayerKg * layers).toFixed(3)) };
}

let passed = 0;
let failed = 0;

function assert(name, cond) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}`);
  }
}

console.log('cuttingCalculations tests\n');

// Plan kat: 100 adet / 4 asorti = 25
assert('planKat ceil(100/4)=25', calculatePlanKat(100, '4') === '25');
// Plan kat: atılan 10 × asorti 4 = 40
assert('planKat 10*4=40', calculatePlanKat(100, '4', '10') === '40');
assert('planKat invalid asorti', calculatePlanKat(100, '0') === '');

// Kat: 180cm en, 9.42m boy, 200 g/m² → tek kat ≈ 3.391 kg → 30kg ≈ 8 kat
const layers = calculateLayersFromWeight(30, 200, 180, 9.42);
assert(`layersFromWeight ~8 (got ${layers})`, layers === 8);

// Sıfır girdi
assert('layers zero weight', calculateLayersFromWeight(0, 200, 180, 9.42) === 0);

// Gramaj geri hesap: 8 kat × 3.3912 ≈ 27.13 kg → ~200
const g = calculateActualGrammage(27.1296, 180, 9.42, 8);
assert(`actualGrammage ~200 (got ${g})`, Math.abs(g - 200) < 0.5);

// Pastal weight: 1.50m × 11m × 195g/m² = 3.2175kg
const pastalKg = calculatePastalWeightKg(1.5, 11, 195);
assert(`pastal weight ~3.2175kg (got ${pastalKg})`, Math.abs(pastalKg - 3.2175) < 0.0001);
assert(
  'pastal weight accepts kg/m²',
  Math.abs(calculatePastalWeightKg(1.5, 11, 0.195, 'kg/m2') - 3.2175) < 0.0001
);

// Çıkan adet: 94 kat × 4 asorti = 376 adet
assert('output pieces 94*4=376', calculateOutputPieces(94, 4) === 376);
assert('output pieces reject invalid counts', calculateOutputPieces(0, 4) === null);

// Birim gramaj: toplam kullanılan kumaş gramı / çıkan adet
assert('unit grammage from kg', calculateUnitGrammage(3.2175, 0, 150, 195, 4) === 804.38);
assert('unit grammage from meters', calculateUnitGrammage(0, 11, 150, 195, 4) === 804.38);
assert('unit grammage from mixed units', calculateUnitGrammage(1, 1, 150, 200, 2) === 650);
assert('unit grammage needs width and gsm for meters', calculateUnitGrammage(0, 11, 0, 195, 4) === null);

const spreadLayers = rollEntriesToSpreadingLayers([
  { color: 'Siyah', calculatedLayers: 8, weightKg: 30, pieceCount: 0 },
  { color: 'Siyah', calculatedLayers: 4, weightKg: 15, pieceCount: 0 },
  { color: 'Beyaz', calculatedLayers: 6, weightKg: 21, pieceCount: 0 },
]);
assert(
  'weighed rolls transfer to stage 2 by color',
  spreadLayers.length === 2 &&
    spreadLayers[0].color === 'Siyah' &&
    spreadLayers[0].layerNumber === 12 &&
    spreadLayers[0].weightKg === 45 &&
    spreadLayers[1].color === 'Beyaz' &&
    spreadLayers[1].layerNumber === 6
);
assert('empty rolls keep one editable stage 2 row', rollEntriesToSpreadingLayers([]).length === 1);
const countedRolls = assignCountedLayers([
  { id: 'r1', createdAt: '2026-10-22T10:00:00Z', startLayer: 2 },
  { id: 'r2', createdAt: '2026-10-22T10:05:00Z', startLayer: 10 },
], 18);
assert('per-roll sensor/manual layers use consecutive start points', countedRolls[0].countedLayers === 8 && countedRolls[1].countedLayers === 8);
assert('layer mismatch allows one-layer tolerance', !layerMismatch(8, 9) && layerMismatch(8, 10));
const meterLayers = calculateLayersFromMeters({ lengthM: 2, widthCm: 180, gramaje: 200, rollKg: 7.2 });
assert('meter-based roll count validates and calculates layers', meterLayers?.layers === 10);
assert('meter-based roll rejects missing fabric inputs', calculateLayersFromMeters({ lengthM: 0, widthCm: 180, gramaje: 200, rollKg: 7.2 }) === null);

// Uyumsuzluk
assert('mismatch 100 vs 50', isLayerPlanMismatch(100, 50) === true);
assert('match 100 vs 95', isLayerPlanMismatch(100, 95) === false);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
