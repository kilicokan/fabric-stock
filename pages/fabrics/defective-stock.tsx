'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../../lib/api";

type DefectiveStockItem = {
  id: number;
  fabricId: number;
  fabricName: string;
  color: string;
  defectiveQuantity: number;
  unit: string;
  supplierCode?: string | null;
  supplierName?: string | null;
  createdAt: string;
};

type DocumentFormState = {
  documentType: "irsaliye" | "fatura";
  documentNumber: string;
  date: string;
  supplierCode: string;
  supplierName: string;
  entryWarehouseCode: string;
  exitWarehouseCode: string;
  quantity: string;
  unitType: "kg" | "m";
  total: string;
  reason: string;
};

const DEFAULT_FORM: DocumentFormState = {
  documentType: "irsaliye",
  documentNumber: "",
  date: new Date().toISOString().slice(0, 10),
  supplierCode: "",
  supplierName: "",
  entryWarehouseCode: "",
  exitWarehouseCode: "",
  quantity: "",
  unitType: "kg",
  total: "0",
  reason: "İade",
};

type ContextMenuState = {
  visible: boolean;
  x: number;
  y: number;
};

export default function DefectiveStockPage() {
  const [items, setItems] = useState<DefectiveStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 });
  const [selectedItem, setSelectedItem] = useState<DefectiveStockItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<DocumentFormState>(DEFAULT_FORM);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<DefectiveStockItem[]>("/fabrics/defective-stock");
      setItems(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error(err);
      const axiosError = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const status = axiosError.response?.status;
      const message = axiosError.response?.data?.message || axiosError.message || "Hatalı stok listesi yüklenemedi.";
      if (status === 401) {
        setError("Yetkisiz erişim. Lütfen tekrar giriş yapın.");
      } else if (status === 403) {
        setError("Bu sayfaya erişim yetkiniz yok.");
      } else {
        setError(message);
      }
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    const handleClick = () => setContextMenu({ visible: false, x: 0, y: 0 });
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextMenu({ visible: false, x: 0, y: 0 });
    };
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const openContextMenu = useCallback((event: React.MouseEvent<HTMLElement>, item: DefectiveStockItem) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedItem(item);
    setContextMenu({ visible: true, x: event.clientX, y: event.clientY });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0 });
  }, []);

  const openReturnForm = useCallback((documentType: "irsaliye" | "fatura") => {
    if (!selectedItem) return;
    setForm({
      ...DEFAULT_FORM,
      documentType,
      supplierName: selectedItem.supplierName || "",
      supplierCode: selectedItem.supplierCode || "",
      quantity: String(selectedItem.defectiveQuantity),
      unitType: (selectedItem.unit?.toLowerCase().startsWith("m") ? "m" : "kg") as "kg" | "m",
      reason: documentType === "irsaliye" ? "İade" : "İade faturası",
    });
    setFormOpen(true);
    closeContextMenu();
  }, [selectedItem, closeContextMenu]);

  const handleFormSubmit = useCallback(async () => {
    if (!selectedItem) return;
    setSubmitting(true);
    setError(null);
    try {
      const quantity = Number(form.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setError("Miktar sıfırdan büyük olmalıdır.");
        setSubmitting(false);
        return;
      }
      if (quantity > selectedItem.defectiveQuantity) {
        setError(`Miktar hatalı stoktan fazla (en fazla ${selectedItem.defectiveQuantity}).`);
        setSubmitting(false);
        return;
      }

      const trimmedDocumentNumber = form.documentNumber.trim();
      if (!trimmedDocumentNumber) {
        setError("Belge numarası zorunludur.");
        setSubmitting(false);
        return;
      }
      if (!form.date) {
        setError("Tarih zorunludur.");
        setSubmitting(false);
        return;
      }

      const payload = {
        fabricId: selectedItem.fabricId,
        quantityKg: form.unitType === "kg" ? quantity : 0,
        quantityM: form.unitType === "m" ? quantity : 0,
        reason: form.reason,
        documentType: form.documentType,
        documentNumber: trimmedDocumentNumber,
        date: form.date,
        supplierCode: form.supplierCode,
        supplierName: form.supplierName,
        entryWarehouseCode: form.entryWarehouseCode,
        exitWarehouseCode: form.exitWarehouseCode,
        total: Number(form.total) || 0,
        createdBy: "operator",
      };

      const response = await api.post("/fabrics/defective-stock", payload);

      if (response.status >= 400) {
        throw new Error(response.data?.message || "İade işlemi başarısız oldu.");
      }

      if (response.data?.decreasedStock) {
        setItems((prev) =>
          prev
            .map((item) =>
              item.id === selectedItem.id
                ? { ...item, defectiveQuantity: Math.max(0, item.defectiveQuantity - quantity) }
                : item
            )
            .filter((item) => item.defectiveQuantity > 0.0001)
        );
      }

      const returnId = response.data?.return?.id;
      if (returnId) {
        setTimeout(() => handlePrintReturn({ ...selectedItem, id: returnId } as DefectiveStockItem), 300);
      }

      setFormOpen(false);
      setSelectedItem(null);
      setForm(DEFAULT_FORM);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "İade işlemi başarısız oldu.");
    } finally {
      setSubmitting(false);
    }
  }, [form, selectedItem]);

  const handlePrintReturn = useCallback(async (item: DefectiveStockItem) => {
    try {
      const response = await api.get(`/fabrics/defective-stock?returnId=${item.id}`);
      const data = response.data;

      if (!data?.return) {
        setError("Yazdırılacak belge bulunamadı.");
        return;
      }

      const doc = data.return;
      const supplierName = data.supplierName || "-";
      const supplierCode = data.supplierCode || "-";
      const documentType = (doc.type || "irsaliye") as "irsaliye" | "fatura";
      const documentNumber = doc.number || "-";
      const documentDate = doc.date ? new Date(doc.date).toLocaleDateString("tr-TR") : new Date().toLocaleDateString("tr-TR");
      const quantity = Number(doc.quantity || doc.quantityKg || item.defectiveQuantity).toFixed(2);
      const unit = doc.unitType || item.unit || "kg";
      const total = Number(doc.total || 0).toFixed(2);
      const fabricName = item.fabricName;
      const color = item.color;
      const reason = doc.reason || "İade";

      const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>${documentType === "fatura" ? "İade Faturası" : "İade İrsaliyesi"} - ${documentNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Times New Roman", Times, serif; font-size: 12pt; color: #000; padding: 40px; }
    .header { text-align: center; margin-bottom: 24px; border-bottom: 3px double #000; padding-bottom: 16px; }
    .company-name { font-size: 18pt; font-weight: bold; margin-bottom: 4px; }
    .company-info { font-size: 10pt; color: #333; line-height: 1.6; }
    .document-title { font-size: 16pt; font-weight: bold; margin-top: 12px; text-transform: uppercase; }
    .meta { display: flex; justify-content: space-between; margin: 20px 0; font-size: 11pt; }
    .meta-box { border: 1px solid #ccc; padding: 10px; width: 48%; }
    .meta-label { font-weight: bold; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { border: 1px solid #000; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #f0f0f0; font-weight: bold; text-align: center; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .totals { display: flex; justify-content: flex-end; margin-top: 16px; }
    .totals-box { width: 300px; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #ddd; }
    .totals-row.grand { font-weight: bold; border-bottom: 2px solid #000; border-top: 2px solid #000; margin-top: 4px; }
    .signatures { display: flex; justify-content: space-between; margin-top: 60px; page-break-inside: avoid; }
    .signature-box { width: 45%; text-align: center; }
    .signature-line { border-top: 1px solid #000; margin-top: 60px; padding-top: 6px; font-size: 10pt; }
    .footer { margin-top: 40px; font-size: 9pt; color: #666; text-align: center; border-top: 1px solid #ddd; padding-top: 8px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-name">MIRA AP GRUP</div>
    <div class="company-info">
      İstanbul / Türkiye<br/>
      Tel: 0212 123 45 67 | E-Posta: info@miraap.com
    </div>
    <div class="document-title">${documentType === "fatura" ? "İade Faturası" : "İade İrsaliyesi"}</div>
  </div>

  <div class="meta">
    <div class="meta-box">
      <div class="meta-label">Belge No: ${documentNumber}</div>
      <div>Tarih: ${documentDate}</div>
    </div>
    <div class="meta-box" style="text-align: right;">
      <div class="meta-label">Tedarikçi</div>
      <div>${supplierName}</div>
      <div>Kod: ${supplierCode}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 5%; text-align: center;">Sıra</th>
        <th style="width: 45%;">Malzeme / Hizmet Açıklama</th>
        <th style="width: 10%; text-align: center;">Birim</th>
        <th style="width: 15%; text-align: right;">Miktar</th>
        <th style="width: 15%; text-align: right;">Birim Fiyat</th>
        <th style="width: 15%; text-align: right;">Toplam Tutar</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="text-center">1</td>
        <td>
          <strong>${fabricName}</strong><br/>
          <span style="font-size: 10pt; color: #444;">Renk: ${color} | ${reason}</span>
        </td>
        <td class="text-center">${unit}</td>
        <td class="text-right">${quantity}</td>
        <td class="text-right">${(Number(total) / Number(quantity)).toFixed(2)}</td>
        <td class="text-right">${total}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="totals-row grand">
        <span>Genel Toplam</span>
        <span>${total} TL</span>
      </div>
    </div>
  </div>

  <div class="signatures">
    <div class="signature-box">
      <div>Teklif Edilen / İade Eden</div>
      <div class="signature-line">
        <div>İsim / Soyisim</div>
        <div>İmza</div>
      </div>
    </div>
    <div class="signature-box">
      <div>Onaylayan</div>
      <div class="signature-line">
        <div>İsim / Soyisim</div>
        <div>İmza</div>
      </div>
    </div>
  </div>

  <div class="footer">
    Bu belge ${documentType === "fatura" ? "iade faturası" : "iade irsaliyesi"} olarak düzenlenmiştir. | ${new Date().toLocaleString("tr-TR")}
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>`;

      const printWindow = window.open("", "_blank", "width=900,height=700");
      if (!printWindow) {
        setError("Yazdırma penceresi açılamadı. Popup engelini kontrol edin.");
        return;
      }
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (err) {
      console.error(err);
      setError("Yazdırma işlemi başarısız oldu.");
    }
  }, []);

  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("tr-TR");
  };

  const menuItems = useMemo(
    () => [
      { label: "İade İrsaliyesi Oluştur", action: () => openReturnForm("irsaliye") },
      { label: "İade Faturası Oluştur", action: () => openReturnForm("fatura") },
      { label: "Yazdır", action: () => selectedItem && handlePrintReturn(selectedItem) },
      { label: "sep-1", divider: true } as const,
      { label: "Kapat", action: closeContextMenu, hint: "Escape" },
    ],
    [openReturnForm, closeContextMenu, handlePrintReturn, selectedItem]
  );

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div>
          <div style={styles.heroTag}>Kalite Kontrol</div>
          <div style={styles.heroTitle}>Hatalı Kumaş Stokları</div>
          <div style={styles.heroSub}>İade irsaliyesi veya iade faturası oluşturmak için satıra sağ tıklayın.</div>
        </div>
        <div style={styles.heroStats}>
          <div style={styles.heroStatCard}>
            <div style={styles.heroStatLabel}>Kalem</div>
            <div style={styles.heroStatValue}>{items.length}</div>
          </div>
          <div style={styles.heroStatCard}>
            <div style={styles.heroStatLabel}>Toplam Hatalı Stok</div>
            <div style={styles.heroStatValue}>
              {items.reduce((sum, item) => sum + item.defectiveQuantity, 0).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {error ? <div style={styles.error}>{error}</div> : null}

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Kumaş</th>
              <th style={styles.th}>Renk</th>
              <th style={{ ...styles.th, textAlign: "right" }}>Hatalı Stok</th>
              <th style={styles.th}>Birim</th>
              <th style={styles.th}>Tedarikçi</th>
              <th style={styles.th}>İşlem Tarihi</th>
              <th style={styles.th}>Yazdır</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={styles.loadingCell}>
                  Yükleniyor...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                 <td colSpan={7} style={styles.emptyCell}>
                   Hatalı stok kaydı bulunamadı.
                 </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={`${item.fabricId}-${item.color}`}
                  style={styles.tr}
                  onContextMenu={(event) => openContextMenu(event, item)}
                >
                  <td style={styles.td}>{item.fabricName}</td>
                  <td style={styles.td}>{item.color}</td>
                  <td style={{ ...styles.td, textAlign: "right", fontWeight: 700, color: "#b91c1c" }}>
                    {item.defectiveQuantity.toFixed(2)}
                  </td>
                  <td style={styles.td}>{item.unit}</td>
                  <td style={styles.td}>{item.supplierName || "-"}</td>
                  <td style={styles.td}>{formatDate(item.createdAt)}</td>
                  <td style={{ ...styles.td, textAlign: "center" }}>
                    <button
                      onClick={() => handlePrintReturn(item)}
                      style={{
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                        borderRadius: "6px",
                        padding: "4px 10px",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer",
                        color: "#374151",
                      }}
                    >
                      Yazdır
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {contextMenu.visible ? (
        <div
          ref={contextMenuRef}
          style={{ ...styles.contextMenu, top: contextMenu.y, left: contextMenu.x }}
          onClick={(event) => event.stopPropagation()}
        >
          {menuItems.map((item, index) =>
            item.divider ? (
              <div key={`${item.label}-${index}`} style={styles.contextMenuDivider} />
            ) : (
              <button
                key={item.label}
                style={styles.contextMenuItem}
                onClick={() => {
                  item.action?.();
                }}
              >
                <span>{item.label}</span>
                {item.hint ? <span style={styles.contextMenuHint}>{item.hint}</span> : null}
              </button>
            )
          )}
        </div>
      ) : null}

      {formOpen ? (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <h2 style={styles.modalTitle}>
              {form.documentType === "irsaliye" ? "İade İrsaliyesi" : "İade Faturası"} Oluştur
            </h2>
            <p style={styles.modalSubtitle}>
              {selectedItem?.fabricName} · {selectedItem?.color} · Kalan hatalı stok: {selectedItem?.defectiveQuantity.toFixed(2)}{" "}
              {selectedItem?.unit}
            </p>

            <div style={styles.formGrid}>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Belge Türü</span>
                <select
                  value={form.documentType}
                  onChange={(e) => setForm((prev) => ({ ...prev, documentType: e.target.value as "irsaliye" | "fatura" }))}
                  style={styles.input}
                >
                  <option value="irsaliye">İrsaliye</option>
                  <option value="fatura">Fatura</option>
                </select>
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Belge No</span>
                <input
                  value={form.documentNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, documentNumber: e.target.value }))}
                  style={styles.input}
                  placeholder="Belge numarası"
                />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Tarih</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                  style={styles.input}
                />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Tedarikçi</span>
                <input
                  value={form.supplierName}
                  onChange={(e) => setForm((prev) => ({ ...prev, supplierName: e.target.value }))}
                  style={styles.input}
                  placeholder="Tedarikçi adı"
                />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Tedarikçi Kodu</span>
                <input
                  value={form.supplierCode}
                  onChange={(e) => setForm((prev) => ({ ...prev, supplierCode: e.target.value }))}
                  style={styles.input}
                  placeholder="Kod"
                />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Giriş Depo</span>
                <input
                  value={form.entryWarehouseCode}
                  onChange={(e) => setForm((prev) => ({ ...prev, entryWarehouseCode: e.target.value }))}
                  style={styles.input}
                  placeholder="Giriş depo"
                />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Çıkış Depo</span>
                <input
                  value={form.exitWarehouseCode}
                  onChange={(e) => setForm((prev) => ({ ...prev, exitWarehouseCode: e.target.value }))}
                  style={styles.input}
                  placeholder="Çıkış depo"
                />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Miktar</span>
                <input
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
                  style={styles.input}
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Birim</span>
                <select
                  value={form.unitType}
                  onChange={(e) => setForm((prev) => ({ ...prev, unitType: e.target.value as "kg" | "m" }))}
                  style={styles.input}
                >
                  <option value="kg">kg</option>
                  <option value="m">m</option>
                </select>
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Tutar</span>
                <input
                  type="number"
                  value={form.total}
                  onChange={(e) => setForm((prev) => ({ ...prev, total: e.target.value }))}
                  style={styles.input}
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Açıklama</span>
                <input
                  value={form.reason}
                  onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                  style={styles.input}
                  placeholder="Açıklama"
                />
              </label>
            </div>

            <div style={styles.modalActions}>
              <button type="button" onClick={() => setFormOpen(false)} style={styles.secondaryButton}>
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleFormSubmit}
                disabled={submitting}
                style={{
                  ...styles.primaryButton,
                  opacity: submitting ? 0.6 : 1,
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    height: "100%",
    minHeight: 0,
    padding: "12px",
    background: "radial-gradient(circle at 0% 0%, rgba(239,68,68,0.12) 0%, rgba(239,68,68,0) 45%), var(--fs-color-bg)",
    color: "var(--fs-color-text)",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
    gap: 10,
  },
  hero: {
    border: "1px solid var(--fs-color-border)",
    borderRadius: 16,
    background: "linear-gradient(180deg, var(--fs-color-surface) 0%, var(--fs-color-surface-soft) 100%)",
    padding: "12px 14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    flexWrap: "wrap",
    boxShadow: "0 12px 28px -24px rgba(15, 23, 42, 0.45)",
  },
  heroTag: {
    display: "inline-block",
    border: "1px solid #fecaca",
    borderRadius: 999,
    background: "#fef2f2",
    color: "#b91c1c",
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 9px",
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: "var(--fs-color-text)",
    marginBottom: 3,
  },
  heroSub: {
    fontSize: 12,
    color: "var(--fs-color-text-muted)",
    maxWidth: 520,
    lineHeight: 1.4,
  },
  heroStats: {
    display: "flex",
    gap: 10,
  },
  heroStatCard: {
    border: "1px solid var(--fs-color-border)",
    borderRadius: 12,
    background: "var(--fs-color-surface)",
    padding: "10px 12px",
    minWidth: 110,
    textAlign: "right",
  },
  heroStatLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--fs-color-text-muted)",
    marginBottom: 4,
  },
  heroStatValue: {
    fontSize: 18,
    fontWeight: 800,
    color: "#b91c1c",
  },
  error: {
    borderRadius: 12,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#b91c1c",
    padding: "10px 12px",
    fontSize: 13,
    fontWeight: 600,
  },
  tableWrapper: {
    flex: 1,
    overflow: "auto",
    border: "1px solid var(--fs-color-border)",
    borderRadius: 12,
    background: "var(--fs-color-surface)",
    minHeight: 0,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 760,
  },
  th: {
    position: "sticky",
    top: 0,
    zIndex: 2,
    background: "var(--fs-color-surface-soft)",
    borderBottom: "1px solid var(--fs-color-border)",
    padding: "10px 12px",
    textAlign: "left",
    fontSize: 12,
    fontWeight: 700,
    color: "var(--fs-color-text-muted)",
    whiteSpace: "nowrap",
  },
  tr: {
    cursor: "context-menu",
  },
  td: {
    padding: "10px 12px",
    borderBottom: "1px solid var(--fs-color-border)",
    fontSize: 13,
    color: "var(--fs-color-text)",
    whiteSpace: "nowrap",
  },
  loadingCell: {
    padding: "24px 12px",
    textAlign: "center",
    color: "var(--fs-color-text-muted)",
    fontSize: 13,
  },
  emptyCell: {
    padding: "24px 12px",
    textAlign: "center",
    color: "var(--fs-color-text-muted)",
    fontSize: 13,
  },
  contextMenu: {
    position: "fixed",
    zIndex: 1000,
    background: "var(--fs-color-surface)",
    border: "1px solid var(--fs-color-border)",
    borderRadius: 10,
    boxShadow: "0 20px 50px -18px rgba(15,23,42,0.45)",
    padding: "6px",
    minWidth: 220,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  contextMenuItem: {
    appearance: "none",
    border: "none",
    background: "transparent",
    color: "var(--fs-color-text)",
    fontSize: 13,
    fontWeight: 600,
    padding: "8px 10px",
    borderRadius: 8,
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    textAlign: "left",
  },
  contextMenuHint: {
    fontSize: 11,
    color: "var(--fs-color-text-muted)",
    fontWeight: 600,
  },
  contextMenuDivider: {
    height: 1,
    background: "var(--fs-color-border)",
    margin: "4px 2px",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1100,
    background: "rgba(15, 23, 42, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 640,
    maxHeight: "calc(100vh - 32px)",
    overflow: "auto",
    background: "var(--fs-color-surface)",
    border: "1px solid var(--fs-color-border)",
    borderRadius: 16,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    boxShadow: "0 30px 60px -30px rgba(15,23,42,0.55)",
  },
  modalTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 800,
    color: "var(--fs-color-text)",
  },
  modalSubtitle: {
    margin: 0,
    fontSize: 12,
    color: "var(--fs-color-text-muted)",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "var(--fs-color-text-muted)",
  },
  input: {
    background: "var(--fs-color-surface-soft)",
    border: "1px solid var(--fs-color-border)",
    borderRadius: 8,
    padding: "8px 10px",
    color: "var(--fs-color-text)",
    fontSize: 13,
    outline: "none",
  },
  primaryButton: {
    border: "none",
    borderRadius: 10,
    background: "#0f766e",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 800,
    padding: "10px 14px",
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid var(--fs-color-border)",
    borderRadius: 10,
    background: "transparent",
    color: "var(--fs-color-text)",
    fontSize: 13,
    fontWeight: 700,
    padding: "10px 14px",
    cursor: "pointer",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 4,
  },
};
