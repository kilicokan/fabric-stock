import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import axios from "axios";
import { useTabs } from "../TabContext";
import FabricInvoicesSlipsPage from "../../pages/fabrics/invoices-slips";
import AccessoryInvoicesSlipsPage from "../../pages/accessories/invoices-slips";
import {
  DEFAULT_PURCHASE_VOUCHER_TYPE_CODE,
  PURCHASE_VOUCHER_TYPES,
  type PurchaseVoucherType,
} from "../../lib/purchase-voucher-types";

type ListDocumentType = "INVOICE" | "DISPATCH";
type PurchaseDocumentType = "fatura" | "irsaliye";
type SourceType = "FABRIC" | "ACCESSORY";

type RawDocument = {
  id: number;
  documentType: string;
  fgType: string;
  fgNumber: string;
  date: string;
  orderNo: string | null;
  fabricOrderId?: number | null;
  supplierCode: string;
  supplierName: string;
  documentNumber: string;
  entryWarehouseCode: string;
  exitWarehouseCode: string;
  total: number;
  fabricName: string;
  colorName: string;
  quantity: number;
  unitType: string;
};

type SourceOrderOption = {
  id: number;
  orderNumber: number;
  fabricName: string;
  colorName: string;
  remainingQuantity: number;
  unitType: string;
};

type PurchaseRow = {
  rowKey: string;
  id: number;
  source: SourceType;
  sourceLabel: string;
  documentType: PurchaseDocumentType;
  dateRaw: string;
  orderLinkId: number | null;
  fisTipi: string;
  fisNumarasi: string;
  fisTarihi: string;
  cariHesapKodu: string;
  cariHesapAdi: string;
  belgeNumarasi: string;
  girisDepoKodu: string;
  cikisDepoKodu: string;
  malzeme: string;
  renk: string;
  toplamMiktar: number;
  birim: string;
  fisToplami: number;
};

type PurchaseColumnId =
  | "sourceLabel"
  | "fisTipi"
  | "fisNumarasi"
  | "fisTarihi"
  | "cariHesapKodu"
  | "cariHesapAdi"
  | "belgeNumarasi"
  | "girisDepoKodu"
  | "cikisDepoKodu"
  | "malzeme"
  | "renk"
  | "toplamMiktar"
  | "birim"
  | "fisToplami";

type PurchaseColumn = {
  id: PurchaseColumnId;
  label: string;
  width: number;
  minWidth: number;
  textAlign?: "left" | "right";
};

type GroupedPurchaseRow =
  | {
      kind: "group";
      key: string;
      level: number;
      columnId: PurchaseColumnId;
      value: string;
      count: number;
    }
  | {
      kind: "row";
      row: PurchaseRow;
    };

type ContextMenuState = {
  visible: boolean;
  x: number;
  y: number;
};

type Props = {
  documentType: ListDocumentType;
  title: string;
};

type ContextMenuItem = {
  label: string;
  action?: () => void;
  hint?: string;
  disabled?: boolean;
  divider?: boolean;
};

const moneyFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PURCHASE_COLUMNS: PurchaseColumn[] = [
  { id: "sourceLabel", label: "Kaynak", width: 90, minWidth: 70 },
  { id: "fisTipi", label: "Fis Tipi", width: 220, minWidth: 120 },
  { id: "fisNumarasi", label: "Fis Numarasi", width: 120, minWidth: 100 },
  { id: "fisTarihi", label: "Fis Tarihi", width: 120, minWidth: 100 },
  { id: "cariHesapKodu", label: "Cari Hesap Kodu", width: 140, minWidth: 120 },
  { id: "cariHesapAdi", label: "Cari Hesap Adi", width: 300, minWidth: 180 },
  { id: "belgeNumarasi", label: "Belge Numarasi", width: 140, minWidth: 120 },
  { id: "girisDepoKodu", label: "Giris Depo", width: 120, minWidth: 100 },
  { id: "cikisDepoKodu", label: "Cikis Depo", width: 120, minWidth: 100 },
  { id: "malzeme", label: "Malzeme", width: 170, minWidth: 120 },
  { id: "renk", label: "Renk", width: 130, minWidth: 100 },
  { id: "toplamMiktar", label: "Toplam Miktar", width: 140, minWidth: 110, textAlign: "right" },
  { id: "birim", label: "Birim", width: 90, minWidth: 80 },
  { id: "fisToplami", label: "Fis Toplami", width: 140, minWidth: 110, textAlign: "right" },
];

const GROUP_HINT_TEXT = "Gruplamak icin kolon surukleyip birakin";

const dateFormatter = (rawDate?: string | null): string => {
  if (!rawDate) return "";
  const date = new Date(rawDate);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("tr-TR");
};

const getAuthHeaders = (): { Authorization: string } | undefined => {
  if (typeof window === "undefined") return undefined;
  const token = localStorage.getItem("token") || localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};

const normalizePurchaseDocumentType = (value: unknown): PurchaseDocumentType =>
  String(value || "").toLowerCase().startsWith("f") ? "fatura" : "irsaliye";

const defaultFisTipi = (documentType: PurchaseDocumentType): string =>
  documentType === "fatura" ? "Alim Faturasi" : "Alim Irsaliyesi";

const toPurchaseRow = (source: SourceType, raw: RawDocument): PurchaseRow => {
  const normalizedDocType = normalizePurchaseDocumentType(raw.documentType);
  const sourceLabel = source === "FABRIC" ? "Kumas" : "Aksesuar";
  return {
    rowKey: `${source}-${raw.id}`,
    id: Number(raw.id),
    source,
    sourceLabel,
    documentType: normalizedDocType,
    dateRaw: String(raw.date || ""),
    orderLinkId: raw.fabricOrderId ? Number(raw.fabricOrderId) : null,
    fisTipi: String(raw.fgType || "").trim() || defaultFisTipi(normalizedDocType),
    fisNumarasi: String(raw.fgNumber || "").trim(),
    fisTarihi: dateFormatter(raw.date),
    cariHesapKodu: String(raw.supplierCode || "").trim(),
    cariHesapAdi: String(raw.supplierName || "").trim(),
    belgeNumarasi: String(raw.documentNumber || "").trim(),
    girisDepoKodu: String(raw.entryWarehouseCode || "").trim(),
    cikisDepoKodu: String(raw.exitWarehouseCode || "").trim(),
    malzeme: String(raw.fabricName || "").trim(),
    renk: String(raw.colorName || "").trim(),
    toplamMiktar: Number(raw.quantity || 0),
    birim: String(raw.unitType || "").trim(),
    fisToplami: Number(raw.total || 0),
  };
};

const getPurchaseColumnValue = (row: PurchaseRow, columnId: PurchaseColumnId): string | number => {
  switch (columnId) {
    case "sourceLabel":
      return row.sourceLabel;
    case "fisTipi":
      return row.fisTipi;
    case "fisNumarasi":
      return row.fisNumarasi;
    case "fisTarihi":
      return row.fisTarihi;
    case "cariHesapKodu":
      return row.cariHesapKodu;
    case "cariHesapAdi":
      return row.cariHesapAdi;
    case "belgeNumarasi":
      return row.belgeNumarasi;
    case "girisDepoKodu":
      return row.girisDepoKodu;
    case "cikisDepoKodu":
      return row.cikisDepoKodu;
    case "malzeme":
      return row.malzeme;
    case "renk":
      return row.renk;
    case "toplamMiktar":
      return row.toplamMiktar;
    case "birim":
      return row.birim;
    case "fisToplami":
      return row.fisToplami;
    default:
      return "";
  }
};

const getPurchaseColumnLabel = (columnId: PurchaseColumnId): string =>
  PURCHASE_COLUMNS.find((column) => column.id === columnId)?.label || columnId;

export default function PurchaseDocumentList({ documentType, title }: Props) {
  const { addTab } = useTabs();
  const [rows, setRows] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<SourceType>("FABRIC");
  const [selectedVoucherTypeCode, setSelectedVoucherTypeCode] = useState<number>(
    DEFAULT_PURCHASE_VOUCHER_TYPE_CODE
  );
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
  });
  const [columnWidths, setColumnWidths] = useState<Record<PurchaseColumnId, number>>(() => {
    const initial = {} as Record<PurchaseColumnId, number>;
    PURCHASE_COLUMNS.forEach((column) => {
      initial[column.id] = column.width;
    });
    return initial;
  });
  const [groupByColumns, setGroupByColumns] = useState<PurchaseColumnId[]>([]);
  const [draggingColumnId, setDraggingColumnId] = useState<PurchaseColumnId | null>(null);
  const [isGroupDropActive, setIsGroupDropActive] = useState(false);
  const resizingStateRef = useRef<{ columnId: PurchaseColumnId; startX: number; startWidth: number } | null>(
    null
  );

  const selectedVoucherType = useMemo<PurchaseVoucherType>(
    () =>
      PURCHASE_VOUCHER_TYPES.find((voucherType) => voucherType.code === selectedVoucherTypeCode) ||
      PURCHASE_VOUCHER_TYPES[0],
    [selectedVoucherTypeCode]
  );

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0 });
  };

  const openContextMenu = (event: ReactMouseEvent<HTMLElement>, rowKey: string | null = null) => {
    event.preventDefault();
    if (rowKey) {
      setSelectedRowKey(rowKey);
    }
    setContextMenu({ visible: true, x: event.clientX, y: event.clientY });
  };

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [fabricRes, accessoryRes] = await Promise.all([
        axios.get<RawDocument[]>("/api/fabric-documents"),
        axios.get<RawDocument[]>("/api/accessory-documents"),
      ]);

      const fabricRows = Array.isArray(fabricRes.data)
        ? fabricRes.data.map((item) => toPurchaseRow("FABRIC", item))
        : [];
      const accessoryRows = Array.isArray(accessoryRes.data)
        ? accessoryRes.data.map((item) => toPurchaseRow("ACCESSORY", item))
        : [];

      const mergedRows = [...fabricRows, ...accessoryRows].sort((a, b) => {
        const firstDate = new Date(a.dateRaw);
        const secondDate = new Date(b.dateRaw);
        if (Number.isNaN(firstDate.getTime()) && Number.isNaN(secondDate.getTime())) return b.id - a.id;
        if (Number.isNaN(firstDate.getTime())) return 1;
        if (Number.isNaN(secondDate.getTime())) return -1;
        return secondDate.getTime() - firstDate.getTime();
      });

      setRows(mergedRows);
    } catch {
      setRows([]);
      setError("Satin alma belgeleri yuklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    const onClick = () => closeContextMenu();
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const targetDocumentType: PurchaseDocumentType = documentType === "INVOICE" ? "fatura" : "irsaliye";
  const tabTypeParam = documentType === "INVOICE" ? "faturalar" : "irsaliyeler";

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase("tr");
    return rows.filter((row) => {
      if (row.documentType !== targetDocumentType) return false;
      if (!term) return true;
      const searchable = [
        row.sourceLabel,
        row.fisTipi,
        row.fisNumarasi,
        row.fisTarihi,
        row.cariHesapKodu,
        row.cariHesapAdi,
        row.belgeNumarasi,
        row.girisDepoKodu,
        row.cikisDepoKodu,
        row.malzeme,
        row.renk,
      ]
        .join(" ")
        .toLocaleLowerCase("tr");
      return searchable.includes(term);
    });
  }, [rows, searchTerm, targetDocumentType]);

  const startColumnResize = (columnId: PurchaseColumnId, event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const currentWidth = columnWidths[columnId];
    resizingStateRef.current = {
      columnId,
      startX: event.clientX,
      startWidth: currentWidth,
    };

    const onMouseMove = (moveEvent: MouseEvent) => {
      const state = resizingStateRef.current;
      if (!state || state.columnId !== columnId) return;
      const columnMeta = PURCHASE_COLUMNS.find((column) => column.id === state.columnId);
      const minWidth = columnMeta?.minWidth ?? 80;
      const nextWidth = Math.max(minWidth, state.startWidth + (moveEvent.clientX - state.startX));
      setColumnWidths((prev) => ({ ...prev, [state.columnId]: nextWidth }));
    };

    const stopResize = () => {
      resizingStateRef.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", stopResize);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", stopResize);
  };

  const handleHeaderDragStart = (columnId: PurchaseColumnId, event: ReactDragEvent<HTMLElement>) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", columnId);
    setDraggingColumnId(columnId);
  };

  const handleHeaderDragEnd = () => {
    setDraggingColumnId(null);
    setIsGroupDropActive(false);
  };

  const addGroupColumn = (columnId: PurchaseColumnId) => {
    setGroupByColumns((prev) => (prev.includes(columnId) ? prev : [...prev, columnId]));
  };

  const removeGroupColumn = (columnId: PurchaseColumnId) => {
    setGroupByColumns((prev) => prev.filter((value) => value !== columnId));
  };

  const groupedRows = useMemo<GroupedPurchaseRow[]>(() => {
    if (!groupByColumns.length) {
      return filteredRows.map((row) => ({ kind: "row", row }));
    }

    const groupRecursive = (
      sourceRows: PurchaseRow[],
      level: number,
      keyPath: string
    ): GroupedPurchaseRow[] => {
      if (level >= groupByColumns.length) {
        return sourceRows.map((row) => ({ kind: "row", row }));
      }

      const columnId = groupByColumns[level];
      const grouped = new Map<string, PurchaseRow[]>();

      sourceRows.forEach((row) => {
        const rawValue = getPurchaseColumnValue(row, columnId);
        const value = String(rawValue || "").trim() || "(Bos)";
        const bucket = grouped.get(value);
        if (bucket) {
          bucket.push(row);
        } else {
          grouped.set(value, [row]);
        }
      });

      const output: GroupedPurchaseRow[] = [];
      grouped.forEach((groupRows, groupValue) => {
        const nextKeyPath = keyPath ? `${keyPath}|${columnId}:${groupValue}` : `${columnId}:${groupValue}`;
        output.push({
          kind: "group",
          key: nextKeyPath,
          level,
          columnId,
          value: groupValue,
          count: groupRows.length,
        });
        output.push(...groupRecursive(groupRows, level + 1, nextKeyPath));
      });
      return output;
    };

    return groupRecursive(filteredRows, 0, "");
  }, [filteredRows, groupByColumns]);

  const tableColumnCount = PURCHASE_COLUMNS.length + 1;
  const tableMinWidth = useMemo(
    () =>
      20 +
      PURCHASE_COLUMNS.reduce((sum, column) => {
        return sum + (columnWidths[column.id] ?? column.width);
      }, 0),
    [columnWidths]
  );

  useEffect(() => {
    if (!filteredRows.length) {
      setSelectedRowKey(null);
      return;
    }
    if (!selectedRowKey || !filteredRows.some((row) => row.rowKey === selectedRowKey)) {
      setSelectedRowKey(filteredRows[0].rowKey);
    }
  }, [filteredRows, selectedRowKey]);

  const selectedRow = filteredRows.find((row) => row.rowKey === selectedRowKey) || null;

  const totals = useMemo(
    () =>
      filteredRows.reduce(
        (acc, row) => {
          acc.quantity += row.toplamMiktar;
          acc.amount += row.fisToplami;
          return acc;
        },
        { quantity: 0, amount: 0 }
      ),
    [filteredRows]
  );

  const openDocumentForm = (
    source: SourceType,
    id?: number,
    requestedVoucherType?: PurchaseVoucherType,
    fromOrderId?: number
  ) => {
    const sourceLabel = source === "FABRIC" ? "Kumas" : "Aksesuar";
    let tabPath =
      source === "FABRIC" ? `/fabrics/invoices-slips?type=${tabTypeParam}` : `/accessories/invoices-slips?type=${tabTypeParam}`;

    if (id) {
      tabPath += `&id=${id}`;
    } else {
      tabPath += `&new=1`;
      if (requestedVoucherType?.label) {
        tabPath += `&voucherType=${encodeURIComponent(requestedVoucherType.label)}`;
      }
      if (fromOrderId && Number.isInteger(fromOrderId) && fromOrderId > 0) {
        tabPath += `&fromOrderId=${fromOrderId}`;
      }
    }

    const voucherMode = requestedVoucherType?.voucherMode;
    const tabTitle = id
      ? `${sourceLabel} Belge ${id}`
      : `Yeni ${sourceLabel} ${documentType === "INVOICE" ? "Fatura" : "Irsaliye"}${voucherMode ? ` (${voucherMode})` : ""}`;

    const FormTab: ComponentType = () =>
      source === "FABRIC" ? <FabricInvoicesSlipsPage /> : <AccessoryInvoicesSlipsPage />;

    addTab({
      title: tabTitle,
      path: tabPath,
      component: FormTab,
      closable: true,
    });
  };

  const openSelectedRow = () => {
    if (!selectedRow) return;
    openDocumentForm(selectedRow.source, selectedRow.id);
  };

  const importFromSelectedOrder = () => {
    if (!selectedRow || !selectedRow.orderLinkId) return;
    openDocumentForm(
      selectedRow.source,
      undefined,
      documentType === "INVOICE" ? selectedVoucherType : undefined,
      selectedRow.orderLinkId
    );
  };

  const importFromOrder = async () => {
    const source = selectedRow?.source || selectedSource;
    const sourceLabel = source === "FABRIC" ? "kumas" : "aksesuar";
    const endpoint = source === "FABRIC" ? "/api/fabric-orders" : "/api/accessory-orders";

    if (selectedRow?.orderLinkId) {
      importFromSelectedOrder();
      return;
    }

    try {
      const response = await axios.get(endpoint, { headers: getAuthHeaders() });
      const orderList = Array.isArray(response.data) ? response.data : [];
      const sourceOrders: SourceOrderOption[] = orderList
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const casted = item as Partial<SourceOrderOption>;
          const id = Number(casted.id || 0);
          const orderNumber = Number(casted.orderNumber || 0);
          if (!id || !orderNumber) return null;
          return {
            id,
            orderNumber,
            fabricName: String(casted.fabricName || ""),
            colorName: String(casted.colorName || ""),
            remainingQuantity: Number(casted.remainingQuantity || 0),
            unitType: String(casted.unitType || ""),
          };
        })
        .filter((item): item is SourceOrderOption => Boolean(item));

      if (!sourceOrders.length) {
        setError(`Aktarilacak ${sourceLabel} siparisi bulunamadi.`);
        return;
      }

      const quickList = sourceOrders
        .slice(0, 20)
        .map(
          (order) =>
            `${order.id} - ${order.orderNumber} - ${order.fabricName || "-"} / ${order.colorName || "-"} (Kalan: ${order.remainingQuantity} ${order.unitType || "-"})`
        )
        .join("\n");
      const promptText = `Aktarilacak ${sourceLabel} siparisi ID veya Siparis No girin:\n${quickList}`;
      const rawInput = window.prompt(promptText, String(sourceOrders[0].id)) || "";
      const trimmedInput = rawInput.trim();
      if (!trimmedInput) return;

      const numericValue = Number(trimmedInput);
      const matchedOrder =
        Number.isInteger(numericValue) && numericValue > 0
          ? sourceOrders.find((order) => order.id === numericValue || order.orderNumber === numericValue)
          : sourceOrders.find((order) => String(order.orderNumber) === trimmedInput);

      if (!matchedOrder) {
        setError("Girilen siparis bulunamadi.");
        return;
      }

      openDocumentForm(
        source,
        undefined,
        documentType === "INVOICE" ? selectedVoucherType : undefined,
        matchedOrder.id
      );
    } catch {
      setError(`Siparisten aktarim icin ${sourceLabel} siparisleri yuklenemedi.`);
    }
  };

  const menuItems: ContextMenuItem[] = [
    { label: "Degistir", action: openSelectedRow, hint: "Shift+F4", disabled: !selectedRow },
    {
      label: "Yeni",
      action: () => openDocumentForm(selectedSource, undefined, selectedVoucherType),
      hint: "F4",
    },
    {
      label: "Siparisten Aktar",
      action: () => void importFromOrder(),
      hint: "F7",
    },
    { label: "sep-1", divider: true },
    { label: "Kopyalama", hint: "F8", disabled: true },
    { label: "Liste", hint: "F9", disabled: true },
    { label: "Yenile", action: () => void loadDocuments(), hint: "F5" },
    { label: "sep-2", divider: true },
    { label: "Kapat", action: closeContextMenu, hint: "Escape" },
  ];

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div>
          <div style={styles.heroTag}>MiraApp Satin Alma Modulu</div>
          <div style={styles.heroTitle}>{title}</div>
          <div style={styles.heroSub}>
            Kumas ve aksesuar belgeleri tek listede izlenir.
          </div>
        </div>
        <div style={styles.heroStats}>
          <div style={styles.heroStatCard}>
            <div style={styles.heroStatLabel}>Belge</div>
            <div style={styles.heroStatValue}>{filteredRows.length}</div>
          </div>
          <div style={styles.heroStatCard}>
            <div style={styles.heroStatLabel}>Toplam Miktar</div>
            <div style={styles.heroStatValue}>{moneyFormatter.format(totals.quantity)}</div>
          </div>
          <div style={styles.heroStatCard}>
            <div style={styles.heroStatLabel}>Toplam Tutar</div>
            <div style={styles.heroStatValue}>{moneyFormatter.format(totals.amount)}</div>
          </div>
        </div>
      </div>

      {error ? <div style={styles.error}>{error}</div> : null}

      <div style={styles.searchBarWrap}>
        <span style={styles.searchLabel}>Arama</span>
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          style={styles.searchInput}
          placeholder="Arama"
        />
      </div>

      <div style={styles.gridSection}>
        <div style={styles.listHeader}>{title}</div>
        <div
          style={{
            ...styles.groupHint,
            ...(isGroupDropActive ? styles.groupHintActive : {}),
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsGroupDropActive(true);
          }}
          onDragLeave={() => setIsGroupDropActive(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsGroupDropActive(false);
            const droppedColumnId = event.dataTransfer.getData("text/plain") as PurchaseColumnId;
            if (PURCHASE_COLUMNS.some((column) => column.id === droppedColumnId)) {
              addGroupColumn(droppedColumnId);
            }
          }}
        >
          {groupByColumns.length === 0 ? (
            GROUP_HINT_TEXT
          ) : (
            <div style={styles.groupChipWrap}>
              {groupByColumns.map((columnId) => (
                <span key={columnId} style={styles.groupChip}>
                  {getPurchaseColumnLabel(columnId)}
                  <button
                    type="button"
                    style={styles.groupChipRemove}
                    onClick={() => removeGroupColumn(columnId)}
                    title="Gruplamadan kaldir"
                  >
                    x
                  </button>
                </span>
              ))}
              <button type="button" style={styles.groupClearButton} onClick={() => setGroupByColumns([])}>
                Temizle
              </button>
            </div>
          )}
        </div>
        <div style={styles.tableViewport} onContextMenu={(event) => openContextMenu(event)}>
          <table style={{ ...styles.table, minWidth: tableMinWidth }}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: 20 }} />
                {PURCHASE_COLUMNS.map((column) => (
                  <th
                    key={column.id}
                    draggable
                    onDragStart={(event) => handleHeaderDragStart(column.id, event)}
                    onDragEnd={handleHeaderDragEnd}
                    title="Gruplamak icin yukari surukleyin"
                    style={{
                      ...styles.th,
                      width: columnWidths[column.id],
                      minWidth: column.minWidth,
                      textAlign: column.textAlign || "left",
                      ...(draggingColumnId === column.id ? styles.thDragging : {}),
                    }}
                  >
                    <span>{column.label}</span>
                    <span
                      role="presentation"
                      style={styles.resizeHandle}
                      onMouseDown={(event) => startColumnResize(column.id, event)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={tableColumnCount} style={styles.emptyCell}>
                    Yukleniyor...
                  </td>
                </tr>
              ) : groupedRows.length === 0 ? (
                <tr>
                  <td colSpan={tableColumnCount} style={styles.emptyCell}>
                    Kriterlere uygun belge bulunamadi.
                  </td>
                </tr>
              ) : (
                (() => {
                  let dataRowIndex = -1;
                  return groupedRows.map((item) => {
                    if (item.kind === "group") {
                      return (
                        <tr key={`group-${item.key}`}>
                          <td colSpan={tableColumnCount} style={styles.groupRowCell}>
                            <span style={{ paddingLeft: item.level * 18 }}>
                              {getPurchaseColumnLabel(item.columnId)}: {item.value} ({item.count})
                            </span>
                          </td>
                        </tr>
                      );
                    }

                    dataRowIndex += 1;
                    const row = item.row;
                    const isSelected = selectedRowKey === row.rowKey;
                    return (
                      <tr
                        key={row.rowKey}
                        style={isSelected ? styles.trSelected : dataRowIndex % 2 === 0 ? styles.trEven : styles.trOdd}
                        onClick={() => setSelectedRowKey(row.rowKey)}
                        onDoubleClick={() => openDocumentForm(row.source, row.id)}
                        onContextMenu={(event) => openContextMenu(event, row.rowKey)}
                      >
                        <td style={styles.indicatorCell}>{isSelected ? ">" : ""}</td>
                        <td style={{ ...styles.td, width: columnWidths.sourceLabel }}>{row.sourceLabel}</td>
                        <td style={{ ...styles.td, width: columnWidths.fisTipi }}>{row.fisTipi || "-"}</td>
                        <td style={{ ...styles.td, width: columnWidths.fisNumarasi }}>{row.fisNumarasi || "-"}</td>
                        <td style={{ ...styles.td, width: columnWidths.fisTarihi }}>{row.fisTarihi || "-"}</td>
                        <td style={{ ...styles.td, width: columnWidths.cariHesapKodu }}>{row.cariHesapKodu || "-"}</td>
                        <td style={{ ...styles.td, width: columnWidths.cariHesapAdi }}>{row.cariHesapAdi || "-"}</td>
                        <td style={{ ...styles.td, width: columnWidths.belgeNumarasi }}>{row.belgeNumarasi || "-"}</td>
                        <td style={{ ...styles.td, width: columnWidths.girisDepoKodu }}>{row.girisDepoKodu || "-"}</td>
                        <td style={{ ...styles.td, width: columnWidths.cikisDepoKodu }}>{row.cikisDepoKodu || "-"}</td>
                        <td style={{ ...styles.td, width: columnWidths.malzeme }}>{row.malzeme || "-"}</td>
                        <td style={{ ...styles.td, width: columnWidths.renk }}>{row.renk || "-"}</td>
                        <td style={{ ...styles.td, width: columnWidths.toplamMiktar, textAlign: "right" }}>
                          {moneyFormatter.format(row.toplamMiktar)}
                        </td>
                        <td style={{ ...styles.td, width: columnWidths.birim }}>{row.birim || "-"}</td>
                        <td style={{ ...styles.td, width: columnWidths.fisToplami, textAlign: "right" }}>
                          {moneyFormatter.format(row.fisToplami)}
                        </td>
                      </tr>
                    );
                  });
                })()
              )}
            </tbody>
          </table>
        </div>

        <div style={styles.bottomBar}>
          <button style={styles.bottomButton} onClick={() => void loadDocuments()}>
            Yenile
          </button>
          <label style={styles.bottomSelectWrap}>
            <span style={styles.bottomSelectLabel}>Belge Kaynagi</span>
            <select
              style={styles.bottomSelect}
              value={selectedSource}
              onChange={(event) => {
                const nextValue = event.target.value === "ACCESSORY" ? "ACCESSORY" : "FABRIC";
                setSelectedSource(nextValue);
              }}
            >
              <option value="FABRIC">Kumas</option>
              <option value="ACCESSORY">Aksesuar</option>
            </select>
          </label>
          <label style={styles.bottomSelectWrap}>
            <span style={styles.bottomSelectLabel}>Fis Turu</span>
            <select
              style={styles.bottomSelect}
              value={String(selectedVoucherTypeCode)}
              onChange={(event) => {
                const nextCode = Number(event.target.value);
                if (Number.isInteger(nextCode)) {
                  setSelectedVoucherTypeCode(nextCode);
                }
              }}
            >
              {PURCHASE_VOUCHER_TYPES.map((voucherType) => (
                <option key={voucherType.code} value={String(voucherType.code)}>
                  {voucherType.label}
                </option>
              ))}
            </select>
          </label>
          <button style={styles.bottomButton} onClick={() => openDocumentForm(selectedSource, undefined, selectedVoucherType)}>
            Yeni
          </button>
          <button
            style={{ ...styles.bottomButton, ...(selectedRow ? styles.bottomAction : {}) }}
            onClick={openSelectedRow}
            disabled={!selectedRow}
          >
            Seciliyi Ac
          </button>
          <div style={styles.bottomSummary}>
            {selectedRow
              ? `${selectedRow.sourceLabel} | ${selectedRow.belgeNumarasi || "-"} | ${selectedRow.cariHesapAdi || "-"} | ${moneyFormatter.format(selectedRow.fisToplami)}`
              : "Secili kayit yok"}
          </div>
        </div>
      </div>

      {contextMenu.visible ? (
        <div style={{ ...styles.contextMenu, top: contextMenu.y, left: contextMenu.x }} onClick={(event) => event.stopPropagation()}>
          {menuItems.map((item, index) =>
            item.divider ? (
              <div key={`${item.label}-${index}`} style={styles.contextMenuDivider} />
            ) : (
              <button
                key={`${item.label}-${index}`}
                style={{
                  ...styles.contextMenuItem,
                  ...(item.disabled ? styles.contextMenuItemDisabled : {}),
                }}
                disabled={item.disabled}
                onClick={() => {
                  if (item.action) item.action();
                  closeContextMenu();
                }}
              >
                <span>{item.label}</span>
                <span style={styles.contextMenuHint}>{item.hint || ""}</span>
              </button>
            )
          )}
        </div>
      ) : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    height: "100%",
    minHeight: 0,
    padding: "12px",
    background:
      "radial-gradient(circle at 0% 0%, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0) 45%), var(--fs-color-bg)",
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
    border: "1px solid #a7f3d0",
    borderRadius: 999,
    background: "#ecfdf5",
    color: "#047857",
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
  },
  heroStats: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginLeft: "auto",
  },
  heroStatCard: {
    minWidth: 130,
    border: "1px solid var(--fs-color-border)",
    borderRadius: 12,
    background: "var(--fs-color-surface)",
    padding: "7px 10px",
  },
  heroStatLabel: {
    fontSize: 11,
    color: "var(--fs-color-text-muted)",
    marginBottom: 2,
  },
  heroStatValue: {
    fontSize: 13,
    fontWeight: 700,
    color: "#047857",
  },
  error: {
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#b91c1c",
    borderRadius: 10,
    padding: "8px 10px",
    fontSize: 12,
  },
  searchBarWrap: {
    border: "1px solid var(--fs-color-border)",
    borderRadius: 12,
    background: "var(--fs-color-surface)",
    padding: "8px 10px",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  searchLabel: {
    fontSize: 12,
    color: "#047857",
    fontWeight: 700,
    border: "1px solid #a7f3d0",
    borderRadius: 999,
    padding: "4px 8px",
    background: "#ecfdf5",
  },
  searchInput: {
    flex: 1,
    border: "1px solid var(--fs-color-border-strong)",
    background: "var(--fs-color-surface-soft)",
    color: "var(--fs-color-text)",
    borderRadius: 10,
    padding: "8px 10px",
    fontSize: 13,
    outline: "none",
  },
  gridSection: {
    flex: 1,
    border: "1px solid var(--fs-color-border)",
    borderRadius: 14,
    background: "var(--fs-color-surface)",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    overflow: "hidden",
    boxShadow: "0 14px 28px -24px rgba(15, 23, 42, 0.45)",
  },
  listHeader: {
    borderBottom: "1px solid var(--fs-color-border)",
    padding: "10px 12px",
    fontWeight: 700,
    fontSize: 13,
    background: "var(--fs-color-surface)",
    color: "var(--fs-color-text)",
  },
  groupHint: {
    borderBottom: "1px solid var(--fs-color-border)",
    padding: "7px 12px",
    fontSize: 11,
    textAlign: "center",
    color: "var(--fs-color-text-muted)",
    background: "var(--fs-color-surface-soft)",
    letterSpacing: 0.2,
  },
  groupHintActive: {
    background: "#d1fae5",
    color: "#065f46",
  },
  groupChipWrap: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  groupChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    border: "1px solid #6ee7b7",
    borderRadius: 999,
    background: "#ecfdf5",
    color: "#065f46",
    padding: "3px 8px",
    fontWeight: 700,
  },
  groupChipRemove: {
    border: "none",
    background: "transparent",
    color: "#065f46",
    cursor: "pointer",
    fontSize: 12,
    lineHeight: 1,
    padding: 0,
  },
  groupClearButton: {
    border: "1px solid #6ee7b7",
    borderRadius: 8,
    background: "#ffffff",
    color: "#065f46",
    padding: "3px 8px",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  },
  tableViewport: {
    overflow: "auto",
    flex: 1,
    background: "var(--fs-color-surface)",
  },
  table: {
    width: "100%",
    minWidth: 2200,
    borderCollapse: "collapse",
    background: "var(--fs-color-surface)",
    tableLayout: "fixed",
  },
  th: {
    border: "1px solid var(--fs-color-border)",
    padding: "6px 6px",
    fontSize: 12,
    textAlign: "left",
    background: "var(--fs-color-surface-soft)",
    color: "var(--fs-color-text)",
    fontWeight: 700,
    position: "sticky",
    top: 0,
    zIndex: 1,
    userSelect: "none",
    cursor: "grab",
    whiteSpace: "nowrap",
  },
  thDragging: {
    opacity: 0.55,
  },
  resizeHandle: {
    position: "absolute",
    right: -1,
    top: 0,
    bottom: 0,
    width: 9,
    cursor: "col-resize",
    zIndex: 3,
  },
  td: {
    border: "1px solid var(--fs-color-border)",
    padding: "4px 6px",
    fontSize: 12,
    whiteSpace: "nowrap",
    color: "var(--fs-color-text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  indicatorCell: {
    border: "1px solid var(--fs-color-border)",
    width: 20,
    textAlign: "center",
    fontSize: 12,
    color: "#047857",
    fontWeight: 700,
    padding: 0,
  },
  trEven: {
    background: "#ffffff",
  },
  trOdd: {
    background: "var(--fs-color-surface-soft)",
  },
  trSelected: {
    background: "#d1fae5",
  },
  emptyCell: {
    textAlign: "center",
    padding: "16px",
    fontSize: 12,
    border: "1px solid var(--fs-color-border)",
    background: "var(--fs-color-surface-soft)",
    color: "var(--fs-color-text-muted)",
  },
  groupRowCell: {
    border: "1px solid var(--fs-color-border)",
    background: "#f0fdf4",
    color: "#065f46",
    padding: "6px 8px",
    fontSize: 12,
    fontWeight: 700,
  },
  bottomBar: {
    borderTop: "1px solid var(--fs-color-border)",
    background: "var(--fs-color-surface)",
    padding: "9px 10px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  bottomButton: {
    border: "1px solid var(--fs-color-border-strong)",
    background: "var(--fs-color-surface-soft)",
    color: "var(--fs-color-text)",
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 700,
    padding: "6px 11px",
    cursor: "pointer",
  },
  bottomAction: {
    borderColor: "#a7f3d0",
    background: "#ecfdf5",
    color: "#047857",
  },
  bottomSelectWrap: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    border: "1px solid var(--fs-color-border)",
    borderRadius: 10,
    padding: "4px 6px",
    background: "var(--fs-color-surface-soft)",
  },
  bottomSelectLabel: {
    fontSize: 11,
    color: "var(--fs-color-text-muted)",
    fontWeight: 700,
  },
  bottomSelect: {
    border: "1px solid var(--fs-color-border-strong)",
    borderRadius: 8,
    background: "var(--fs-color-surface)",
    color: "var(--fs-color-text)",
    fontSize: 12,
    padding: "4px 6px",
    minWidth: 250,
  },
  bottomSummary: {
    marginLeft: "auto",
    border: "1px solid var(--fs-color-border)",
    background: "var(--fs-color-surface-soft)",
    borderRadius: 10,
    padding: "6px 9px",
    fontSize: 12,
    minWidth: 360,
    textAlign: "right",
    color: "var(--fs-color-text-muted)",
  },
  contextMenu: {
    position: "fixed",
    minWidth: 330,
    border: "1px solid var(--fs-color-border-strong)",
    background: "var(--fs-color-surface)",
    boxShadow: "0 20px 35px -18px rgba(15, 23, 42, 0.45)",
    borderRadius: 12,
    overflow: "hidden",
    zIndex: 90,
  },
  contextMenuItem: {
    width: "100%",
    border: "none",
    borderBottom: "1px solid var(--fs-color-border)",
    background: "var(--fs-color-surface)",
    color: "var(--fs-color-text)",
    fontSize: 13,
    textAlign: "left",
    padding: "8px 10px",
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  contextMenuItemDisabled: {
    color: "var(--fs-color-text-muted)",
    cursor: "not-allowed",
  },
  contextMenuHint: {
    color: "var(--fs-color-text-muted)",
    fontSize: 12,
  },
  contextMenuDivider: {
    borderTop: "1px solid var(--fs-color-border)",
  },
};
