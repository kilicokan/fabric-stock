/**
 * Kesim raporu yazdırma HTML şablonu (pencere.print).
 * İleride sunucu PDF’e taşınabilir; şimdilik istemci şablonu.
 */

export interface PrintReportInput {
  orderNo: string;
  customerName: string;
  productName: string;
  productCode: string;
  quantity: number;
  asortiCount: string;
  sizeDistribution: string;
  planKat: string;
  atilanKat: string;
  fabricWidthCm: string;
  fabricExitQuantity: string;
  fabricExitUnit: string;
  grammage: string;
  sizeLines: string;
  notes: string;
  layBreakdownHtml: string;
  rollBreakdownHtml: string;
  spreadingMode?: 'weight-first' | 'spread-then-weight';
  hasRolls: boolean;
  weightCalcHint?: {
    widthCm: number;
    lengthM: number;
  };
}

export function buildPrintReportHtml(input: PrintReportInput): string {
  const modeLabel =
    input.spreadingMode === 'spread-then-weight' ? 'Serim → Tartı' : 'Tartı → Serim';

  const calcSection =
    input.hasRolls && input.spreadingMode === 'spread-then-weight' && input.weightCalcHint
      ? `
        <div class="section">Hesaplama</div>
        <div class="mono muted">
          Tek Kat Alanı = En (m) × Boy (m) = ${(input.weightCalcHint.widthCm / 100).toFixed(2)} m × ${input.weightCalcHint.lengthM.toFixed(2)} m<br/>
          Tek Kat Ağırlığı = Alan × Gramaj / 1000<br/>
          Toplam Ağırlık = Tek Kat Ağırlığı × Kat Sayısı
        </div>`
      : '';

  const rollsSection = input.hasRolls
    ? `
        <div class="section">Top / Kat - Renk bazlı (${modeLabel})</div>
        <div>${input.rollBreakdownHtml}</div>
        ${calcSection}`
    : '';

  return `<!DOCTYPE html><html><head><title>Kesim Raporu - ${escapeHtml(input.orderNo)}</title>
<meta charset="utf-8"/>
<style>
  @page { margin: 16mm; }
  body{font-family:Inter,Arial,sans-serif;padding:32px;color:#111;font-size:13px}
  h1{font-size:20px;margin:0 0 4px}
  .meta{color:#64748b;font-size:12px;margin-bottom:24px}
  table{width:100%;border-collapse:collapse;margin:16px 0}
  th,td{border:1px solid #e2e8f0;padding:8px 12px;text-align:left;font-size:13px}
  th{background:#f8fafc;width:32%}
  .section{margin-top:20px;font-size:11px;font-weight:800;letter-spacing:.08em;color:#64748b;text-transform:uppercase}
  .mono{font-family:ui-monospace,SFMono-Regular,monospace;font-size:12px}
  .muted{color:#64748b}
  .footer{margin-top:32px;font-size:11px;color:#94a3b8}
</style></head><body>
  <h1>Kesim Raporu — ${escapeHtml(input.orderNo)}</h1>
  <div class="meta">${escapeHtml(input.customerName)} · ${escapeHtml(input.productName)} · ${escapeHtml(input.productCode || '')}</div>
  <div class="section">Özet</div>
  <table>
    <tr><th>Toplam adet</th><td>${input.quantity}</td></tr>
    <tr><th>Asorti</th><td>${escapeHtml(input.asortiCount || '—')} / ${escapeHtml(input.sizeDistribution || '—')}</td></tr>
    <tr><th>Plan kat</th><td>${escapeHtml(input.planKat || '—')}</td></tr>
    <tr><th>Atılan kat</th><td>${escapeHtml(input.atilanKat || '—')}</td></tr>
    <tr><th>Kumaş eni</th><td>${escapeHtml(input.fabricWidthCm || '—')} cm</td></tr>
    <tr><th>Kesilen</th><td>${escapeHtml(input.fabricExitQuantity || '—')} ${escapeHtml(input.fabricExitUnit || '')}</td></tr>
    <tr><th>Gramaj</th><td>${escapeHtml(input.grammage || '—')} g/m²</td></tr>
    <tr><th>Beden dağılımı</th><td>${escapeHtml(input.sizeLines || '—')}</td></tr>
    <tr><th>Not</th><td>${escapeHtml(input.notes || '—')}</td></tr>
  </table>
  <div class="section">Atılan kat - Renk bazlı</div>
  <div>${input.layBreakdownHtml}</div>
  ${rollsSection}
  <p class="footer">Oluşturulma: ${new Date().toLocaleString('tr-TR')}</p>
  <script>window.onload=()=>{window.print();}</script>
</body></html>`;
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function openPrintWindow(html: string): boolean {
  if (typeof window === 'undefined') return false;
  const win = window.open('', '_blank', 'width=800,height=900');
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
}
