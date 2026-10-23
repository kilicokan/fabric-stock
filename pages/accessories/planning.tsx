import { useEffect, useRef, useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";

type PlanningRow = {
  id: number;
  fabricType: string;
  tableName: string;
  quantityKg: number;
  quantityMeter: number;
  exitDate: string;
  modelNo?: string;
  orderNo?: string;
  customerId?: string;
  color?: string;
  outputQuantity: number;
  divideBy: "kg" | "meter";
  unitGramaj: number;
};

type SortKey =
  | "fabricType"
  | "tableName"
  | "quantityKg"
  | "quantityMeter"
  | "exitDate"
  | "modelNo"
  | "orderNo"
  | "customerId"
  | "color"
  | "unitGramaj";

type SortDirection = "asc" | "desc";

type ExitApiRow = {
  id?: number;
  fabricType?: string;
  productWeightKg?: number;
  productLengthMeter?: number;
  createdAt?: string;
  modelNo?: string;
  orderNo?: string;
  customerId?: string;
  color?: string;
  cuttingTable?: { name?: string };
  fabricEntry?: { fabric?: { name?: string } };
};

const sortableHeaders: Array<{ key: SortKey; label: string }> = [
  { key: "fabricType", label: "KumaÅŸ Tipi" },
  { key: "tableName", label: "Masa" },
  { key: "quantityKg", label: "Miktar (kg)" },
  { key: "quantityMeter", label: "Miktar (metre)" },
  { key: "exitDate", label: "Ã‡Ä±kÄ±ÅŸ Tarihi" },
  { key: "modelNo", label: "Model No" },
  { key: "orderNo", label: "SipariÅŸ No" },
  { key: "customerId", label: "MÃ¼ÅŸteri ID" },
  { key: "color", label: "Renk" },
  { key: "unitGramaj", label: "Birim Gramaj" },
];

const ui = {
  page: {
    maxWidth: "1380px",
    margin: "24px auto",
    padding: "20px",
    borderRadius: "16px",
    border: "1px solid var(--fs-color-border)",
    background: "linear-gradient(180deg, var(--fs-color-surface) 0%, var(--fs-color-bg) 100%)",
    boxShadow: "0 20px 45px -28px rgba(15, 23, 42, 0.35)",
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
    color: "var(--fs-color-text)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "14px",
    flexWrap: "wrap" as const,
  },
  title: { margin: 0, fontSize: "1.55rem", fontWeight: 700 },
  btnRow: { display: "flex", gap: "8px", flexWrap: "wrap" as const },
  primaryBtn: {
    minHeight: "38px",
    borderRadius: "10px",
    border: "1px solid #93c5fd",
    background: "#eff6ff",
    color: "var(--fs-color-primary-strong)",
    padding: "0 14px",
    fontWeight: 700,
    fontSize: "0.9rem",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
  },
  dangerBtn: {
    minHeight: "38px",
    borderRadius: "10px",
    border: "1px solid #fecaca",
    background: "#fee2e2",
    color: "var(--fs-color-danger)",
    padding: "0 14px",
    fontWeight: 700,
    fontSize: "0.9rem",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
  },
  filterCard: {
    border: "1px solid var(--fs-color-border)",
    borderRadius: "12px",
    background: "var(--fs-color-surface)",
    padding: "12px",
    marginBottom: "12px",
  },
  filterGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "10px",
  },
  label: { display: "block", fontSize: "0.82rem", marginBottom: "4px", color: "var(--fs-color-text-muted)", fontWeight: 600 },
  input: {
    width: "100%",
    minHeight: "38px",
    padding: "8px 10px",
    border: "1px solid var(--fs-color-border-strong)",
    borderRadius: "10px",
    background: "var(--fs-color-surface-soft)",
    color: "var(--fs-color-text)",
    fontSize: "0.9rem",
  },
  rangeRow: { display: "flex", gap: "8px" },
  tableCard: {
    border: "1px solid var(--fs-color-border)",
    borderRadius: "12px",
    background: "var(--fs-color-surface)",
    overflow: "hidden",
  },
  table: { width: "100%", borderCollapse: "collapse" as const, minWidth: "1600px" },
  th: {
    padding: "9px 10px",
    background: "var(--fs-color-surface-soft)",
    borderBottom: "1px solid var(--fs-color-border)",
    borderRight: "1px solid var(--fs-color-border)",
    color: "var(--fs-color-text-muted)",
    fontSize: "0.78rem",
    letterSpacing: "0.02em",
    textTransform: "uppercase" as const,
    textAlign: "left" as const,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
  td: {
    padding: "9px 10px",
    borderBottom: "1px solid var(--fs-color-border)",
    borderRight: "1px solid var(--fs-color-border)",
    fontSize: "0.88rem",
    color: "var(--fs-color-text)",
    whiteSpace: "nowrap" as const,
  },
  tdCenter: { textAlign: "center" as const, color: "var(--fs-color-text-muted)" },
  badgeMain: { padding: "2px 10px", borderRadius: "999px", background: "var(--fs-color-primary-soft)", color: "var(--fs-color-primary-strong)", fontWeight: 700, fontSize: "0.76rem" },
  badgeKg: { padding: "2px 8px", borderRadius: "8px", background: "#ecfdf3", color: "var(--fs-color-success)", fontWeight: 700, fontSize: "0.76rem" },
  badgeM: { padding: "2px 8px", borderRadius: "8px", background: "#eff6ff", color: "var(--fs-color-primary-strong)", fontWeight: 700, fontSize: "0.76rem" },
  badgeGram: { padding: "2px 8px", borderRadius: "8px", background: "#fef3c7", color: "#92400e", fontWeight: 700, fontSize: "0.76rem" },
  summary: {
    padding: "9px 12px",
    background: "var(--fs-color-surface-soft)",
    color: "var(--fs-color-text-muted)",
    fontSize: "0.85rem",
    borderTop: "1px solid var(--fs-color-border)",
  },
};

const getSortValue = (row: PlanningRow, key: SortKey): string | number => {
  switch (key) {
    case "fabricType":
      return row.fabricType || "";
    case "tableName":
      return row.tableName || "";
    case "quantityKg":
      return row.quantityKg;
    case "quantityMeter":
      return row.quantityMeter;
    case "exitDate":
      return row.exitDate || "";
    case "modelNo":
      return row.modelNo || "";
    case "orderNo":
      return row.orderNo || "";
    case "customerId":
      return row.customerId || "";
    case "color":
      return row.color || "";
    case "unitGramaj":
      return row.unitGramaj;
  }
};

export default function FabricsPlanningPage() {
  const [rows, setRows] = useState<PlanningRow[]>([]);
  const [filteredRows, setFilteredRows] = useState<PlanningRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    fabricType: "",
    tableName: "",
    minKg: "",
    maxKg: "",
    minMeter: "",
    maxMeter: "",
    startDate: "",
    endDate: "",
  });
  const [sortConfig, setSortConfig] = useState<{ key: SortKey | ""; direction: SortDirection }>({
    key: "",
    direction: "asc",
  });
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await axios.get<ExitApiRow[]>("/api/accessory-exits");
        const source = Array.isArray(response.data) ? response.data : [];
        const mapped: PlanningRow[] = source.map((item, index) => {
          const quantityKg = Number(item.productWeightKg || 0);
          const quantityMeter = Number(item.productLengthMeter || 0);
          const fabricType = item.fabricType || item.fabricEntry?.fabric?.name || "Bilinmiyor";
          const tableName = item.cuttingTable?.name || "Bilinmiyor";

          return {
            id: item.id || index + 1,
            fabricType,
            tableName,
            quantityKg,
            quantityMeter,
            exitDate: item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
            modelNo: item.modelNo,
            orderNo: item.orderNo,
            customerId: item.customerId,
            color: item.color,
            outputQuantity: 0,
            divideBy: "kg",
            unitGramaj: quantityMeter > 0 ? quantityKg / quantityMeter : 0,
          };
        });
        setRows(mapped);
        setFilteredRows(mapped);
      } catch (error) {
        console.error("Veri alÄ±namadÄ±:", error);
        setRows([]);
        setFilteredRows([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, []);

  useEffect(() => {
    let result = rows.filter((row) => {
      return (
        (filters.fabricType === "" || row.fabricType.toLowerCase().includes(filters.fabricType.toLowerCase())) &&
        (filters.tableName === "" || row.tableName.toLowerCase().includes(filters.tableName.toLowerCase())) &&
        (filters.minKg === "" || row.quantityKg >= Number(filters.minKg)) &&
        (filters.maxKg === "" || row.quantityKg <= Number(filters.maxKg)) &&
        (filters.minMeter === "" || row.quantityMeter >= Number(filters.minMeter)) &&
        (filters.maxMeter === "" || row.quantityMeter <= Number(filters.maxMeter)) &&
        (filters.startDate === "" || new Date(row.exitDate) >= new Date(filters.startDate)) &&
        (filters.endDate === "" || new Date(row.exitDate) <= new Date(filters.endDate))
      );
    });

    if (sortConfig.key) {
      const sortKey = sortConfig.key as SortKey;
      result = [...result].sort((a, b) => {
        const aValue = getSortValue(a, sortKey);
        const bValue = getSortValue(b, sortKey);

        if (aValue < bValue) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }

    setFilteredRows(result);
  }, [rows, filters, sortConfig]);

  const handleFilterChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleOutputChange = (id: number, value: number) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, outputQuantity: value, unitGramaj: value > 0 ? row.quantityKg / value : 0 } : row))
    );
  };

  const handleDivideByChange = (id: number, value: "kg" | "meter") => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, divideBy: value } : row)));
  };

  const handleSort = (key: SortKey) => {
    const direction: SortDirection = sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
    setSortConfig({ key, direction });
  };

  const resetFilters = () => {
    setFilters({
      fabricType: "",
      tableName: "",
      minKg: "",
      maxKg: "",
      minMeter: "",
      maxMeter: "",
      startDate: "",
      endDate: "",
    });
    setSortConfig({ key: "", direction: "asc" });
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kesim Raporu");
    XLSX.writeFile(workbook, "kesim_raporu.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.text("Kesim Raporu", 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`OluÅŸturulma Tarihi: ${new Date().toLocaleDateString("tr-TR")}`, 14, 22);
    doc.text(`Toplam KayÄ±t: ${filteredRows.length}`, 14, 28);

    const tableColumn = [
      "KumaÅŸ Tipi",
      "Masa",
      "Miktar (kg)",
      "Miktar (metre)",
      "Ã‡Ä±kÄ±ÅŸ Tarihi",
      "Model No",
      "SipariÅŸ No",
      "MÃ¼ÅŸteri ID",
      "Renk",
      "Birim Gramaj",
      "Ã‡Ä±ktÄ± MiktarÄ±",
      "BÃ¶lÃ¼necek Birim",
    ];

    const tableRows = filteredRows.map((row) => [
      row.fabricType,
      row.tableName,
      `${row.quantityKg} kg`,
      `${row.quantityMeter} m`,
      new Date(row.exitDate).toLocaleDateString("tr-TR"),
      row.modelNo || "-",
      row.orderNo || "-",
      row.customerId || "-",
      row.color || "-",
      `${row.unitGramaj.toFixed(3)} g/adet`,
      String(row.outputQuantity),
      row.divideBy === "kg" ? "kg" : "metre",
    ]);

    const docWithTable = doc as jsPDF & {
      autoTable: (options: {
        head: string[][];
        body: string[][];
        startY: number;
        theme: "grid";
        styles: { fontSize: number; cellPadding: number };
        headStyles: { fillColor: number[]; textColor: number; fontStyle: "bold" };
        alternateRowStyles: { fillColor: number[] };
      }) => void;
    };

    docWithTable.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    doc.save("kesim_raporu.pdf");
  };

  return (
    <div style={ui.page}>
      <div style={ui.header}>
        <h1 style={ui.title}>Kesim Raporu</h1>
        <div style={ui.btnRow}>
          <button onClick={exportToExcel} style={ui.primaryBtn}>
            Excel&apos;e Aktar
          </button>
          <button onClick={exportToPDF} style={ui.dangerBtn}>
            PDF&apos;e Aktar
          </button>
        </div>
      </div>

      <div style={ui.filterCard}>
        <div style={ui.filterGrid}>
          <div>
            <label style={ui.label}>KumaÅŸ Tipi</label>
            <input type="text" name="fabricType" value={filters.fabricType} onChange={handleFilterChange} placeholder="KumaÅŸ tipi ara..." style={ui.input} />
          </div>
          <div>
            <label style={ui.label}>Masa AdÄ±</label>
            <input type="text" name="tableName" value={filters.tableName} onChange={handleFilterChange} placeholder="Masa adÄ± ara..." style={ui.input} />
          </div>
          <div>
            <label style={ui.label}>Kg AralÄ±ÄŸÄ±</label>
            <div style={ui.rangeRow}>
              <input type="number" name="minKg" value={filters.minKg} onChange={handleFilterChange} placeholder="Min" style={ui.input} />
              <input type="number" name="maxKg" value={filters.maxKg} onChange={handleFilterChange} placeholder="Max" style={ui.input} />
            </div>
          </div>
          <div>
            <label style={ui.label}>Metre AralÄ±ÄŸÄ±</label>
            <div style={ui.rangeRow}>
              <input type="number" name="minMeter" value={filters.minMeter} onChange={handleFilterChange} placeholder="Min" style={ui.input} />
              <input type="number" name="maxMeter" value={filters.maxMeter} onChange={handleFilterChange} placeholder="Max" style={ui.input} />
            </div>
          </div>
          <div>
            <label style={ui.label}>Tarih AralÄ±ÄŸÄ±</label>
            <div style={ui.rangeRow}>
              <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} style={ui.input} />
              <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} style={ui.input} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "end" }}>
            <button onClick={resetFilters} style={ui.primaryBtn}>
              Filtreleri SÄ±fÄ±rla
            </button>
          </div>
        </div>
      </div>

      <div style={ui.tableCard} ref={tableRef}>
        <div style={{ overflowX: "auto" }}>
          <table style={ui.table}>
            <thead>
              <tr>
                {sortableHeaders.map((head) => (
                  <th key={head.key} style={ui.th} onClick={() => handleSort(head.key)}>
                    {head.label} {sortConfig.key === head.key ? (sortConfig.direction === "asc" ? "â†‘" : "â†“") : ""}
                  </th>
                ))}
                <th style={{ ...ui.th, cursor: "default" }}>Ã‡Ä±ktÄ± MiktarÄ±</th>
                <th style={{ ...ui.th, cursor: "default" }}>BÃ¶lÃ¼necek Birim</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} style={{ ...ui.td, ...ui.tdCenter, padding: "16px" }}>
                    YÃ¼kleniyor...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ ...ui.td, ...ui.tdCenter, padding: "16px" }}>
                    Filtreleme kriterlerinize uygun kayÄ±t bulunamadÄ±.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, index) => (
                  <tr key={row.id} style={{ background: index % 2 ? "var(--fs-color-surface-soft)" : "var(--fs-color-surface)" }}>
                    <td style={ui.td}>
                      <span style={ui.badgeMain}>{row.fabricType}</span>
                    </td>
                    <td style={ui.td}>{row.tableName}</td>
                    <td style={ui.td}>
                      <span style={ui.badgeKg}>{row.quantityKg} kg</span>
                    </td>
                    <td style={ui.td}>
                      <span style={ui.badgeM}>{row.quantityMeter} m</span>
                    </td>
                    <td style={ui.td}>{new Date(row.exitDate).toLocaleDateString("tr-TR")}</td>
                    <td style={ui.td}>{row.modelNo || "-"}</td>
                    <td style={ui.td}>{row.orderNo || "-"}</td>
                    <td style={ui.td}>{row.customerId || "-"}</td>
                    <td style={ui.td}>{row.color || "-"}</td>
                    <td style={ui.td}>
                      <span style={ui.badgeGram}>{row.unitGramaj.toFixed(3)} g/adet</span>
                    </td>
                    <td style={ui.td}>
                      <input
                        type="number"
                        value={row.outputQuantity}
                        onChange={(event) => handleOutputChange(row.id, Number(event.target.value))}
                        style={{ ...ui.input, minHeight: "30px", width: "90px", padding: "4px 6px" }}
                        min="0"
                      />
                    </td>
                    <td style={ui.td}>
                      <select
                        value={row.divideBy}
                        onChange={(event) => handleDivideByChange(row.id, event.target.value as "kg" | "meter")}
                        style={{ ...ui.input, minHeight: "30px", width: "92px", padding: "4px 6px" }}
                      >
                        <option value="kg">kg</option>
                        <option value="meter">metre</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && filteredRows.length > 0 && <div style={ui.summary}>Toplam {filteredRows.length} kayÄ±t bulundu</div>}
      </div>
    </div>
  );
}

