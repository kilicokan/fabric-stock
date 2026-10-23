import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import axios from "axios";
import AuthGuard from "../../components/AuthGuard";

type ReadinessStatus = "READY" | "WAITING_STOCK" | "MISSING_RECIPE" | "ALREADY_ASSIGNED";

interface RequirementRow {
  resourceType: "FABRIC" | "ACCESSORY";
  resourceId: number;
  resourceName: string;
  unit: string;
  requiredQuantity: number;
  availableStockAtEvaluation: number;
  incomingByDelivery: number;
  allocatedFromStock: number;
  allocatedFromIncoming: number;
  shortageQuantity: number;
}

interface SuggestionRow {
  workOrderId: number;
  orderNo: string;
  productCode: string;
  productName: string;
  color: string;
  customerName: string;
  quantity: number;
  status: string;
  deliveryDate: string | null;
  readiness: ReadinessStatus;
  isSuggested: boolean;
  reason: string;
  alreadyAssignedToCutting: boolean;
  requirements: RequirementRow[];
}

interface Summary {
  total: number;
  ready: number;
  waitingStock: number;
  missingRecipe: number;
  alreadyAssigned: number;
}

interface Workshop {
  id: number;
  name: string;
  specialization: string;
}

const emptySummary: Summary = {
  total: 0,
  ready: 0,
  waitingStock: 0,
  missingRecipe: 0,
  alreadyAssigned: 0,
};

const formatDate = (rawDate: string | null): string => {
  if (!rawDate) return "-";
  const d = new Date(rawDate);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("tr-TR");
};

const formatQty = (value: number, unit: string): string => `${Number(value || 0).toFixed(3)} ${unit}`;

export default function CuttingSuggestionsPage() {
  const [rows, setRows] = useState<SuggestionRow[]>([]);
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string>("");
  const [readyOnly, setReadyOnly] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [assigningOrderId, setAssigningOrderId] = useState<number | null>(null);
  const [error, setError] = useState<string>("");
  const [info, setInfo] = useState<string>("");

  const loadSuggestions = useCallback(async () => {
    const response = await axios.get("/api/fason/cutting-suggestions");
    const apiRows = Array.isArray(response.data?.rows) ? response.data.rows : [];
    const apiSummary = response.data?.summary || emptySummary;
    setRows(apiRows);
    setSummary({
      total: Number(apiSummary.total || 0),
      ready: Number(apiSummary.ready || 0),
      waitingStock: Number(apiSummary.waitingStock || 0),
      missingRecipe: Number(apiSummary.missingRecipe || 0),
      alreadyAssigned: Number(apiSummary.alreadyAssigned || 0),
    });
  }, []);

  const loadWorkshops = useCallback(async () => {
    const response = await axios.get("/api/fason/workshops", {
      params: {
        specialization: "KESIM",
        isActive: true,
      },
    });

    const rawData = response.data?.data ?? response.data;
    const workshopList = Array.isArray(rawData) ? rawData : [];
    const normalizedWorkshops = workshopList
      .map((item: unknown) => {
        if (typeof item !== "object" || item === null) return null;
        const rawWorkshop = item as {
          id?: unknown;
          name?: unknown;
          specialization?: unknown;
        };
        const id = Number(rawWorkshop.id);
        if (!Number.isInteger(id) || id <= 0) return null;
        return {
          id,
          name: String(rawWorkshop.name || ""),
          specialization: String(rawWorkshop.specialization || ""),
        } as Workshop;
      })
      .filter((item): item is Workshop => item !== null);

    setWorkshops(normalizedWorkshops);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadSuggestions(), loadWorkshops()]);
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err !== null && "response" in err
          ? ((err as { response?: { data?: { message?: string; error?: string } } }).response?.data?.message ||
            (err as { response?: { data?: { message?: string; error?: string } } }).response?.data?.error)
          : "";
      setError(message || "Kesim onerileri yuklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [loadSuggestions, loadWorkshops]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const filteredRows = useMemo(() => {
    if (!readyOnly) return rows;
    return rows.filter((row) => row.readiness === "READY");
  }, [rows, readyOnly]);

  const assignToCutting = async (row: SuggestionRow) => {
    // İzin verilen durumlar: READY veya WAITING_STOCK
    if (row.readiness !== "READY" && row.readiness !== "WAITING_STOCK") return;

    // Stok bekliyorsa kullanıcıya uyarı göster
    if (row.readiness === "WAITING_STOCK") {
      const confirmed = window.confirm(
        "Bu iş emrinde bazı malzemelerin stoğu yetersiz. Yine de kesime vermek istediğinize emin misiniz?"
      );
      if (!confirmed) return;
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      setError("Yetki icin tekrar giris yapiniz.");
      return;
    }

    setAssigningOrderId(row.workOrderId);
    setError("");

    try {
      await axios.post(
        "/api/fason/cutting-suggestions/assign",
        {
          workOrderId: row.workOrderId,
          workshopId: selectedWorkshopId ? Number(selectedWorkshopId) : undefined,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setInfo(`${row.orderNo} kesim atolyesine atandi.`);
      await loadSuggestions();
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err !== null && "response" in err
          ? ((err as { response?: { data?: { message?: string; error?: string } } }).response?.data?.message ||
            (err as { response?: { data?: { message?: string; error?: string } } }).response?.data?.error)
          : "";
      setError(message || "Kesime atama yapilamadi.");
    } finally {
      setAssigningOrderId(null);
    }
  };

  const readinessLabel = (status: ReadinessStatus): string => {
    switch (status) {
      case "READY":
        return "Hazir";
      case "WAITING_STOCK":
        return "Stok Bekliyor";
      case "MISSING_RECIPE":
        return "Recete Eksik";
      case "ALREADY_ASSIGNED":
        return "Kesime Atanmis";
      default:
        return status;
    }
  };

  const readinessStyle = (status: ReadinessStatus): CSSProperties => {
    if (status === "READY") return { background: "#dcfce7", color: "#166534" };
    if (status === "WAITING_STOCK") return { background: "#fee2e2", color: "#b91c1c" };
    if (status === "ALREADY_ASSIGNED") return { background: "#dbeafe", color: "#1d4ed8" };
    return { background: "#fef3c7", color: "#92400e" };
  };

  return (
    <AuthGuard requireAuth={true} requiredAccess="fason">
      <div style={styles.page}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Kesim Önerileri</h1>
            <p style={styles.subtitle}>
              Sipariş receteleri, mevcut stok ve teslim terminine gore kesime verilebilecek is emirleri.
            </p>
          </div>
          <button style={styles.refreshButton} onClick={() => void loadAll()}>
            Yenile
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}
        {info && <div style={styles.info}>{info}</div>}

        <div style={styles.summaryGrid}>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Toplam</span>
            <strong style={styles.summaryValue}>{summary.total}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Hazir</span>
            <strong style={styles.summaryValue}>{summary.ready}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Stok Bekleyen</span>
            <strong style={styles.summaryValue}>{summary.waitingStock}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Recete Eksik</span>
            <strong style={styles.summaryValue}>{summary.missingRecipe}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Zaten Atanmis</span>
            <strong style={styles.summaryValue}>{summary.alreadyAssigned}</strong>
          </div>
        </div>

        <div style={styles.filters}>
          <label style={styles.checkboxWrap}>
            <input
              type="checkbox"
              checked={readyOnly}
              onChange={(event) => setReadyOnly(event.target.checked)}
            />
            Sadece hazir olanlari goster
          </label>

          <div style={styles.workshopSelectWrap}>
            <label style={styles.label}>Kesim Atolyesi</label>
            <select
              style={styles.select}
              value={selectedWorkshopId}
              onChange={(event) => setSelectedWorkshopId(event.target.value)}
            >
              <option value="">Otomatik sec</option>
              {workshops.map((workshop) => (
                <option key={workshop.id} value={workshop.id}>
                  {workshop.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div style={styles.emptyState}>Yukleniyor...</div>
        ) : filteredRows.length === 0 ? (
          <div style={styles.emptyState}>
            {readyOnly && rows.length > 0
              ? "Hazir kesim onerisi yok. Filtreyi kapatip recete eksik veya stok bekleyen is emirlerini gorebilirsiniz."
              : "Gosterilecek kesim onerisi bulunamadi."}
          </div>
        ) : (
          <div style={styles.list}>
            {filteredRows.map((row) => {
              // READY veya WAITING_STOCK olanlar atanabilir
              const canAssign = row.readiness === "READY" || row.readiness === "WAITING_STOCK";
              const isAssigning = assigningOrderId === row.workOrderId;

              return (
                <div key={row.workOrderId} style={styles.card}>
                  <div style={styles.cardHead}>
                    <div>
                      <div style={styles.orderNo}>{row.orderNo}</div>
                      <div style={styles.meta}>
                        {row.productCode} | {row.productName} | Renk: {row.color || "-"} | {row.quantity} adet | Teslim:{" "}
                        {formatDate(row.deliveryDate)}
                      </div>
                      <div style={styles.meta}>Musteri: {row.customerName || "-"}</div>
                    </div>

                    <div style={styles.cardActions}>
                      <span style={{ ...styles.badge, ...readinessStyle(row.readiness) }}>
                        {readinessLabel(row.readiness)}
                      </span>
                      <button
                        style={{
                          ...styles.assignButton,
                          ...(canAssign && !isAssigning ? {} : styles.assignButtonDisabled),
                        }}
                        onClick={() => void assignToCutting(row)}
                        disabled={!canAssign || isAssigning}
                      >
                        {isAssigning ? "Ataniyor..." : "Kesime Ver"}
                      </button>
                    </div>
                  </div>

                  <div style={styles.reason}>{row.reason}</div>

                  {row.requirements.length > 0 ? (
                    <div style={styles.tableWrap}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Malzeme</th>
                            <th style={styles.th}>Gereken</th>
                            <th style={styles.th}>Anlik Stok</th>
                            <th style={styles.th}>Termine Kadar Gelen</th>
                            <th style={styles.th}>Acik</th>
                          </tr>
                        </thead>
                        <tbody>
                          {row.requirements.map((requirement) => (
                            <tr key={`${row.workOrderId}-${requirement.resourceType}-${requirement.resourceId}`}>
                              <td style={styles.td}>
                                {requirement.resourceType === "FABRIC" ? "Kumas" : "Aksesuar"} -{" "}
                                {requirement.resourceName}
                              </td>
                              <td style={styles.td}>{formatQty(requirement.requiredQuantity, requirement.unit)}</td>
                              <td style={styles.td}>
                                {formatQty(requirement.availableStockAtEvaluation, requirement.unit)}
                              </td>
                              <td style={styles.td}>
                                {formatQty(requirement.incomingByDelivery, requirement.unit)}
                              </td>
                              <td
                                style={{
                                  ...styles.td,
                                  color: requirement.shortageQuantity > 0 ? "#b91c1c" : "#166534",
                                  fontWeight: 700,
                                }}
                              >
                                {formatQty(requirement.shortageQuantity, requirement.unit)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={styles.noRequirements}>Bu is emri icin hesaplanmis malzeme satiri yok.</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "16px",
    background: "var(--fs-color-bg)",
    color: "var(--fs-color-text)",
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "14px",
    maxWidth: 1800,
    marginInline: "auto",
  },
  title: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 800,
  },
  subtitle: {
    margin: "6px 0 0",
    color: "var(--fs-color-text-muted)",
    fontSize: "13px",
  },
  refreshButton: {
    border: "1px solid #93c5fd",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: 10,
    padding: "8px 14px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    minWidth: "88px",
  },
  error: {
    maxWidth: 1800,
    margin: "0 auto 12px",
    border: "1px solid #fecaca",
    borderRadius: 12,
    background: "#fef2f2",
    color: "#b91c1c",
    padding: "10px 12px",
    fontSize: "12px",
  },
  info: {
    maxWidth: 1800 ,
    margin: "0 auto 12px",
    border: "1px solid #bfdbfe",
    borderRadius: 12,
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "10px 12px",
    fontSize: "12px",
  },
  summaryGrid: {
    maxWidth: 1800,
    margin: "0 auto 12px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "10px",
  },
  summaryCard: {
    border: "1px solid var(--fs-color-border)",
    borderRadius: 12,
    background: "var(--fs-color-surface)",
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  summaryLabel: {
    fontSize: "12px",
    color: "var(--fs-color-text-muted)",
  },
  summaryValue: {
    fontSize: "20px",
    color: "var(--fs-color-text)",
  },
  filters: {
    maxWidth: 1800,
    margin: "0 auto 14px",
    border: "1px solid var(--fs-color-border)",
    borderRadius: 12,
    background: "var(--fs-color-surface)",
    padding: "10px 12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  checkboxWrap: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
    color: "var(--fs-color-text)",
  },
  workshopSelectWrap: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  label: {
    fontSize: "14px",
    color: "var(--fs-color-text-muted)",
  },
  select: {
    border: "1px solid var(--fs-color-border-strong)",
    borderRadius: 8,
    minHeight: "32px",
    background: "var(--fs-color-surface-soft)",
    color: "var(--fs-color-text)",
    padding: "4px 8px",
    minWidth: "180px",
    fontSize: "14px",
  },
  emptyState: {
    maxWidth: 1800,
    margin: "0 auto",
    border: "1px dashed var(--fs-color-border-strong)",
    borderRadius: 12,
    background: "var(--fs-color-surface-soft)",
    padding: "24px",
    textAlign: "center",
    color: "var(--fs-color-text-muted)",
    fontSize: "13px",
  },
  list: {
    maxWidth: 1800,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  card: {
    border: "1px solid var(--fs-color-border)",
    borderRadius: 12,
    background: "var(--fs-color-surface)",
    overflow: "hidden",
  },
  cardHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "10px",
    padding: "12px",
    borderBottom: "1px solid var(--fs-color-border)",
    background: "var(--fs-color-surface-soft)",
    flexWrap: "wrap",
  },
  orderNo: {
    fontSize: "15px",
    fontWeight: 800,
    color: "var(--fs-color-primary-strong)",
  },
  meta: {
    marginTop: "4px",
    fontSize: "14px",
    color: "var(--fs-color-text-muted)",
  },
  cardActions: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: "11px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  assignButton: {
    border: "1px solid #10b981",
    borderRadius: 10,
    background: "#ecfdf3",
    color: "#047857",
    padding: "6px 10px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  assignButtonDisabled: {
    borderColor: "#d1d5db",
    background: "#f3f4f6",
    color: "#9ca3af",
    cursor: "not-allowed",
  },
  reason: {
    padding: "10px 12px",
    fontSize: "12px",
    color: "var(--fs-color-text-muted)",
  },
  tableWrap: {
    overflowX: "auto",
    borderTop: "1px solid var(--fs-color-border)",
  },
  table: {
    width: "100%",
    minWidth: "760px",
    borderCollapse: "collapse",
  },
  th: {
    border: "1px solid var(--fs-color-border)",
    background: "var(--fs-color-surface-soft)",
    color: "var(--fs-color-text)",
    fontSize: "12px",
    fontWeight: 700,
    textAlign: "left",
    padding: "8px",
  },
  td: {
    border: "1px solid var(--fs-color-border)",
    padding: "7px 8px",
    fontSize: "12px",
    color: "var(--fs-color-text)",
    whiteSpace: "nowrap",
  },
  noRequirements: {
    borderTop: "1px solid var(--fs-color-border)",
    padding: "12px",
    fontSize: "12px",
    color: "var(--fs-color-text-muted)",
  },
};