import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import axios from "axios";
import ExportButtons from "../../components/ExportButtons";
import api from "../../lib/api";

type PartyType = "CUSTOMER" | "SUPPLIER";
type Direction = "DEBIT" | "CREDIT";
type Source = "MANUAL" | "PAYMENT" | "DOCUMENT" | "ADJUSTMENT";

type LookupItem = {
  id: number;
  name: string;
};

type FinancialTransaction = {
  id: number;
  partyType: PartyType;
  customerId: number | null;
  customerName: string | null;
  supplierId: number | null;
  supplierName: string | null;
  direction: Direction;
  source: Source;
  documentType: string | null;
  referenceNo: string | null;
  referenceId: string | null;
  transactionDate: string;
  dueDate: string | null;
  amount: number;
  currency: string;
  description: string | null;
  createdBy: number | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

type FinancialApiResponse = {
  rows: FinancialTransaction[];
  summary: {
    totalDebit: number;
    totalCredit: number;
    balance: number;
  };
};

type Filters = {
  partyType: "" | PartyType;
  direction: "" | Direction;
  source: "" | Source;
  customerId: string;
  supplierId: string;
  fromDate: string;
  toDate: string;
  search: string;
};

type FormState = {
  id: number | null;
  partyType: PartyType;
  customerId: string;
  supplierId: string;
  direction: Direction;
  source: Source;
  transactionDate: string;
  dueDate: string;
  amount: string;
  currency: string;
  documentType: string;
  referenceNo: string;
  referenceId: string;
  description: string;
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const firstDayOfMonthISO = () => {
  const current = new Date();
  return new Date(current.getFullYear(), current.getMonth(), 1).toISOString().slice(0, 10);
};

const createInitialFilters = (): Filters => ({
  partyType: "",
  direction: "",
  source: "",
  customerId: "",
  supplierId: "",
  fromDate: firstDayOfMonthISO(),
  toDate: todayISO(),
  search: "",
});

const createInitialForm = (): FormState => ({
  id: null,
  partyType: "CUSTOMER",
  customerId: "",
  supplierId: "",
  direction: "CREDIT",
  source: "PAYMENT",
  transactionDate: todayISO(),
  dueDate: "",
  amount: "",
  currency: "TRY",
  documentType: "",
  referenceNo: "",
  referenceId: "",
  description: "",
});

const parseApiError = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; error?: string } | undefined;
    return data?.message || data?.error || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
};

const formatMoney = (value: number): string =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(value || 0);

const formatDate = (value: string | null): string => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("tr-TR");
};

const directionLabel = (partyType: PartyType, direction: Direction): string => {
  if (direction === "DEBIT") {
    return partyType === "CUSTOMER" ? "Müşteri Borçlandırma" : "Tedarikçi Borçlandırma";
  }
  return partyType === "CUSTOMER" ? "Tahsilat" : "Ödeme";
};

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<"ledger" | "entry">("ledger");
  const [customers, setCustomers] = useState<LookupItem[]>([]);
  const [suppliers, setSuppliers] = useState<LookupItem[]>([]);
  const [filters, setFilters] = useState<Filters>(createInitialFilters);
  const [form, setForm] = useState<FormState>(createInitialForm);
  const [rows, setRows] = useState<FinancialTransaction[]>([]);
  const [summary, setSummary] = useState({ totalDebit: 0, totalCredit: 0, balance: 0 });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadLookups = useCallback(async () => {
    try {
      const [customerRes, supplierRes] = await Promise.all([
        api.get<LookupItem[]>("/customers"),
        api.get<LookupItem[]>("/suppliers"),
      ]);

      setCustomers(Array.isArray(customerRes.data) ? customerRes.data : []);
      setSuppliers(Array.isArray(supplierRes.data) ? supplierRes.data : []);
    } catch (loadError: unknown) {
      setError(parseApiError(loadError, "Cari kartlar yüklenemedi."));
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = {
        partyType: filters.partyType || undefined,
        direction: filters.direction || undefined,
        source: filters.source || undefined,
        customerId: filters.customerId || undefined,
        supplierId: filters.supplierId || undefined,
        fromDate: filters.fromDate ? `${filters.fromDate}T00:00:00.000` : undefined,
        toDate: filters.toDate ? `${filters.toDate}T23:59:59.999` : undefined,
        search: filters.search || undefined,
      };

      const response = await api.get<FinancialApiResponse>("/financial-transactions", { params });
      setRows(Array.isArray(response.data?.rows) ? response.data.rows : []);
      setSummary(response.data?.summary || { totalDebit: 0, totalCredit: 0, balance: 0 });
    } catch (loadError: unknown) {
      setError(parseApiError(loadError, "Finans hareketleri yüklenemedi."));
      setRows([]);
      setSummary({ totalDebit: 0, totalCredit: 0, balance: 0 });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const resetForm = () => {
    setForm(createInitialForm());
  };

  const setQuickMode = (mode: "collection" | "payment" | "customerDebit" | "supplierDebit") => {
    if (mode === "collection") {
      setForm((prev) => ({
        ...prev,
        partyType: "CUSTOMER",
        direction: "CREDIT",
        source: "PAYMENT",
        supplierId: "",
        description: prev.description || "Müşteri tahsilatı",
      }));
      return;
    }

    if (mode === "payment") {
      setForm((prev) => ({
        ...prev,
        partyType: "SUPPLIER",
        direction: "CREDIT",
        source: "PAYMENT",
        customerId: "",
        description: prev.description || "Tedarikçi ödemesi",
      }));
      return;
    }

    if (mode === "customerDebit") {
      setForm((prev) => ({
        ...prev,
        partyType: "CUSTOMER",
        direction: "DEBIT",
        source: "MANUAL",
        supplierId: "",
        description: prev.description || "Müşteri borçlandırma",
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      partyType: "SUPPLIER",
      direction: "DEBIT",
      source: "MANUAL",
      customerId: "",
      description: prev.description || "Tedarikçi borçlandırma",
    }));
  };

  const handleEdit = (row: FinancialTransaction) => {
    setActiveTab("entry");
    setError("");
    setSuccess("");
    setForm({
      id: row.id,
      partyType: row.partyType,
      customerId: row.customerId ? String(row.customerId) : "",
      supplierId: row.supplierId ? String(row.supplierId) : "",
      direction: row.direction,
      source: row.source,
      transactionDate: row.transactionDate?.slice(0, 10) || todayISO(),
      dueDate: row.dueDate?.slice(0, 10) || "",
      amount: String(row.amount || ""),
      currency: row.currency || "TRY",
      documentType: row.documentType || "",
      referenceNo: row.referenceNo || "",
      referenceId: row.referenceId || "",
      description: row.description || "",
    });
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Seçili finans hareketi silinsin mi?")) return;

    setError("");
    setSuccess("");

    try {
      await api.delete("/financial-transactions", { data: { id } });
      setSuccess("Hareket silindi.");
      await loadTransactions();
    } catch (requestError: unknown) {
      setError(parseApiError(requestError, "Hareket silinemedi."));
    }
  };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      id: form.id || undefined,
      partyType: form.partyType,
      customerId: form.partyType === "CUSTOMER" ? form.customerId || undefined : undefined,
      supplierId: form.partyType === "SUPPLIER" ? form.supplierId || undefined : undefined,
      direction: form.direction,
      source: form.source,
      transactionDate: form.transactionDate,
      dueDate: form.dueDate || null,
      amount: Number(form.amount || 0),
      currency: form.currency || "TRY",
      documentType: form.documentType || null,
      referenceNo: form.referenceNo || null,
      referenceId: form.referenceId || null,
      description: form.description || null,
    };

    try {
      if (form.id) {
        await api.put("/financial-transactions", payload);
        setSuccess("Hareket güncellendi.");
      } else {
        await api.post("/financial-transactions", payload);
        setSuccess("Hareket kaydedildi.");
      }

      resetForm();
      setActiveTab("ledger");
      await loadTransactions();
    } catch (requestError: unknown) {
      setError(parseApiError(requestError, "Hareket kaydedilemedi."));
    } finally {
      setSaving(false);
    }
  };

  const exportRows = useMemo(
    () =>
      rows.map((row) => ({
        "Tarih": formatDate(row.transactionDate),
        "Cari Türü": row.partyType === "CUSTOMER" ? "Müşteri" : "Tedarikçi",
        "Cari": row.partyType === "CUSTOMER" ? row.customerName || "-" : row.supplierName || "-",
        "İşlem": directionLabel(row.partyType, row.direction),
        "Kaynak": row.source,
        "Tutar": Number(row.amount || 0).toFixed(2),
        "Para Birimi": row.currency || "TRY",
        "Belge Tipi": row.documentType || "",
        "Referans No": row.referenceNo || "",
        "Vade": formatDate(row.dueDate),
        "Açıklama": row.description || "",
      })),
    [rows]
  );

  return (
    <div className="fs-entity-shell">
      <h1 className="fs-entity-title">Finans Yönetimi</h1>
      <p className="fs-entity-meta" style={{ marginBottom: "10px" }}>
        Cari ekstre ve tahsilat/ödeme işlemlerini aynı ekrandan yönetin.
      </p>

      {error ? <div className="fs-message fs-message-error">{error}</div> : null}
      {success ? <div className="fs-message fs-message-success">{success}</div> : null}

      <div className="fs-view-toggle">
        <button
          type="button"
          className={`fs-btn ${activeTab === "ledger" ? "fs-btn-primary" : "fs-btn-secondary"}`}
          onClick={() => setActiveTab("ledger")}
        >
          Cari Ekstre
        </button>
        <button
          type="button"
          className={`fs-btn ${activeTab === "entry" ? "fs-btn-primary" : "fs-btn-secondary"}`}
          onClick={() => setActiveTab("entry")}
        >
          Tahsilat / Ödeme
        </button>
      </div>

      {activeTab === "entry" ? (
        <>
          <div className="fs-toolbar">
            <button type="button" className="fs-btn fs-btn-secondary" onClick={() => setQuickMode("collection")}>
              Tahsilat
            </button>
            <button type="button" className="fs-btn fs-btn-secondary" onClick={() => setQuickMode("payment")}>
              Ödeme
            </button>
            <button type="button" className="fs-btn fs-btn-warning" onClick={() => setQuickMode("customerDebit")}>
              Müşteri Borçlandır
            </button>
            <button type="button" className="fs-btn fs-btn-warning" onClick={() => setQuickMode("supplierDebit")}>
              Tedarikçi Borçlandır
            </button>
          </div>

          <form onSubmit={submitForm} className="fs-entity-form">
            <div style={gridStyle}>
              <div className="fs-field-group">
                <label className="fs-field-label">Cari Türü *</label>
                <select
                  className="fs-field-input"
                  value={form.partyType}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      partyType: event.target.value as PartyType,
                      customerId: event.target.value === "CUSTOMER" ? prev.customerId : "",
                      supplierId: event.target.value === "SUPPLIER" ? prev.supplierId : "",
                    }))
                  }
                  required
                >
                  <option value="CUSTOMER">Müşteri</option>
                  <option value="SUPPLIER">Tedarikçi</option>
                </select>
              </div>

              {form.partyType === "CUSTOMER" ? (
                <div className="fs-field-group">
                  <label className="fs-field-label">Müşteri *</label>
                  <select
                    className="fs-field-input"
                    value={form.customerId}
                    onChange={(event) => setForm((prev) => ({ ...prev, customerId: event.target.value }))}
                    required
                  >
                    <option value="">Müşteri seçin</option>
                    {customers.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="fs-field-group">
                  <label className="fs-field-label">Tedarikçi *</label>
                  <select
                    className="fs-field-input"
                    value={form.supplierId}
                    onChange={(event) => setForm((prev) => ({ ...prev, supplierId: event.target.value }))}
                    required
                  >
                    <option value="">Tedarikçi seçin</option>
                    {suppliers.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="fs-field-group">
                <label className="fs-field-label">İşlem Yönü *</label>
                <select
                  className="fs-field-input"
                  value={form.direction}
                  onChange={(event) => setForm((prev) => ({ ...prev, direction: event.target.value as Direction }))}
                  required
                >
                  <option value="DEBIT">Borç Artır (DEBIT)</option>
                  <option value="CREDIT">Tahsilat/Ödeme (CREDIT)</option>
                </select>
              </div>

              <div className="fs-field-group">
                <label className="fs-field-label">Kaynak</label>
                <select
                  className="fs-field-input"
                  value={form.source}
                  onChange={(event) => setForm((prev) => ({ ...prev, source: event.target.value as Source }))}
                >
                  <option value="PAYMENT">Ödeme/Tahsilat</option>
                  <option value="MANUAL">Manuel</option>
                  <option value="DOCUMENT">Belge</option>
                  <option value="ADJUSTMENT">Düzeltme</option>
                </select>
              </div>

              <div className="fs-field-group">
                <label className="fs-field-label">Tarih *</label>
                <input
                  className="fs-field-input"
                  type="date"
                  value={form.transactionDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, transactionDate: event.target.value }))}
                  required
                />
              </div>

              <div className="fs-field-group">
                <label className="fs-field-label">Vade</label>
                <input
                  className="fs-field-input"
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                />
              </div>

              <div className="fs-field-group">
                <label className="fs-field-label">Tutar *</label>
                <input
                  className="fs-field-input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="fs-field-group">
                <label className="fs-field-label">Para Birimi</label>
                <input
                  className="fs-field-input"
                  value={form.currency}
                  onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))}
                  placeholder="TRY"
                />
              </div>

              <div className="fs-field-group">
                <label className="fs-field-label">Belge Tipi</label>
                <input
                  className="fs-field-input"
                  value={form.documentType}
                  onChange={(event) => setForm((prev) => ({ ...prev, documentType: event.target.value }))}
                  placeholder="Örn: ALIŞ FATURASI"
                />
              </div>

              <div className="fs-field-group">
                <label className="fs-field-label">Referans No</label>
                <input
                  className="fs-field-input"
                  value={form.referenceNo}
                  onChange={(event) => setForm((prev) => ({ ...prev, referenceNo: event.target.value }))}
                  placeholder="Belge/Senet numarası"
                />
              </div>
            </div>

            <div className="fs-field-group">
              <label className="fs-field-label">Açıklama</label>
              <textarea
                className="fs-field-input"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="İşlem notu"
                style={{ minHeight: "80px", resize: "vertical" }}
              />
            </div>

            <div className="fs-form-actions">
              {form.id ? (
                <button type="button" className="fs-btn fs-btn-secondary" onClick={resetForm}>
                  İptal
                </button>
              ) : null}
              <button type="submit" className="fs-btn fs-btn-primary" disabled={saving}>
                {saving ? "Kaydediliyor..." : form.id ? "Güncelle" : "Kaydet"}
              </button>
            </div>
          </form>
        </>
      ) : (
        <>
          <div style={summaryGridStyle}>
            <div style={summaryCardStyle}>
              <div style={summaryLabelStyle}>Toplam Borç Artışı</div>
              <div style={summaryValueStyle}>{formatMoney(summary.totalDebit)}</div>
            </div>
            <div style={summaryCardStyle}>
              <div style={summaryLabelStyle}>Toplam Tahsilat/Ödeme</div>
              <div style={summaryValueStyle}>{formatMoney(summary.totalCredit)}</div>
            </div>
            <div style={summaryCardStyle}>
              <div style={summaryLabelStyle}>Net Bakiye</div>
              <div
                style={{
                  ...summaryValueStyle,
                  color: summary.balance > 0 ? "#b91c1c" : summary.balance < 0 ? "#047857" : "#111827",
                }}
              >
                {formatMoney(summary.balance)}
              </div>
            </div>
          </div>

          <div className="fs-entity-form" style={{ marginTop: "10px" }}>
            <div style={gridStyle}>
              <div className="fs-field-group">
                <label className="fs-field-label">Cari Türü</label>
                <select
                  className="fs-field-input"
                  value={filters.partyType}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      partyType: event.target.value as Filters["partyType"],
                      customerId: event.target.value === "CUSTOMER" ? prev.customerId : "",
                      supplierId: event.target.value === "SUPPLIER" ? prev.supplierId : "",
                    }))
                  }
                >
                  <option value="">Tümü</option>
                  <option value="CUSTOMER">Müşteri</option>
                  <option value="SUPPLIER">Tedarikçi</option>
                </select>
              </div>

              <div className="fs-field-group">
                <label className="fs-field-label">İşlem Yönü</label>
                <select
                  className="fs-field-input"
                  value={filters.direction}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, direction: event.target.value as Filters["direction"] }))
                  }
                >
                  <option value="">Tümü</option>
                  <option value="DEBIT">Borç Artır (DEBIT)</option>
                  <option value="CREDIT">Tahsilat/Ödeme (CREDIT)</option>
                </select>
              </div>

              <div className="fs-field-group">
                <label className="fs-field-label">Kaynak</label>
                <select
                  className="fs-field-input"
                  value={filters.source}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, source: event.target.value as Filters["source"] }))
                  }
                >
                  <option value="">Tümü</option>
                  <option value="PAYMENT">Ödeme/Tahsilat</option>
                  <option value="MANUAL">Manuel</option>
                  <option value="DOCUMENT">Belge</option>
                  <option value="ADJUSTMENT">Düzeltme</option>
                </select>
              </div>

              {filters.partyType === "CUSTOMER" ? (
                <div className="fs-field-group">
                  <label className="fs-field-label">Müşteri</label>
                  <select
                    className="fs-field-input"
                    value={filters.customerId}
                    onChange={(event) => setFilters((prev) => ({ ...prev, customerId: event.target.value }))}
                  >
                    <option value="">Tümü</option>
                    {customers.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="fs-field-group">
                  <label className="fs-field-label">Tedarikçi</label>
                  <select
                    className="fs-field-input"
                    value={filters.supplierId}
                    onChange={(event) => setFilters((prev) => ({ ...prev, supplierId: event.target.value }))}
                  >
                    <option value="">Tümü</option>
                    {suppliers.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="fs-field-group">
                <label className="fs-field-label">Başlangıç</label>
                <input
                  className="fs-field-input"
                  type="date"
                  value={filters.fromDate}
                  onChange={(event) => setFilters((prev) => ({ ...prev, fromDate: event.target.value }))}
                />
              </div>

              <div className="fs-field-group">
                <label className="fs-field-label">Bitiş</label>
                <input
                  className="fs-field-input"
                  type="date"
                  value={filters.toDate}
                  onChange={(event) => setFilters((prev) => ({ ...prev, toDate: event.target.value }))}
                />
              </div>

              <div className="fs-field-group">
                <label className="fs-field-label">Arama</label>
                <input
                  className="fs-field-input"
                  value={filters.search}
                  onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                  placeholder="Referans no, açıklama, cari adı..."
                />
              </div>
            </div>

            <div className="fs-toolbar" style={{ marginTop: "6px" }}>
              <button type="button" className="fs-btn fs-btn-secondary" onClick={() => setFilters(createInitialFilters())}>
                Filtreleri Sıfırla
              </button>
              <div className="fs-export-wrap">
                <ExportButtons data={exportRows} filename={`cari-ekstre-${todayISO()}`} disabled={rows.length === 0} />
              </div>
            </div>
          </div>

          <div className="fs-entity-subtitle" style={{ marginTop: "16px", marginBottom: "8px" }}>
            Hareket Listesi
          </div>

          {loading ? (
            <div className="fs-loading-text">Finans hareketleri yükleniyor...</div>
          ) : rows.length === 0 ? (
            <div className="fs-loading-text">Filtreye uygun finans hareketi bulunamadı.</div>
          ) : (
            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Tarih</th>
                    <th style={thStyle}>Cari</th>
                    <th style={thStyle}>İşlem</th>
                    <th style={thStyle}>Kaynak</th>
                    <th style={thStyle}>Tutar</th>
                    <th style={thStyle}>Referans</th>
                    <th style={thStyle}>Açıklama</th>
                    <th style={thStyle}>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td style={tdStyle}>{formatDate(row.transactionDate)}</td>
                      <td style={tdStyle}>
                        <strong>{row.partyType === "CUSTOMER" ? "Müşteri" : "Tedarikçi"}</strong>
                        <div style={{ color: "#6b7280", marginTop: "2px" }}>
                          {row.partyType === "CUSTOMER" ? row.customerName || "-" : row.supplierName || "-"}
                        </div>
                      </td>
                      <td style={tdStyle}>{directionLabel(row.partyType, row.direction)}</td>
                      <td style={tdStyle}>{row.source}</td>
                      <td style={tdStyle}>
                        <span style={{ fontWeight: 700 }}>{formatMoney(row.amount)}</span>
                      </td>
                      <td style={tdStyle}>{row.referenceNo || "-"}</td>
                      <td style={tdStyle}>{row.description || "-"}</td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <button type="button" className="fs-btn fs-btn-secondary" onClick={() => handleEdit(row)}>
                            Düzenle
                          </button>
                          <button type="button" className="fs-btn fs-btn-danger" onClick={() => void handleDelete(row.id)}>
                            Sil
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "10px",
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "10px",
  marginTop: "8px",
};

const summaryCardStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "12px",
  background: "#ffffff",
};

const summaryLabelStyle: CSSProperties = {
  color: "#6b7280",
  fontSize: "0.86rem",
  marginBottom: "6px",
};

const summaryValueStyle: CSSProperties = {
  fontSize: "1.12rem",
  fontWeight: 700,
  color: "#111827",
};

const tableWrapStyle: CSSProperties = {
  overflowX: "auto",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  background: "#ffffff",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "1100px",
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "10px",
  borderBottom: "1px solid #e5e7eb",
  fontSize: "0.85rem",
  color: "#475569",
  background: "#f8fafc",
};

const tdStyle: CSSProperties = {
  textAlign: "left",
  padding: "10px",
  borderBottom: "1px solid #f1f5f9",
  fontSize: "0.9rem",
  color: "#111827",
  verticalAlign: "top",
};
