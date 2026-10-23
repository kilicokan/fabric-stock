import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import axios from "axios";
import ExportButtons from "../../components/ExportButtons";
import { useTabs } from "../../components/TabContext";
import CustomerOrderAddPage from "./add";

interface CustomerOrder {
  id: number;
  orderNo: string;
  approved: boolean;
  approvedAt?: string | null;
  items: CustomerOrderItem[];
  materialRequirements: MaterialRequirement[];
  workOrderSummary?: WorkOrderSummary;
  customer: {
    id: number;
    name: string;
    phone?: string;
    email?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface CustomerOrderItem {
  id: number;
  productCode: string;
  color: string;
  description?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  totalPrice: number;
}

interface MaterialRequirement {
  materialName: string;
  unit: string;
  totalQuantity: number;
}

interface WorkOrderSummary {
  totalItems: number;
  createdCount: number;
  pendingAssignmentCount: number;
  converted: boolean;
  workOrders: Array<{
    id: number;
    orderNo: string;
    status: string;
    assignedToMobile: boolean;
  }>;
}

interface GridRow {
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
  raw: CustomerOrder;
}

type ContextMenuState = {
  visible: boolean;
  x: number;
  y: number;
  orderId: number | null;
};

type ContextMenuItem = {
  label: string;
  action?: () => void;
  hint?: string;
  disabled?: boolean;
  divider?: boolean;
};

type ApiErrorShape = { response?: { data?: { message?: string; error?: string } } };

const moneyFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = (rawDate: string): string => {
  if (!rawDate) return "";
  const d = new Date(rawDate);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("tr-TR");
};

const cariCode = (id: number): string => `T.${String(id).padStart(4, "0")}`;

const orderTotal = (order: CustomerOrder): number =>
  order.items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);

const orderQuantity = (order: CustomerOrder): number =>
  order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

const resolveFisType = (order: CustomerOrder): string => {
  const total = orderTotal(order);
  if (total < 0) return "3-Toptan Satis Iade Faturasi";
  if (order.approved) return "120-Toptan Satis Faturasi";
  return "2-Musteri Siparisi";
};

export default function CustomerOrderList() {
  const { addTab } = useTabs();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    orderId: null,
  });
const [infoMessage, setInfoMessage] = useState<string>("");
  const [processingOrderId, setProcessingOrderId] = useState<number | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void loadOrders();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      // Do not close if clicking inside the context menu
      if (contextMenuRef.current && contextMenuRef.current.contains(event.target as Node)) {
        return;
      }
      setContextMenu((prev) =>
        prev.visible
          ? {
              visible: false,
              x: 0,
              y: 0,
              orderId: null,
            }
          : prev
      );
    };

    // Small delay to allow the context menu click event to fire first
    const timer = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  const loadOrders = async (): Promise<void> => {
    try {
      setLoading(true);
      setError("");
      const response = await axios.get<CustomerOrder[]>("/api/customer-orders", {
        params: { scope: "order" },
      });
      setOrders(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError("Siparisler yuklenemedi.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return orders;

    return orders.filter((order) => {
      const inMain =
        order.orderNo.toLowerCase().includes(term) ||
        order.customer.name.toLowerCase().includes(term) ||
        cariCode(order.customer.id).toLowerCase().includes(term);

      const inItems = order.items.some(
        (item) =>
          item.productCode.toLowerCase().includes(term) ||
          item.color.toLowerCase().includes(term) ||
          (item.description || "").toLowerCase().includes(term)
      );

      return inMain || inItems;
    });
  }, [orders, searchTerm]);

  const rows = useMemo<GridRow[]>(
    () =>
      filteredOrders.map((order) => ({
        id: order.id,
        fisTipi: resolveFisType(order),
        fisNumarasi: order.orderNo,
        fisTarihi: dateFormatter(order.createdAt),
        cariHesapKodu: cariCode(order.customer.id),
        cariHesapAdi: (order.customer.name || "").toUpperCase(),
        belgeNumarasi: order.orderNo,
        girisDepoKodu: "MD",
        cikisDepoKodu: "MD",
        toplamMiktar: orderQuantity(order),
        araToplam: orderTotal(order),
        fisToplami: orderTotal(order),
        raw: order,
      })),
    [filteredOrders]
  );

  useEffect(() => {
    if (!rows.length) {
      setSelectedOrderId(null);
      return;
    }
    if (selectedOrderId === null || !rows.some((row) => row.id === selectedOrderId)) {
      setSelectedOrderId(rows[0].id);
    }
  }, [rows, selectedOrderId]);

  const selectedOrder = useMemo(
    () => rows.find((row) => row.id === selectedOrderId) || null,
    [rows, selectedOrderId]
  );
  const contextMenuOrder = useMemo(
    () => orders.find((order) => order.id === contextMenu.orderId) || null,
    [orders, contextMenu.orderId]
  );

  const exportData = useMemo(
    () =>
      rows.map((row) => ({
        "Fis Tipi": row.fisTipi,
        "Fis Numarasi": row.fisNumarasi,
        "Fis Tarihi": row.fisTarihi,
        "Cari Hesap Kodu": row.cariHesapKodu,
        "Cari Hesap Adi": row.cariHesapAdi,
        "Belge Numarasi": row.belgeNumarasi,
        "Giris Depo Kodu": row.girisDepoKodu,
        "Cikis Depo Kodu": row.cikisDepoKodu,
        "Toplam Miktar": moneyFormatter.format(row.toplamMiktar),
        "Ara Toplam": moneyFormatter.format(row.araToplam),
        "Fis Toplami": moneyFormatter.format(row.fisToplami),
      })),
    [rows]
  );

  const deleteSelectedOrder = async (): Promise<void> => {
    if (selectedOrderId === null) {
      return;
    }

    if (!confirm("Secili siparis kaydini silmek istediginize emin misiniz?")) {
      return;
    }

    try {
      await axios.delete("/api/customer-orders", { data: { id: selectedOrderId } });
      setOrders((prev) => prev.filter((order) => order.id !== selectedOrderId));
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err !== null && "response" in err
          ? ((err as { response?: { data?: { message?: string; error?: string } } }).response?.data?.message ||
            (err as { response?: { data?: { message?: string; error?: string } } }).response?.data?.error)
          : "";
      setError(message || "Secili siparis silinemedi.");
    }
  };

  const openOrder = (orderId: number, orderNo: string): void => {
    const tabPath = `/customer-orders/add?id=${orderId}`;
    const tabTitle = `Siparis ${orderNo}`;
    const OrderTabComponent: React.ComponentType = () => (
      <CustomerOrderAddPage initialOrderId={orderId} />
    );

    addTab({
      title: tabTitle,
      path: tabPath,
      component: OrderTabComponent,
      closable: true,
    });
  };

  const openNewOrder = (): void => {
    const OrderTabComponent: React.ComponentType = () => <CustomerOrderAddPage />;
    addTab({
      title: "Yeni Siparis",
      path: "/customer-orders/add",
      component: OrderTabComponent,
      closable: true,
    });
  };

  const closeContextMenu = () => {
    setContextMenu({
      visible: false,
      x: 0,
      y: 0,
      orderId: null,
    });
  };

  const openContextMenu = (event: ReactMouseEvent<HTMLElement>, orderId: number | null = null) => {
    event.preventDefault();
    if (orderId !== null) {
      setSelectedOrderId(orderId);
    }
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      orderId,
    });
  };

  const extractApiErrorMessage = (err: unknown): string => {
    if (typeof err === "object" && err !== null && "response" in err) {
      const casted = err as ApiErrorShape;
      return casted.response?.data?.message || casted.response?.data?.error || "";
    }
    return "";
  };

  const setOrderApproval = async (order: CustomerOrder, approved: boolean): Promise<void> => {
    await axios.patch(`/api/customer-orders/${order.id}/approval`, {
      approved,
    });

    setOrders((prev) =>
      prev.map((item) =>
        item.id === order.id
          ? {
              ...item,
              approved,
              approvedAt: approved ? new Date().toISOString() : null,
            }
          : item
      )
    );
  };

  const createWorkOrdersFromOrder = async (order: CustomerOrder): Promise<void> => {
    const isApproved = Boolean(order.approved);
    if (!isApproved) {
      const continueWithoutApproval = confirm(
        "Bu siparis henuz onayli degil. Yine de is emri olusturulsun mu?"
      );
      if (!continueWithoutApproval) return;
    }

    setProcessingOrderId(order.id);
    try {
      const response = await axios.post(`/api/customer-orders/${order.id}/work-orders`);
      const createdCount = Number(response.data?.createdCount || 0);
      const skippedCount = Number(response.data?.skippedCount || 0);

      const messageParts: string[] = [];
      if (createdCount > 0) {
        messageParts.push(`${createdCount} is emri olusturuldu.`);
      }
      if (skippedCount > 0) {
        messageParts.push(`${skippedCount} satir daha once donusturuldugu icin atlandi.`);
      }
      if (createdCount === 0 && skippedCount === 0) {
        messageParts.push("Is emrine donusturulecek satir bulunamadi.");
      }

      setInfoMessage(messageParts.join(" "));
      await loadOrders();
    } catch (err: unknown) {
      setError(extractApiErrorMessage(err) || "Siparisten is emri olusturulamadi.");
    } finally {
      setProcessingOrderId(null);
    }
  };

  const approveFromContextMenu = async () => {
    if (!contextMenu.orderId) return;

    const targetOrder = orders.find((order) => order.id === contextMenu.orderId);
    if (!targetOrder) {
      closeContextMenu();
      return;
    }

    const nextApprovedValue = !Boolean(targetOrder.approved);

    try {
      await setOrderApproval(targetOrder, nextApprovedValue);
      setInfoMessage(nextApprovedValue ? "Siparis onaylandi." : "Siparis onayi kaldirildi.");
    } catch (err: unknown) {
      setError(extractApiErrorMessage(err) || "Siparis onayi guncellenemedi.");
    } finally {
      closeContextMenu();
    }
  };

  const createWorkOrdersFromContextMenu = async () => {
    if (!contextMenu.orderId) return;

    const targetOrder = orders.find((order) => order.id === contextMenu.orderId);
    if (!targetOrder) {
      closeContextMenu();
      return;
    }
    try {
      await createWorkOrdersFromOrder(targetOrder);
    } finally {
      closeContextMenu();
    }
  };

  const menuItems: ContextMenuItem[] = [
    {
      label: "Degistir",
      action: () => {
        if (!contextMenuOrder) return;
        openOrder(contextMenuOrder.id, contextMenuOrder.orderNo);
      },
      hint: "Shift+F4",
      disabled: !contextMenuOrder,
    },
    { label: "Yeni", action: openNewOrder, hint: "F4" },
    { label: "Siparisten Aktar", hint: "F7", disabled: true },
    { label: "Sil", action: () => void deleteSelectedOrder(), hint: "F6", disabled: !contextMenuOrder },
    { label: "sep-1", divider: true },
    { label: "Kopyalama", hint: "F8", disabled: true },
    { label: "Fatura Odeme Islemleri", disabled: true, hint: ">" },
    {
      label: "Onay Durumu Degistir",
      action: () => void approveFromContextMenu(),
      hint: "Ctrl+O",
      disabled: !contextMenuOrder,
    },
    {
      label: processingOrderId === contextMenu.orderId ? "Is Emri Olusturuluyor..." : "Is Emri Olustur",
      action: () => void createWorkOrdersFromContextMenu(),
      hint: "Ctrl+W",
      disabled: !contextMenuOrder || processingOrderId === contextMenu.orderId,
    },
    { label: "Isaret", disabled: true, hint: ">" },
    { label: "Toplu e-Fatura / e-Arsiv Islemleri", disabled: true, hint: ">" },
    { label: "e-Fatura Goruntule", disabled: true },
    { label: "Kayit Kilitle / Ac", disabled: true },
    { label: "sep-2", divider: true },
    {
      label: "Siparis Formu",
      action: () => {
        if (!contextMenuOrder) return;
        openOrder(contextMenuOrder.id, contextMenuOrder.orderNo);
      },
      hint: "F10",
      disabled: !contextMenuOrder,
    },
    { label: "Toplu Fatura Form Dokumu", disabled: true },
    { label: "Malzeme Karti Formu", disabled: true },
    { label: "Liste", hint: "F9", disabled: true },
    { label: "Kayit Bilgisi", disabled: true },
    { label: "Yenile", action: () => void loadOrders(), hint: "F5" },
    { label: "Yazdir", action: () => window.print(), hint: "Ctrl+P" },
    { label: "sep-3", divider: true },
    { label: "Calisma Listesi Duzenle", disabled: true },
    { label: "Calisma Listesi Tanimlari", disabled: true },
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
      {error && <div style={styles.error}>{error}</div>}
      {infoMessage && <div style={styles.info}>{infoMessage}</div>}

      <div style={styles.listHeader}>Satis Siparisleri Listesi</div>

      <div style={styles.searchBarWrap}>
        <div style={styles.searchInputWrap}>
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            style={styles.searchInput}
            placeholder="Arama"
          />
          <span style={styles.searchIcon}>⌕</span>
        </div>
      </div>

      <div style={styles.content}>
        <div style={styles.filterRail}>Filtre</div>

        <div style={styles.gridSection}>
          <div
            style={styles.tableViewport}
            onContextMenu={(event) => openContextMenu(event, selectedOrderId)}
          >
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: 20 }} />
                  <th style={{ ...styles.th, width: 190 }}>Fis Tipi</th>
                  <th style={{ ...styles.th, width: 130 }}>Fis Numarasi</th>
                  <th style={{ ...styles.th, width: 120 }}>Fis Tarihi</th>
                  <th style={{ ...styles.th, width: 140 }}>Cari Hesap Kodu</th>
                  <th style={{ ...styles.th, minWidth: 420 }}>Cari Hesap Adi</th>
                  <th style={{ ...styles.th, width: 140 }}>Belge Numarasi</th>
                  <th style={{ ...styles.th, width: 120 }}>Giris Depo Kodu</th>
                  <th style={{ ...styles.th, width: 120 }}>Cikis Depo Kodu</th>
                  <th style={{ ...styles.th, width: 140, textAlign: "right" }}>Toplam Miktar</th>
                  <th style={{ ...styles.th, width: 140, textAlign: "right" }}>Ara Toplam</th>
                  <th style={{ ...styles.th, width: 140, textAlign: "right" }}>Fis Toplami</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td style={styles.emptyCell} colSpan={12}>
                      Yukleniyor...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td style={styles.emptyCell} colSpan={12}>
                      {searchTerm ? "Arama kriterine uygun siparis bulunamadi." : "Henuz siparis kaydi yok."}
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => {
                    const isSelected = selectedOrderId === row.id;
                    const rowStyle = isSelected ? styles.trSelected : index % 2 === 0 ? styles.trEven : styles.trOdd;

                    return (
                      <tr
                        key={row.id}
                        style={{ ...rowStyle, cursor: "pointer" }}
                        onContextMenu={(event) => {
                          event.stopPropagation();
                          openContextMenu(event, row.id);
                        }}
                        onClick={() => {
                          setSelectedOrderId(row.id);
                          openOrder(row.id, row.fisNumarasi);
                        }}
                        title="Sol tik: siparisi ac | Sag tik: onay ve is emri islemleri"
                      >
                        <td style={styles.indicatorCell}>{isSelected ? "▸" : ""}</td>
                        <td style={styles.td}>{row.fisTipi}</td>
                        <td style={styles.td}>{row.fisNumarasi}</td>
                        <td style={styles.td}>{row.fisTarihi}</td>
                        <td style={styles.td}>{row.cariHesapKodu}</td>
                        <td style={styles.td}>{row.cariHesapAdi}</td>
                        <td style={styles.td}>{row.belgeNumarasi}</td>
                        <td style={styles.td}>{row.girisDepoKodu}</td>
                        <td style={styles.td}>{row.cikisDepoKodu}</td>
                        <td style={{ ...styles.td, textAlign: "right" }}>{moneyFormatter.format(row.toplamMiktar)}</td>
                        <td style={{ ...styles.td, textAlign: "right" }}>{moneyFormatter.format(row.araToplam)}</td>
                        <td style={{ ...styles.td, textAlign: "right" }}>{moneyFormatter.format(row.fisToplami)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={styles.bottomBar}>
            <div style={styles.bottomTitle}>Calisma Listesi Duzenle</div>
            <div style={styles.bottomControls}>
              <select style={styles.bottomSelect} defaultValue="Standart">
                <option value="Standart">Standart</option>
                <option value="Finans">Finans</option>
                <option value="Sevkiyat">Sevkiyat</option>
              </select>

              <button style={styles.bottomButton} onClick={() => void loadOrders()}>
                Yenile
              </button>

              <button
                style={{ ...styles.bottomButton, ...(selectedOrder ? styles.bottomDelete : {}) }}
                onClick={() => void deleteSelectedOrder()}
                disabled={!selectedOrder}
                title={!selectedOrder ? "Silmek icin satir seciniz" : "Secili siparisi sil"}
              >
                Seciliyi Sil
              </button>

              <div style={styles.exportWrap} className="fs-export-wrap">
                <ExportButtons data={exportData} filename="Musteri_Siparis_Listesi" />
              </div>
            </div>

            <div style={styles.bottomSummary}>
              {selectedOrder
                ? `${selectedOrder.fisNumarasi} | ${selectedOrder.cariHesapAdi} | Miktar: ${moneyFormatter.format(
                    selectedOrder.toplamMiktar
                  )} | Toplam: ${moneyFormatter.format(selectedOrder.fisToplami)}`
                : "Secili kayit yok"}
            </div>
          </div>
        </div>
</div>

      {contextMenu.visible && (
        <div
          ref={contextMenuRef}
          style={{
            ...styles.contextMenu,
            top: contextMenu.y,
            left: contextMenu.x,
          }}
          onClick={(event) => event.stopPropagation()}
        >
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
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    height: "100%",
    minHeight: 0,
    padding: "12px",
    background: "var(--fs-color-bg)",
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
    color: "var(--fs-color-text)",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
  },
  error: {
    border: "1px solid #fecaca",
    borderRadius: 10,
    background: "#fef2f2",
    color: "#b91c1c",
    padding: "10px 12px",
    margin: "0 0 10px",
    fontSize: "12px",
  },
  info: {
    border: "1px solid #bfdbfe",
    borderRadius: 10,
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "10px 12px",
    margin: "0 0 10px",
    fontSize: "12px",
  },
  listHeader: {
    border: "1px solid var(--fs-color-border)",
    borderRadius: 10,
    background: "var(--fs-color-surface)",
    color: "var(--fs-color-primary-strong)",
    fontSize: "13px",
    fontWeight: 700,
    padding: "8px 10px",
    marginBottom: "8px",
  },
  searchBarWrap: {
    border: "1px solid var(--fs-color-border)",
    borderRadius: 12,
    background: "var(--fs-color-surface)",
    padding: "10px 12px",
    marginBottom: "10px",
  },
  searchInputWrap: {
    position: "relative",
  },
  searchInput: {
    width: "100%",
    border: "1px solid var(--fs-color-border-strong)",
    borderRadius: 10,
    background: "var(--fs-color-surface-soft)",
    color: "var(--fs-color-text)",
    padding: "9px 34px 9px 10px",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  searchIcon: {
    position: "absolute",
    right: "10px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "var(--fs-color-text-muted)",
    fontSize: "16px",
  },
  content: {
    display: "flex",
    gap: "8px",
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  filterRail: {
    width: "36px",
    border: "1px solid var(--fs-color-border)",
    borderRadius: 12,
    background: "var(--fs-color-surface)",
    color: "var(--fs-color-primary-strong)",
    fontSize: "18px",
    letterSpacing: "1px",
    writingMode: "vertical-rl",
    transform: "rotate(180deg)",
    textAlign: "center",
    padding: "10px 0",
    userSelect: "none",
    fontWeight: 700,
  },
  gridSection: {
    flex: 1,
    border: "1px solid var(--fs-color-border)",
    borderRadius: 12,
    background: "var(--fs-color-surface)",
    display: "flex",
    flexDirection: "column",
    minWidth: "0",
    overflow: "hidden",
  },
  tableViewport: {
    overflow: "auto",
    flex: 1,
    background: "var(--fs-color-surface)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "1700px",
  },
  th: {
    border: "1px solid var(--fs-color-border)",
    background: "var(--fs-color-surface-soft)",
    color: "var(--fs-color-text)",
    fontWeight: 700,
    fontSize: "12px",
    padding: "7px 8px",
    textAlign: "left",
    position: "sticky",
    top: 0,
    zIndex: 1,
  },
  td: {
    border: "1px solid var(--fs-color-border)",
    padding: "6px 8px",
    fontSize: "12px",
    color: "var(--fs-color-text)",
    whiteSpace: "nowrap",
  },
  indicatorCell: {
    border: "1px solid var(--fs-color-border)",
    width: "20px",
    textAlign: "center",
    fontSize: "12px",
    color: "var(--fs-color-primary-strong)",
    padding: "0",
    whiteSpace: "nowrap",
    fontWeight: 700,
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
  approvedBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: "11px",
    fontWeight: 700,
    background: "#dcfce7",
    color: "#166534",
  },
  pendingBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: "11px",
    fontWeight: 700,
    background: "#fee2e2",
    color: "#b91c1c",
  },
  emptyCell: {
    border: "1px solid var(--fs-color-border)",
    textAlign: "center",
    padding: "20px",
    fontSize: "13px",
    color: "var(--fs-color-text-muted)",
    background: "var(--fs-color-surface-soft)",
  },
  bottomBar: {
    borderTop: "1px solid var(--fs-color-border)",
    background: "var(--fs-color-surface)",
    padding: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  bottomTitle: {
    fontSize: "12px",
    color: "var(--fs-color-text-muted)",
    fontWeight: 600,
  },
  bottomControls: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  bottomSelect: {
    minWidth: "180px",
    minHeight: "36px",
    border: "1px solid var(--fs-color-border-strong)",
    borderRadius: 10,
    background: "var(--fs-color-surface-soft)",
    color: "var(--fs-color-text)",
    padding: "6px 10px",
    fontSize: "12px",
  },
  bottomButton: {
    border: "1px solid #93c5fd",
    borderRadius: 10,
    background: "#eff6ff",
    color: "var(--fs-color-primary-strong)",
    minHeight: "36px",
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
  },
  bottomDelete: {
    borderColor: "#fecaca",
    color: "#b91c1c",
    background: "#fee2e2",
  },
  exportWrap: {
    marginLeft: "auto",
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
    textAlign: "left",
    padding: "8px 10px",
    fontSize: "13px",
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
    fontSize: "12px",
  },
  contextMenuDivider: {
    borderTop: "1px solid var(--fs-color-border)",
  },
  rowActions: {
    display: "flex",
    gap: "6px",
    alignItems: "center",
  },
  inlineActionButton: {
    border: "1px solid transparent",
    borderRadius: 8,
    padding: "5px 9px",
    fontSize: "11px",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  inlinePrimaryButton: {
    borderColor: "#93c5fd",
    background: "#eff6ff",
    color: "#1d4ed8",
  },
  inlineSuccessButton: {
    borderColor: "#86efac",
    background: "#f0fdf4",
    color: "#166534",
  },
  inlineDangerButton: {
    borderColor: "#fecaca",
    background: "#fee2e2",
    color: "#b91c1c",
  },
  inlineMutedButton: {
    borderColor: "#d1d5db",
    background: "#f3f4f6",
    color: "#6b7280",
    cursor: "not-allowed",
  },
  bottomSummary: {
    border: "1px solid var(--fs-color-border)",
    borderRadius: 10,
    background: "var(--fs-color-surface-soft)",
    padding: "8px 10px",
    fontSize: "12px",
    color: "var(--fs-color-text-muted)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
};

