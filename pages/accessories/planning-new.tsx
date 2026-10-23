import { useEffect, useMemo, useState, type CSSProperties } from "react";
import axios from "axios";
import ExportButtons from "../../components/ExportButtons";
import { useTabs } from "../../components/TabContext";
import FabricOrdersPage from "./orders";

type PlanningRow = {
  id: string;
  orderNo: string;
  modelAdi: string;
  miktar: number;
  musteri: string;
  malzemeAdi: string;
  gereken: number;
  saSiparisi: number;
  varyantAciklama: string;
  gelen: number;
  uretimeCikan: number;
  unit: string;
  fisBaglantilari: string[];
};

type SortKey =
  | "orderNo"
  | "modelAdi"
  | "miktar"
  | "musteri"
  | "malzemeAdi"
  | "gereken"
  | "saSiparisi"
  | "varyantAciklama"
  | "gelen"
  | "uretimeCikan";

type SortState = {
  key: SortKey | "";
  direction: "asc" | "desc";
};

type BackendErrorData = {
  error?: string;
  message?: string;
};

const resolveFisBaglantilari = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => String(entry).trim())
    .filter((entry) => entry.length > 0);
};

const numberFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

const formatNumber = (value: number): string => numberFormatter.format(value);

const formatQuantity = (value: number, unit: string): string => `${numberFormatter.format(value)} ${unit}`;

const getBackendErrorMessage = (err: unknown): string => {
  if (!axios.isAxiosError(err) || !err.response?.data) {
    return "";
  }

  const data = err.response.data as BackendErrorData;
  return data.error || data.message || "";
};

export default function FabricPlanningNewPage() {
  const { addTab } = useTabs();
  const [rows, setRows] = useState<PlanningRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [sortState, setSortState] = useState<SortState>({ key: "", direction: "asc" });

  const loadRows = async (): Promise<void> => {
    setLoading(true);
    setError("");

    try {
      const response = await axios.get("/api/accessories/planning");
      const sourceRows = Array.isArray(response.data?.rows) ? response.data.rows : [];
      const normalizedRows: PlanningRow[] = sourceRows.map((row: PlanningRow & { fisBaglantilari?: unknown }) => ({
        ...row,
        fisBaglantilari: resolveFisBaglantilari(row.fisBaglantilari),
      }));
      setRows(normalizedRows);
    } catch (err: unknown) {
      const backendMessage = getBackendErrorMessage(err);

      console.error("Aksesuar planlama verileri alinamadi:", err);
      if (backendMessage) {
        console.error("API hata detayi:", backendMessage);
      }

      setError(backendMessage || "Aksesuar planlama verileri alinamadi.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) => {
      const fisText = resolveFisBaglantilari((row as PlanningRow & { fisBaglantilari?: unknown }).fisBaglantilari)
        .join(" ")
        .toLowerCase();

      return (
        row.orderNo.toLowerCase().includes(query) ||
        row.modelAdi.toLowerCase().includes(query) ||
        row.musteri.toLowerCase().includes(query) ||
        row.malzemeAdi.toLowerCase().includes(query) ||
        row.varyantAciklama.toLowerCase().includes(query) ||
        fisText.includes(query)
      );
    });
  }, [rows, search]);

  const sortedRows = useMemo(() => {
    if (!sortState.key) return filteredRows;

    const { key, direction } = sortState;
    const next = [...filteredRows];

    next.sort((a, b) => {
      const left = a[key];
      const right = b[key];

      if (typeof left === "number" && typeof right === "number") {
        return direction === "asc" ? left - right : right - left;
      }

      const result = String(left).localeCompare(String(right), "tr");
      return direction === "asc" ? result : -result;
    });

    return next;
  }, [filteredRows, sortState]);

  const totals = useMemo(() => {
    return sortedRows.reduce(
      (acc, row) => {
        acc.gereken += row.gereken;
        acc.saSiparisi += row.saSiparisi;
        acc.gelen += row.gelen;
        acc.uretimeCikan += row.uretimeCikan;
        return acc;
      },
      { gereken: 0, saSiparisi: 0, gelen: 0, uretimeCikan: 0 }
    );
  }, [sortedRows]);

  const toggleSort = (key: SortKey): void => {
    setSortState((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "asc" };
    });
  };

  const openFabricOrderFromPlanning = (row: PlanningRow): void => {
    const normalizedFabricType = row.malzemeAdi.trim();
    const normalizedUnit = row.unit.toLowerCase().startsWith("m") ? "m" : "kg";
    const tabPath = `/accessories/orders?fabricType=${encodeURIComponent(normalizedFabricType)}&from=planning`;
    const tabTitle = `Aksesuar Siparisi - ${normalizedFabricType}`;
    const OrdersTabComponent: React.ComponentType = () => (
      <FabricOrdersPage
        initialFabricType={normalizedFabricType}
        initialQuantity={row.saSiparisi}
        initialUnitType={normalizedUnit}
        autoOpenNewOrder={row.saSiparisi > 0}
      />
    );

    addTab({
      title: tabTitle,
      path: tabPath,
      component: OrdersTabComponent,
      closable: true,
    });
  };

  const sortIndicator = (key: SortKey): string => {
    if (sortState.key !== key) return "";
    return sortState.direction === "asc" ? "^" : "v";
  };

  const exportData = sortedRows.map((row) => ({
    "Order No": row.orderNo,
    "Model Adi": row.modelAdi,
    Miktar: formatNumber(row.miktar),
    Musteri: row.musteri,
    "Malzeme Adi": row.malzemeAdi,
    Gereken: formatQuantity(row.gereken, row.unit),
    "SA Siparisi": formatQuantity(row.saSiparisi, row.unit),
    "Varyant-1 Aciklama": row.varyantAciklama,
    Gelen: formatQuantity(row.gelen, row.unit),
    "Uretime Cikan": formatQuantity(row.uretimeCikan, row.unit),
    "Fis Baglantilari": resolveFisBaglantilari((row as PlanningRow & { fisBaglantilari?: unknown }).fisBaglantilari).join(", ") || "-",
  }));

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.title}>Aksesuar Planlama (Yeni)</h1>
          <p style={styles.subtitle}>Siparis satirlari ve receteye gore Aksesuar ihtiyaci, gelen ve uretime cikan miktarlar.</p>
        </div>
        <button type="button" onClick={loadRows} style={styles.refreshButton}>
          Yenile
        </button>
      </div>

      <div style={styles.toolbar}>
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Order no, model, musteri, malzeme veya varyant ara..."
          style={styles.searchInput}
        />
        <ExportButtons data={exportData} filename="Aksesuar_planlama_yeni" disabled={sortedRows.length === 0} />
      </div>

      {error ? <div style={styles.errorBox}>{error}</div> : null}

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th} onClick={() => toggleSort("orderNo")}>
                Order No {sortIndicator("orderNo")}
              </th>
              <th style={styles.th} onClick={() => toggleSort("modelAdi")}>
                Model Adi {sortIndicator("modelAdi")}
              </th>
              <th style={{ ...styles.th, ...styles.thRight }} onClick={() => toggleSort("miktar")}>
                Miktar {sortIndicator("miktar")}
              </th>
              <th style={styles.th} onClick={() => toggleSort("musteri")}>
                Musteri {sortIndicator("musteri")}
              </th>
              <th style={styles.th} onClick={() => toggleSort("malzemeAdi")}>
                Malzeme Adi {sortIndicator("malzemeAdi")}
              </th>
              <th style={{ ...styles.th, ...styles.thRight }} onClick={() => toggleSort("gereken")}>
                Gereken {sortIndicator("gereken")}
              </th>
              <th style={{ ...styles.th, ...styles.thRight }} onClick={() => toggleSort("saSiparisi")}>
                SA Siparisi {sortIndicator("saSiparisi")}
              </th>
              <th style={styles.th} onClick={() => toggleSort("varyantAciklama")}>
                Varyant-1 Aciklama {sortIndicator("varyantAciklama")}
              </th>
              <th style={{ ...styles.th, ...styles.thRight }} onClick={() => toggleSort("gelen")}>
                Gelen {sortIndicator("gelen")}
              </th>
              <th style={{ ...styles.th, ...styles.thRight }} onClick={() => toggleSort("uretimeCikan")}>
                Uretime Cikan {sortIndicator("uretimeCikan")}
              </th>
              <th style={styles.th}>Fis Baglantilari</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td style={styles.td} colSpan={11}>
                  Yukleniyor...
                </td>
              </tr>
            ) : sortedRows.length === 0 ? (
              <tr>
                <td style={styles.td} colSpan={11}>
                  Kayit bulunamadi.
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => (
                <tr key={row.id} style={styles.tr}>
                  <td style={styles.td}>{row.orderNo}</td>
                  <td style={styles.td}>{row.modelAdi}</td>
                  <td style={{ ...styles.td, ...styles.tdRight }}>{formatNumber(row.miktar)}</td>
                  <td style={styles.td}>{row.musteri}</td>
                  <td style={styles.td}>{row.malzemeAdi}</td>
                  <td style={{ ...styles.td, ...styles.tdRight }}>{formatQuantity(row.gereken, row.unit)}</td>
                  <td style={{ ...styles.td, ...styles.tdRight }}>
                    <button
                      type="button"
                      style={styles.saOrderButton}
                      onClick={() => openFabricOrderFromPlanning(row)}
                    >
                      {formatQuantity(row.saSiparisi, row.unit)}
                    </button>
                  </td>
                  <td style={styles.td}>{row.varyantAciklama}</td>
                  <td style={{ ...styles.td, ...styles.tdRight }}>{formatQuantity(row.gelen, row.unit)}</td>
                  <td style={{ ...styles.td, ...styles.tdRight }}>{formatQuantity(row.uretimeCikan, row.unit)}</td>
                  <td style={styles.td}>
                    {resolveFisBaglantilari((row as PlanningRow & { fisBaglantilari?: unknown }).fisBaglantilari).join(", ") || "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {!loading && sortedRows.length > 0 ? (
            <tfoot>
              <tr>
                <td style={styles.tdTotal} colSpan={5}>
                  Toplam
                </td>
                <td style={{ ...styles.tdTotal, ...styles.tdRight }}>{formatNumber(totals.gereken)}</td>
                <td style={{ ...styles.tdTotal, ...styles.tdRight }}>{formatNumber(totals.saSiparisi)}</td>
                <td style={styles.tdTotal}>-</td>
                <td style={{ ...styles.tdTotal, ...styles.tdRight }}>{formatNumber(totals.gelen)}</td>
                <td style={{ ...styles.tdTotal, ...styles.tdRight }}>{formatNumber(totals.uretimeCikan)}</td>
                <td style={styles.tdTotal}>-</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "1rem",
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    color: "#1f2937",
  },
  subtitle: {
    margin: "0.5rem 0 0",
    color: "#4b5563",
    fontSize: "0.95rem",
  },
  refreshButton: {
    backgroundColor: "#1f6feb",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    padding: "0.6rem 1rem",
    cursor: "pointer",
    fontWeight: 600,
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "1rem",
    flexWrap: "wrap",
  },
  searchInput: {
    minWidth: "320px",
    flex: 1,
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    padding: "0.65rem 0.75rem",
    outline: "none",
  },
  errorBox: {
    border: "1px solid #fecaca",
    backgroundColor: "#fef2f2",
    color: "#b91c1c",
    borderRadius: "8px",
    padding: "0.75rem",
  },
  tableWrapper: {
    overflowX: "auto",
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    backgroundColor: "#ffffff",
  },
  table: {
    width: "100%",
    minWidth: "1400px",
    borderCollapse: "collapse",
    fontSize: "0.9rem",
  },
  th: {
    backgroundColor: "#e5ece9",
    color: "#1f2937",
    textAlign: "left",
    padding: "0.6rem 0.7rem",
    borderBottom: "1px solid #cbd5e1",
    borderRight: "1px solid #d1d5db",
    cursor: "pointer",
    whiteSpace: "nowrap",
    userSelect: "none",
  },
  thRight: {
    textAlign: "right",
  },
  tr: {
    backgroundColor: "#e9f3ee",
  },
  td: {
    padding: "0.5rem 0.7rem",
    borderBottom: "1px solid #d1d5db",
    borderRight: "1px solid #d1d5db",
    color: "#111827",
    whiteSpace: "nowrap",
  },
  tdRight: {
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  },
  tdTotal: {
    padding: "0.65rem 0.7rem",
    borderTop: "2px solid #94a3b8",
    borderRight: "1px solid #d1d5db",
    fontWeight: 700,
    backgroundColor: "#e2e8f0",
    color: "#0f172a",
  },
  saOrderButton: {
    border: "none",
    background: "#e0f2fe",
    color: "#075985",
    borderRadius: "999px",
    padding: "0.25rem 0.6rem",
    fontWeight: 700,
    fontSize: "0.82rem",
    cursor: "pointer",
  },
};

