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
import SalesDocumentFormPage from "../../pages/sales/document-form";

type DocumentType = "INVOICE" | "DISPATCH";

type CustomerOrderItem = {
  id: number;
  quantity: number;
  totalPrice: number;
};

type CustomerOrder = {
  id: number;
  orderNo: string;
  documentType?: DocumentType;
  documentDate?: string | null;
  documentNo?: string | null;
  dispatchDate?: string | null;
  dispatchNo?: string | null;
  inWarehouseCode?: string | null;
  outWarehouseCode?: string | null;
  approved?: boolean;
  customer: {
    id: number;
    name: string;
  };
  items: CustomerOrderItem[];
  createdAt: string;
};

type ContextMenuState = {
  visible: boolean;
  x: number;
  y: number;
  orderId: number | null;
};

type Props = {
  documentType: DocumentType;
  title: string;
};

type SalesGridRow = {
  id: number;
  fisTipi: string;
  fisNumarasi: string;
  fisTarihi: string;
  cariHesapKodu: string;
  cariHesapAdi: string;
  belgeNumarasi: string;
  girisDepoKodu: string;
  cikisDepoKodu: string;
  toplamMiktar: number;
  araToplam: number;
  fisToplami: number;
};

type SalesColumnId =
  | "fisTipi"
  | "fisNumarasi"
  | "fisTarihi"
  | "cariHesapKodu"
  | "cariHesapAdi"
  | "belgeNumarasi"
  | "girisDepoKodu"
  | "cikisDepoKodu"
  | "toplamMiktar"
  | "araToplam"
  | "fisToplami";

type SalesColumn = {
  id: SalesColumnId;
  label: string;
  width: number;
  minWidth: number;
  textAlign?: "left" | "right";
};

type GroupedSalesRow =
  | {
      kind: "group";
      key: string;
      level: number;
      columnId: SalesColumnId;
      value: string;
      count: number;
    }
  | {
      kind: "row";
      row: SalesGridRow;
    };

type ContextMenuItem = {
  label: string;
  action?: () => void;
  hint?: string;
  disabled?: boolean;
  divider?: boolean;
};

type VoucherMode = "B" | "R";

type InvoiceVoucherType = {
  code: number;
  label: string;
  voucherMode: VoucherMode;
};

const SALES_INVOICE_VOUCHER_TYPES: InvoiceVoucherType[] = [
  { code: 2, label: "2-Perakende Satis Iade Faturasi", voucherMode: "R" },
  { code: 3, label: "3-Toptan Satis Iade Faturasi", voucherMode: "R" },
  { code: 4, label: "4-Konsinye Cikis Iade Faturasi", voucherMode: "R" },
  { code: 8, label: "8-Konsinye Satis Iadesi", voucherMode: "R" },
  { code: 12, label: "12-Fason (Alinan) Cikis Iade Faturasi", voucherMode: "R" },
  { code: 23, label: "23-Verilen Hizmet Iadesi", voucherMode: "R" },
  { code: 120, label: "120-Toptan Satis Faturasi", voucherMode: "B" },
  { code: 121, label: "121-Perakende Satis Faturasi", voucherMode: "B" },
  { code: 125, label: "125-Fasona Cikis Faturasi", voucherMode: "B" },
  { code: 126, label: "126-Verilen Fiyat Farki Faturasi", voucherMode: "B" },
  { code: 127, label: "127-Konsinye Satis Faturasi (Depo Takibi)", voucherMode: "B" },
  { code: 128, label: "128-Konsinye Satis Faturasi", voucherMode: "B" },
  { code: 134, label: "134-Fason (Alinan) Cikis Faturasi", voucherMode: "B" },
  { code: 138, label: "138-Verilen Hizmet Faturasi", voucherMode: "B" },
  { code: 191, label: "191-Verilen Proforma Fatura", voucherMode: "B" },
  { code: 192, label: "192-Verilen Serbest Meslek Makbuzu", voucherMode: "B" },
  { code: 193, label: "193-Verilen Kur Farki Faturasi", voucherMode: "B" },
  { code: 194, label: "194-Verilen Vade Farki Faturasi", voucherMode: "B" },
];

const DEFAULT_SALES_INVOICE_VOUCHER_CODE =
  SALES_INVOICE_VOUCHER_TYPES.find((voucherType) => voucherType.code === 120)?.code ??
  SALES_INVOICE_VOUCHER_TYPES[0]?.code ??
  1;

const moneyFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const SALES_COLUMNS: SalesColumn[] = [
  { id: "fisTipi", label: "Fis Tipi", width: 170, minWidth: 130 },
  { id: "fisNumarasi", label: "Fis Numarasi", width: 130, minWidth: 100 },
  { id: "fisTarihi", label: "Fis Tarihi", width: 120, minWidth: 100 },
  { id: "cariHesapKodu", label: "Cari Hesap Kodu", width: 140, minWidth: 120 },
  { id: "cariHesapAdi", label: "Cari Hesap Adi", width: 420, minWidth: 220 },
  { id: "belgeNumarasi", label: "Belge Numarasi", width: 140, minWidth: 120 },
  { id: "girisDepoKodu", label: "Giris Depo Kodu", width: 120, minWidth: 100 },
  { id: "cikisDepoKodu", label: "Cikis Depo Kodu", width: 120, minWidth: 100 },
  { id: "toplamMiktar", label: "Toplam Miktar", width: 140, minWidth: 110, textAlign: "right" },
  { id: "araToplam", label: "Ara Toplam", width: 140, minWidth: 110, textAlign: "right" },
  { id: "fisToplami", label: "Fis Toplami", width: 140, minWidth: 110, textAlign: "right" },
];

const GROUP_HINT_TEXT = "Gruplamak icin kolon surukleyip birakin";

const dateFormatter = (rawDate?: string | null): string => {
  if (!rawDate) return "";
  const date = new Date(rawDate);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("tr-TR");
};

const cariCode = (id: number): string => `T.${String(id).padStart(4, "0")}`;

const orderTotal = (order: CustomerOrder): number =>
  order.items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);

const orderQuantity = (order: CustomerOrder): number =>
  order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

const resolveFisType = (order: CustomerOrder, type: DocumentType): string => {
  if (type === "DISPATCH") {
    return "3-Toptan Satis Irsaliyesi";
  }
  return order.approved ? "120-Toptan Satis Faturasi" : "3-Toptan Satis Iade Faturasi";
};

const getSalesColumnValue = (row: SalesGridRow, columnId: SalesColumnId): string | number => {
  switch (columnId) {
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
    case "toplamMiktar":
      return row.toplamMiktar;
    case "araToplam":
      return row.araToplam;
    case "fisToplami":
      return row.fisToplami;
    default:
      return "";
  }
};

const getSalesColumnLabel = (columnId: SalesColumnId): string =>
  SALES_COLUMNS.find((column) => column.id === columnId)?.label || columnId;

export default function SalesDocumentList({ documentType, title }: Props) {
  const { addTab } = useTabs();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedVoucherTypeCode, setSelectedVoucherTypeCode] = useState<number>(DEFAULT_SALES_INVOICE_VOUCHER_CODE);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    orderId: null,
  });
  const [columnWidths, setColumnWidths] = useState<Record<SalesColumnId, number>>(() => {
    const initial = {} as Record<SalesColumnId, number>;
    SALES_COLUMNS.forEach((column) => {
      initial[column.id] = column.width;
    });
    return initial;
  });
  const [groupByColumns, setGroupByColumns] = useState<SalesColumnId[]>([]);
  const [draggingColumnId, setDraggingColumnId] = useState<SalesColumnId | null>(null);
  const [isGroupDropActive, setIsGroupDropActive] = useState(false);
  const resizingStateRef = useRef<{ columnId: SalesColumnId; startX: number; startWidth: number } | null>(null);
  const selectedVoucherType = useMemo(
    () =>
      SALES_INVOICE_VOUCHER_TYPES.find((voucherType) => voucherType.code === selectedVoucherTypeCode) ||
      SALES_INVOICE_VOUCHER_TYPES[0],
    [selectedVoucherTypeCode]
  );

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, orderId: null });
  };

  const openContextMenu = (event: ReactMouseEvent<HTMLElement>, orderId: number | null = null) => {
    event.preventDefault();
    if (orderId) {
      setSelectedOrderId(orderId);
    }
    setContextMenu({ visible: true, x: event.clientX, y: event.clientY, orderId });
  };

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await axios.get<CustomerOrder[]>("/api/customer-orders", {
        params: { documentType },
      });
      setOrders(Array.isArray(response.data) ? response.data : []);
    } catch {
      setError("Belgeler yuklenemedi.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [documentType]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const onClick = () => closeContextMenu();
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((order) => {
      const fisNo = (order.orderNo || "").toLowerCase();
      const belgeNo = (order.documentNo || order.dispatchNo || "").toLowerCase();
      const cari = (order.customer?.name || "").toLowerCase();
      const cariKod = cariCode(order.customer?.id || 0).toLowerCase();
      return fisNo.includes(term) || belgeNo.includes(term) || cari.includes(term) || cariKod.includes(term);
    });
  }, [orders, searchTerm]);

  const rows = useMemo<SalesGridRow[]>(
    () =>
      filteredOrders.map((order) => ({
        id: order.id,
        fisTipi: resolveFisType(order, documentType),
        fisNumarasi: order.orderNo || "",
        fisTarihi: dateFormatter(order.documentDate || order.createdAt),
        cariHesapKodu: cariCode(order.customer?.id || 0),
        cariHesapAdi: String(order.customer?.name || "").toUpperCase(),
        belgeNumarasi: order.documentNo || order.dispatchNo || order.orderNo || "",
        girisDepoKodu: order.inWarehouseCode || "MD",
        cikisDepoKodu: order.outWarehouseCode || "MD",
        toplamMiktar: orderQuantity(order),
        araToplam: orderTotal(order),
        fisToplami: orderTotal(order),
      })),
    [filteredOrders, documentType]
  );

  const startColumnResize = (columnId: SalesColumnId, event: ReactMouseEvent<HTMLElement>) => {
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
      const columnMeta = SALES_COLUMNS.find((column) => column.id === state.columnId);
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

  const handleHeaderDragStart = (columnId: SalesColumnId, event: ReactDragEvent<HTMLElement>) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", columnId);
    setDraggingColumnId(columnId);
  };

  const handleHeaderDragEnd = () => {
    setDraggingColumnId(null);
    setIsGroupDropActive(false);
  };

  const addGroupColumn = (columnId: SalesColumnId) => {
    setGroupByColumns((prev) => (prev.includes(columnId) ? prev : [...prev, columnId]));
  };

  const removeGroupColumn = (columnId: SalesColumnId) => {
    setGroupByColumns((prev) => prev.filter((value) => value !== columnId));
  };

  const groupedRows = useMemo<GroupedSalesRow[]>(() => {
    if (!groupByColumns.length) {
      return rows.map((row) => ({ kind: "row", row }));
    }

    const groupRecursive = (sourceRows: SalesGridRow[], level: number, keyPath: string): GroupedSalesRow[] => {
      if (level >= groupByColumns.length) {
        return sourceRows.map((row) => ({ kind: "row", row }));
      }

      const columnId = groupByColumns[level];
      const grouped = new Map<string, SalesGridRow[]>();

      sourceRows.forEach((row) => {
        const rawValue = getSalesColumnValue(row, columnId);
        const value = String(rawValue || "").trim() || "(Bos)";
        const bucket = grouped.get(value);
        if (bucket) {
          bucket.push(row);
        } else {
          grouped.set(value, [row]);
        }
      });

      const output: GroupedSalesRow[] = [];
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

    return groupRecursive(rows, 0, "");
  }, [groupByColumns, rows]);

  const tableColumnCount = SALES_COLUMNS.length + 1;
  const tableMinWidth = useMemo(
    () =>
      20 +
      SALES_COLUMNS.reduce((sum, column) => {
        return sum + (columnWidths[column.id] ?? column.width);
      }, 0),
    [columnWidths]
  );

  useEffect(() => {
    if (!rows.length) {
      setSelectedOrderId(null);
      return;
    }
    if (!selectedOrderId || !rows.some((row) => row.id === selectedOrderId)) {
      setSelectedOrderId(rows[0].id);
    }
  }, [rows, selectedOrderId]);

  const selectedRow = rows.find((item) => item.id === selectedOrderId) || null;
  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.quantity += row.toplamMiktar;
          acc.amount += row.fisToplami;
          return acc;
        },
        { quantity: 0, amount: 0 }
      ),
    [rows]
  );

  const openForm = (id?: number, requestedVoucherType?: InvoiceVoucherType, fromOrderId?: number) => {
    const resolvedVoucherType =
      documentType === "INVOICE" && !id ? requestedVoucherType || selectedVoucherType : undefined;
    const voucherMode = resolvedVoucherType?.voucherMode;
    const voucherTypeCode = resolvedVoucherType?.code;
    const voucherTypeLabel = resolvedVoucherType?.label;
    let tabPath = id
      ? `/sales/document-form?type=${documentType}&id=${id}`
      : `/sales/document-form?type=${documentType}`;
    if (!id && documentType === "INVOICE" && resolvedVoucherType) {
      tabPath += `&voucherMode=${voucherMode}&voucherTypeCode=${voucherTypeCode}&voucherTypeLabel=${encodeURIComponent(voucherTypeLabel)}`;
    }
    if (!id && fromOrderId && Number.isInteger(fromOrderId) && fromOrderId > 0) {
      tabPath += `&fromOrderId=${fromOrderId}`;
    }
    const tabTitle = id
      ? `${documentType === "INVOICE" ? "Fatura" : "Irsaliye"} ${id}`
      : `${documentType === "INVOICE" ? "Yeni Fatura" : "Yeni Irsaliye"}${voucherMode ? ` (${voucherMode})` : ""}`;
    const FormTab: ComponentType = () => (
      <SalesDocumentFormPage
        initialOrderId={id}
        initialFromOrderId={fromOrderId}
        initialDocumentType={documentType}
        initialVoucherMode={voucherMode}
        initialVoucherTypeCode={voucherTypeCode}
        initialVoucherTypeLabel={voucherTypeLabel}
      />
    );
    addTab({
      title: tabTitle,
      path: tabPath,
      component: FormTab,
      closable: true,
    });
  };

  const importFromOrder = async () => {
    try {
      const response = await axios.get<CustomerOrder[]>("/api/customer-orders", {
        params: { scope: "order" },
      });
      const sourceOrders = Array.isArray(response.data) ? response.data : [];
      if (!sourceOrders.length) {
        setError("Aktarilacak siparis bulunamadi.");
        return;
      }

      const quickList = sourceOrders
        .slice(0, 20)
        .map((order) => `${order.id} - ${order.orderNo} - ${order.customer?.name || "-"}`)
        .join("\n");
      const promptText = `Aktarilacak siparis ID'sini girin:\n${quickList}`;
      const rawInput = window.prompt(promptText, String(sourceOrders[0].id)) || "";
      const trimmedInput = rawInput.trim();
      if (!trimmedInput) return;

      const numericId = Number(trimmedInput);
      const matchedOrder = Number.isInteger(numericId) && numericId > 0
        ? sourceOrders.find((order) => order.id === numericId)
        : sourceOrders.find((order) => String(order.orderNo || "").trim() === trimmedInput);

      if (!matchedOrder) {
        setError("Girilen siparis listede bulunamadi.");
        return;
      }

      openForm(undefined, documentType === "INVOICE" ? selectedVoucherType : undefined, matchedOrder.id);
    } catch {
      setError("Siparisler yuklenemedi. Aktarma baslatilamadi.");
    }
  };

  const deleteSelected = async () => {
    if (!selectedOrderId) return;
    if (!window.confirm("Secili belge silinsin mi?")) return;
    try {
      await axios.delete("/api/customer-orders", { data: { id: selectedOrderId } });
      await loadOrders();
    } catch {
      setError("Belge silinemedi.");
    }
  };

  const menuItems: ContextMenuItem[] = [
    { label: "Degistir", action: () => selectedOrderId && openForm(selectedOrderId), hint: "Shift+F4" },
    {
      label: "Yeni",
      action: () => openForm(undefined, documentType === "INVOICE" ? selectedVoucherType : undefined),
      hint: "F4",
    },
    { label: "Siparisten Aktar", action: () => void importFromOrder(), hint: "F7" },
    { label: "Sil", action: () => void deleteSelected(), hint: "F6" },
    { label: "sep-1", divider: true },
    { label: "Kopyalama", hint: "F8", disabled: true },
    { label: "Fatura Odeme Islemleri", disabled: true, hint: ">" },
    { label: "Onay Durumu Degistir", disabled: true, hint: "Ctrl+O" },
    { label: "Isaret", disabled: true, hint: ">" },
    { label: "Toplu e-Fatura / e-Arsiv Islemleri", disabled: true, hint: ">" },
    { label: "e-Fatura Goruntule", disabled: true },
    { label: "Kayit Kilitle / Ac", disabled: true },
    { label: "sep-2", divider: true },
    { label: "Fatura Formu", action: () => selectedOrderId && openForm(selectedOrderId), hint: "F10" },
    { label: "Toplu Fatura Form Dokumu", disabled: true },
    { label: "Malzeme Karti Formu", disabled: true },
    { label: "Liste", hint: "F9" },
    { label: "Kayit Bilgisi", disabled: true },
    { label: "Yenile", action: () => void loadOrders(), hint: "F5" },
    { label: "sep-3", divider: true },
    { label: "Calisma Listesi Duzenle", disabled: true },
    { label: "Calisma Listesi Tanimlari", disabled: true },
    { label: "Yazdir", action: () => window.print(), hint: "Ctrl+P" },
    { label: "Arama Secenekleri", disabled: true, hint: ">" },
    { label: "Toplam Satiri Goster", disabled: true },
    { label: "Ondeger", disabled: true },
    { label: "Yakinlastir", disabled: true, hint: ">" },
    { label: "Liste / Kart Gorunumu", disabled: true },
    { label: "Uzak Noktalara Gonder", disabled: true },
    { label: "sep-4", divider: true },
    { label: "Kapat", action: closeContextMenu, hint: "Escape" },
  ];

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div>
          <div style={styles.heroTag}>MiraApp Satis Modulu</div>
          <div style={styles.heroTitle}>{title}</div>
          <div style={styles.heroSub}>
            Olusturulan belgeler, cari hesap ve depo alanlari ile birlikte listelenir.
          </div>
        </div>
        <div style={styles.heroStats}>
          <div style={styles.heroStatCard}>
            <div style={styles.heroStatLabel}>Belge</div>
            <div style={styles.heroStatValue}>{rows.length}</div>
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
            const droppedColumnId = event.dataTransfer.getData("text/plain") as SalesColumnId;
            if (SALES_COLUMNS.some((column) => column.id === droppedColumnId)) {
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
                  {getSalesColumnLabel(columnId)}
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
                {SALES_COLUMNS.map((column) => (
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
                              {getSalesColumnLabel(item.columnId)}: {item.value} ({item.count})
                            </span>
                          </td>
                        </tr>
                      );
                    }

                    dataRowIndex += 1;
                    const row = item.row;
                    const isSelected = selectedOrderId === row.id;
                    return (
                      <tr
                        key={row.id}
                        style={isSelected ? styles.trSelected : dataRowIndex % 2 === 0 ? styles.trEven : styles.trOdd}
                        onClick={() => setSelectedOrderId(row.id)}
                        onDoubleClick={() => openForm(row.id)}
                        onContextMenu={(event) => openContextMenu(event, row.id)}
                      >
                        <td style={styles.indicatorCell}>{isSelected ? ">" : ""}</td>
                        <td style={{ ...styles.td, width: columnWidths.fisTipi }}>{row.fisTipi}</td>
                        <td style={{ ...styles.td, width: columnWidths.fisNumarasi }}>{row.fisNumarasi}</td>
                        <td style={{ ...styles.td, width: columnWidths.fisTarihi }}>{row.fisTarihi}</td>
                        <td style={{ ...styles.td, width: columnWidths.cariHesapKodu }}>{row.cariHesapKodu}</td>
                        <td style={{ ...styles.td, width: columnWidths.cariHesapAdi }}>{row.cariHesapAdi}</td>
                        <td style={{ ...styles.td, width: columnWidths.belgeNumarasi }}>{row.belgeNumarasi}</td>
                        <td style={{ ...styles.td, width: columnWidths.girisDepoKodu }}>{row.girisDepoKodu}</td>
                        <td style={{ ...styles.td, width: columnWidths.cikisDepoKodu }}>{row.cikisDepoKodu}</td>
                        <td style={{ ...styles.td, width: columnWidths.toplamMiktar, textAlign: "right" }}>
                          {moneyFormatter.format(row.toplamMiktar)}
                        </td>
                        <td style={{ ...styles.td, width: columnWidths.araToplam, textAlign: "right" }}>
                          {moneyFormatter.format(row.araToplam)}
                        </td>
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
          <button style={styles.bottomButton} onClick={() => void loadOrders()}>
            Yenile
          </button>
          {documentType === "INVOICE" ? (
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
                {SALES_INVOICE_VOUCHER_TYPES.map((voucherType) => (
                  <option key={voucherType.code} value={String(voucherType.code)}>
                    {voucherType.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            style={styles.bottomButton}
            onClick={() => openForm(undefined, documentType === "INVOICE" ? selectedVoucherType : undefined)}
          >
            Yeni
          </button>
          <button style={{ ...styles.bottomButton, ...(selectedOrderId ? styles.bottomDelete : {}) }} onClick={() => void deleteSelected()} disabled={!selectedOrderId}>
            Seciliyi Sil
          </button>
          <div style={styles.bottomSummary}>
            {selectedRow
              ? `${selectedRow.fisNumarasi} | ${selectedRow.cariHesapAdi} | ${moneyFormatter.format(selectedRow.fisToplami)}`
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
      "radial-gradient(circle at 0% 0%, rgba(37,99,235,0.12) 0%, rgba(37,99,235,0) 45%), var(--fs-color-bg)",
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
    border: "1px solid #bfdbfe",
    borderRadius: 999,
    background: "#eff6ff",
    color: "var(--fs-color-primary-strong)",
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
    color: "var(--fs-color-primary-strong)",
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
    color: "var(--fs-color-primary-strong)",
    fontWeight: 700,
    border: "1px solid #bfdbfe",
    borderRadius: 999,
    padding: "4px 8px",
    background: "#eff6ff",
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
    background: "#dbeafe",
    color: "#1d4ed8",
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
    border: "1px solid #93c5fd",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "3px 8px",
    fontWeight: 700,
  },
  groupChipRemove: {
    border: "none",
    background: "transparent",
    color: "#1d4ed8",
    cursor: "pointer",
    fontSize: 12,
    lineHeight: 1,
    padding: 0,
  },
  groupClearButton: {
    border: "1px solid #93c5fd",
    borderRadius: 8,
    background: "#ffffff",
    color: "#1d4ed8",
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
    minWidth: 1650,
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
    color: "var(--fs-color-primary-strong)",
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
    background: "var(--fs-color-primary-soft)",
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
    background: "#eff6ff",
    color: "#1d4ed8",
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
    minWidth: 290,
  },
  bottomDelete: {
    borderColor: "#fecaca",
    background: "#fef2f2",
    color: "#b91c1c",
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
