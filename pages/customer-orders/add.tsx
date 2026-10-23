import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Combobox } from "@/components/ui/combobox";
import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/router";

type TabKey = "genel" | "detay" | "aciklama" | "toplamlar" | "ekler";
type SizeKey = "XS" | "S" | "M" | "L" | "XL" | "XXL";
type SalesDocumentType = "INVOICE" | "DISPATCH";
type VoucherMode = "B" | "R";

interface CustomerItem {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
}

interface ProductItem {
  id: number;
  modelNo: string;
  name: string;
}

interface ColorItem {
  id: number;
  name: string;
}

interface SizeMap {
  XS: number;
  S: number;
  M: number;
  L: number;
  XL: number;
  XXL: number;
}

interface OrderLine {
  id: number;
  productCode: string;
  productName: string;
  description: string;
  productionOrderNo: string;
  color: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  deliveryDate: string;
  notes: string;
  sizes: SizeMap;
}

interface ExistingOrderItem {
  id: number;
  productCode: string;
  color: string;
  description?: string | null;
  notes?: string | null;
  quantity: number;
  unit?: string | null;
  unitPrice: number;
  totalPrice: number;
  deliveryDate?: string | null;
}

interface ExistingOrder {
  id: number;
  orderNo: string;
  customerId: number;
  documentType?: SalesDocumentType;
  documentDate?: string | null;
  documentNo?: string | null;
  dispatchDate?: string | null;
  dispatchNo?: string | null;
  inWarehouseCode?: string | null;
  outWarehouseCode?: string | null;
  currencyCode?: string | null;
  currencyRate?: number | null;
  note?: string | null;
  createdAt?: string;
  items: ExistingOrderItem[];
}

interface CustomerOrderAddPageProps {
  initialOrderId?: number;
  initialFromOrderId?: number;
  initialDocumentType?: SalesDocumentType;
  initialVoucherMode?: VoucherMode;
  initialVoucherTypeCode?: number;
  initialVoucherTypeLabel?: string;
}

interface MatrixRow {
  color: string;
  sizes: SizeMap;
  total: number;
}

const SIZE_KEYS: SizeKey[] = ["XS", "S", "M", "L", "XL", "XXL"];
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "genel", label: "Genel" },
  { key: "detay", label: "Detay" },
  { key: "aciklama", label: "Dis Ticaret" },
  { key: "toplamlar", label: "e-Fatura" },
  { key: "ekler", label: "Ekler / Ozel Alanlar" },
];

const fmt2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

let lineSeq = 1;

const emptySizes = (): SizeMap => ({ XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 });
const today = (): string => new Date().toISOString().slice(0, 10);

const normalizeDocumentType = (value: unknown): SalesDocumentType => {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized === "DISPATCH" ? "DISPATCH" : "INVOICE";
};

const normalizeVoucherMode = (value: unknown): VoucherMode => {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized === "R" ? "R" : "B";
};

const createOrderNo = (documentType: SalesDocumentType = "INVOICE"): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const s = String((d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) % 10000).padStart(4, "0");
  const prefix = documentType === "DISPATCH" ? "SI" : "SP";
  return `${prefix}-${y}${m}${day}-${s}`;
};

const getAuthHeaders = (): { Authorization: string } | undefined => {
  if (typeof window === "undefined") return undefined;
  const token = localStorage.getItem("token") || localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};

const createLine = (): OrderLine => {
  lineSeq += 1;
  return {
    id: Date.now() + lineSeq,
    productCode: "",
    productName: "",
    description: "",
    productionOrderNo: "",
    color: "",
    quantity: 0,
    unit: "adet",
    unitPrice: 0,
    totalPrice: 0,
    deliveryDate: "",
    notes: "",
    sizes: emptySizes(),
  };
};

const num = (value: string): number => {
  const v = Number(value.replace(",", "."));
  return Number.isFinite(v) && v > 0 ? v : 0;
};

const sumSizes = (sizes: SizeMap): number => SIZE_KEYS.reduce((sum, key) => sum + sizes[key], 0);

const buildSizeNote = (sizes: SizeMap): string => {
  const parts = SIZE_KEYS.filter((key) => sizes[key] > 0).map((key) => `${key}:${fmt0.format(sizes[key])}`);
  return parts.length ? `Beden -> ${parts.join(", ")}` : "";
};

const parseSizeNote = (rawNotes?: string | null): { sizes: SizeMap; notes: string } => {
  const sizes = emptySizes();
  if (!rawNotes) {
    return { sizes, notes: "" };
  }

  const segments = rawNotes
    .split("|")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const noteSegments: string[] = [];

  segments.forEach((segment) => {
    if (!segment.toLowerCase().startsWith("beden ->")) {
      noteSegments.push(segment);
      return;
    }

    const sizeParts = segment
      .slice("Beden ->".length)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    sizeParts.forEach((part) => {
      const [rawKey, rawValue] = part.split(":").map((value) => value.trim());
      if (!rawKey || !rawValue) return;
      if (!SIZE_KEYS.includes(rawKey as SizeKey)) return;
      const amount = Number(rawValue.replace(",", "."));
      if (!Number.isFinite(amount) || amount <= 0) return;
      sizes[rawKey as SizeKey] = amount;
    });
  });

  return { sizes, notes: noteSegments.join(" | ") };
};

const toDateInputValue = (rawDate?: string | null): string => {
  if (!rawDate) return "";
  const d = new Date(rawDate);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

const ensureTrailingAutoLine = (draftLines: OrderLine[]): OrderLine[] => {
  if (draftLines.length === 0) {
    return [createLine()];
  }

  const lastLine = draftLines[draftLines.length - 1];
  const shouldAppend = lastLine.productCode.trim() !== "" && lastLine.color.trim() !== "" && lastLine.quantity > 0;

  if (!shouldAppend) {
    return draftLines;
  }

  return [...draftLines, createLine()];
};

const getColorBadgeStyle = (rawName: string): React.CSSProperties => {
  const name = rawName.toLowerCase();

  if (name.includes("siyah")) return { background: "#090b0d", color: "#ffffff" };
  if (name.includes("beyaz")) return { background: "#ffffff", color: "#1d2733" };
  if (name.includes("ekru")) return { background: "#d8d2c6", color: "#1d2733" };
  if (name.includes("lacivert")) return { background: "#0e2e88", color: "#ffffff" };
  if (name.includes("murdum") || name.includes("mor")) return { background: "#6e014a", color: "#ffffff" };
  if (name.includes("kahve")) return { background: "#75603f", color: "#ffffff" };
  if (name.includes("kirmizi")) return { background: "#ac1f2d", color: "#ffffff" };
  if (name.includes("mavi")) return { background: "#2873c9", color: "#ffffff" };
  if (name.includes("yesil")) return { background: "#2d8d53", color: "#ffffff" };
  if (name.includes("sari")) return { background: "#ccb247", color: "#1d2733" };
  if (name.includes("gri")) return { background: "#9fa7b2", color: "#1d2733" };
  if (name.includes("turuncu")) return { background: "#cc7a1e", color: "#ffffff" };

  return { background: "#d9e0e7", color: "#233140" };
};

export default function CustomerOrderAddPage({
  initialOrderId,
  initialFromOrderId,
  initialDocumentType = "INVOICE",
  initialVoucherMode = "B",
  initialVoucherTypeCode,
  initialVoucherTypeLabel = "",
}: CustomerOrderAddPageProps) {
  const router = useRouter();
  const [documentType, setDocumentType] = useState<SalesDocumentType>(initialDocumentType);
  const [voucherMode, setVoucherMode] = useState<VoucherMode>(initialVoucherMode);
  const [voucherTypeCode, setVoucherTypeCode] = useState<number | undefined>(initialVoucherTypeCode);
  const [voucherTypeLabel, setVoucherTypeLabel] = useState<string>(initialVoucherTypeLabel);
  const [activeTab, setActiveTab] = useState<TabKey>("genel");
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [orderNo, setOrderNo] = useState<string>(createOrderNo(initialDocumentType));
  const [orderDate, setOrderDate] = useState<string>(today());
  const [dispatchDate, setDispatchDate] = useState<string>(today());
  const [documentNo, setDocumentNo] = useState<string>("");
  const [dispatchDocumentNo, setDispatchDocumentNo] = useState<string>("");
  const [customerId, setCustomerId] = useState<string>("");
  const [currencyCode, setCurrencyCode] = useState<string>("TRY");
  const [currencyRate, setCurrencyRate] = useState<string>("1");
  const [warehouseCode, setWarehouseCode] = useState<string>("MD");
  const [warehouseName, setWarehouseName] = useState<string>("MAMUL DEPO");
  const [orderNote, setOrderNote] = useState<string>("");

  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [colors, setColors] = useState<ColorItem[]>([]);

  const [lines, setLines] = useState<OrderLine[]>([createLine()]);
  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);

  const [loadingRef, setLoadingRef] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [importedFromOrderId, setImportedFromOrderId] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number }>({
    visible: false,
    x: 0,
    y: 0,
  });
  const saveOrderRef = useRef<() => Promise<void>>(async () => {});
  const resetFormRef = useRef<() => void>(() => {});
  const addLineRef = useRef<() => void>(() => {});
  const addLineAfterSelectedRef = useRef<() => void>(() => {});
  const skipAutoLineRef = useRef<boolean>(false);

  useEffect(() => {
    if (!router.isReady) return;
    const queryType = Array.isArray(router.query.type) ? router.query.type[0] : router.query.type;
    if (queryType) {
      const normalized = normalizeDocumentType(queryType);
      setDocumentType(normalized);
      if (!editingOrderId) {
        setOrderNo((prev) => (prev ? prev : createOrderNo(normalized)));
      }
    }

    const queryVoucherMode = Array.isArray(router.query.voucherMode)
      ? router.query.voucherMode[0]
      : router.query.voucherMode;
    setVoucherMode(normalizeVoucherMode(queryVoucherMode || initialVoucherMode));

    const queryVoucherTypeCode = Array.isArray(router.query.voucherTypeCode)
      ? router.query.voucherTypeCode[0]
      : router.query.voucherTypeCode;
    const parsedVoucherTypeCode = Number(queryVoucherTypeCode);
    setVoucherTypeCode(
      Number.isInteger(parsedVoucherTypeCode) ? parsedVoucherTypeCode : initialVoucherTypeCode
    );

    const queryVoucherTypeLabel = Array.isArray(router.query.voucherTypeLabel)
      ? router.query.voucherTypeLabel[0]
      : router.query.voucherTypeLabel;
    setVoucherTypeLabel(String(queryVoucherTypeLabel || initialVoucherTypeLabel || "").trim());
  }, [
    router.isReady,
    router.query.type,
    router.query.voucherMode,
    router.query.voucherTypeCode,
    router.query.voucherTypeLabel,
    editingOrderId,
    initialVoucherMode,
    initialVoucherTypeCode,
    initialVoucherTypeLabel,
  ]);

  useEffect(() => {
    let mounted = true;

    const load = async (): Promise<void> => {
      setLoadingRef(true);
      const headers = getAuthHeaders();
      const [cRes, pRes, colorRes] = await Promise.allSettled([
        axios.get<CustomerItem[]>("/api/customers", { headers }),
        axios.get<ProductItem[]>("/api/products", { headers }),
        axios.get<ColorItem[]>("/api/colors", { headers }),
      ]);

      if (!mounted) return;

      if (cRes.status === "fulfilled") setCustomers(Array.isArray(cRes.value.data) ? cRes.value.data : []);
      if (pRes.status === "fulfilled") setProducts(Array.isArray(pRes.value.data) ? pRes.value.data : []);
      if (colorRes.status === "fulfilled") setColors(Array.isArray(colorRes.value.data) ? colorRes.value.data : []);

      if (cRes.status === "rejected" || pRes.status === "rejected" || colorRes.status === "rejected") {
        setError("Bazi referans verileri yuklenemedi.");
      }

      setLoadingRef(false);
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const mapExistingItemsToLines = useCallback(
    (items: ExistingOrderItem[]): OrderLine[] =>
      Array.isArray(items)
        ? items.map((item, index) => {
            const { sizes, notes } = parseSizeNote(item.notes);
            const quantity = Number(item.quantity || 0);
            const unitPrice = Number(item.unitPrice || 0);
            const totalPrice = Number(item.totalPrice || quantity * unitPrice);

            return {
              id: item.id || Date.now() + index + 1,
              productCode: item.productCode || "",
              productName: "",
              description: item.description || "",
              productionOrderNo: "",
              color: item.color || "",
              quantity,
              unit: item.unit || "adet",
              unitPrice,
              totalPrice,
              deliveryDate: toDateInputValue(item.deliveryDate),
              notes,
              sizes,
            };
          })
        : [],
    []
  );

  const loadOrderForEdit = useCallback(async (orderId: number): Promise<void> => {
    setError("");
    setSuccess("");
    setLoadingRef(true);

    try {
      const response = await axios.get<ExistingOrder>("/api/customer-orders", {
        params: { id: orderId },
        headers: getAuthHeaders(),
      });
      const order = response.data;

      if (!order || !order.id) {
        setError("Siparis bulunamadi.");
        setLoadingRef(false);
        return;
      }

      setEditingOrderId(order.id);
      setImportedFromOrderId(null);
      const resolvedDocumentType = normalizeDocumentType(order.documentType || documentType);
      setOrderNo(order.orderNo || createOrderNo(resolvedDocumentType));
      setDocumentType(resolvedDocumentType);
      setOrderDate(toDateInputValue(order.documentDate || order.createdAt) || today());
      setDispatchDate(toDateInputValue(order.dispatchDate) || today());
      setCustomerId(order.customerId ? String(order.customerId) : "");
      setDocumentNo(order.documentNo || "");
      setDispatchDocumentNo(order.dispatchNo || "");
      setCurrencyCode(order.currencyCode || "TRY");
      setCurrencyRate(order.currencyRate !== null && order.currencyRate !== undefined ? String(order.currencyRate) : "1");
      setWarehouseCode(order.inWarehouseCode || "MD");
      setWarehouseName(order.outWarehouseCode || "MAMUL DEPO");
      setOrderNote(order.note || "");

      const loadedLines = mapExistingItemsToLines(order.items);

      const nextLines = loadedLines.length ? ensureTrailingAutoLine(loadedLines) : [createLine()];
      setLines(nextLines);
      setSelectedLineId(nextLines[0]?.id ?? null);
      setActiveTab("genel");
      setSuccess(`Siparis acildi: ${order.orderNo}`);
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err !== null && "response" in err
          ? ((err as { response?: { data?: { message?: string; error?: string } } }).response?.data?.message ||
            (err as { response?: { data?: { message?: string; error?: string } } }).response?.data?.error)
          : "";
      setError(message || "Siparis acilirken hata olustu.");
    } finally {
      setLoadingRef(false);
    }
  }, [documentType, mapExistingItemsToLines]);

  const loadOrderForTransfer = useCallback(async (orderId: number): Promise<void> => {
    setError("");
    setSuccess("");
    setLoadingRef(true);

    try {
      const response = await axios.get<ExistingOrder>("/api/customer-orders", {
        params: { id: orderId },
        headers: getAuthHeaders(),
      });
      const sourceOrder = response.data;

      if (!sourceOrder || !sourceOrder.id) {
        setError("Aktarilacak siparis bulunamadi.");
        setLoadingRef(false);
        return;
      }

      setEditingOrderId(null);
      setImportedFromOrderId(sourceOrder.id);
      setOrderNo(createOrderNo(documentType));
      setOrderDate(today());
      setDispatchDate(today());
      setCustomerId(sourceOrder.customerId ? String(sourceOrder.customerId) : "");
      setDocumentNo(sourceOrder.documentNo || sourceOrder.orderNo || "");
      setDispatchDocumentNo(sourceOrder.dispatchNo || "");
      setCurrencyCode(sourceOrder.currencyCode || "TRY");
      setCurrencyRate(
        sourceOrder.currencyRate !== null && sourceOrder.currencyRate !== undefined
          ? String(sourceOrder.currencyRate)
          : "1"
      );
      setWarehouseCode(sourceOrder.inWarehouseCode || "MD");
      setWarehouseName(sourceOrder.outWarehouseCode || "MAMUL DEPO");

      const relationNote = `Kaynak siparis: ${sourceOrder.orderNo} (#${sourceOrder.id})`;
      const trimmedSourceNote = String(sourceOrder.note || "").trim();
      setOrderNote(trimmedSourceNote ? `${relationNote} | ${trimmedSourceNote}` : relationNote);

      const loadedLines = mapExistingItemsToLines(sourceOrder.items);
      const nextLines = loadedLines.length ? ensureTrailingAutoLine(loadedLines) : [createLine()];
      setLines(nextLines);
      setSelectedLineId(nextLines[0]?.id ?? null);
      setActiveTab("genel");
      setSuccess(`Siparisten aktarim hazir: ${sourceOrder.orderNo}`);
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err !== null && "response" in err
          ? ((err as { response?: { data?: { message?: string; error?: string } } }).response?.data?.message ||
            (err as { response?: { data?: { message?: string; error?: string } } }).response?.data?.error)
          : "";
      setError(message || "Siparis aktarimi baslatilamadi.");
    } finally {
      setLoadingRef(false);
    }
  }, [documentType, mapExistingItemsToLines]);

  const openTransferFromOrderPrompt = useCallback(async (): Promise<void> => {
    try {
      const response = await axios.get<ExistingOrder[]>("/api/customer-orders", {
        params: { scope: "order" },
        headers: getAuthHeaders(),
      });
      const sourceOrders = Array.isArray(response.data) ? response.data : [];
      if (!sourceOrders.length) {
        setError("Aktarilacak siparis bulunamadi.");
        return;
      }

      const quickList = sourceOrders
        .slice(0, 20)
        .map((order) => `${order.id} - ${order.orderNo}`)
        .join("\n");
      const promptText = `Aktarilacak siparis ID veya Siparis No girin:\n${quickList}`;
      const rawInput = window.prompt(promptText, String(sourceOrders[0].id)) || "";
      const trimmedInput = rawInput.trim();
      if (!trimmedInput) return;

      const numericId = Number(trimmedInput);
      const matchedOrder =
        Number.isInteger(numericId) && numericId > 0
          ? sourceOrders.find((order) => order.id === numericId)
          : sourceOrders.find((order) => String(order.orderNo || "").trim() === trimmedInput);

      if (!matchedOrder) {
        setError("Girilen siparis listede bulunamadi.");
        return;
      }

      await loadOrderForTransfer(matchedOrder.id);
    } catch {
      setError("Siparisler yuklenemedi. Aktarma baslatilamadi.");
    }
  }, [loadOrderForTransfer]);

  const resolvedFromOrderId = useMemo<number | null>(() => {
    const queryFromOrderId = Array.isArray(router.query.fromOrderId)
      ? router.query.fromOrderId[0]
      : router.query.fromOrderId;
    const parsedFromQuery = Number(queryFromOrderId);
    if (Number.isInteger(parsedFromQuery) && parsedFromQuery > 0) {
      return parsedFromQuery;
    }
    if (
      typeof initialFromOrderId === "number" &&
      Number.isInteger(initialFromOrderId) &&
      initialFromOrderId > 0
    ) {
      return initialFromOrderId;
    }
    return null;
  }, [initialFromOrderId, router.query.fromOrderId]);

  useEffect(() => {
    if (!router.isReady && !initialOrderId) return;
    const queryId = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id;
    const parsedId = Number(initialOrderId ?? queryId);

    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      setEditingOrderId(null);
      return;
    }

    if (editingOrderId === parsedId) return;

    void loadOrderForEdit(parsedId);
  }, [router.isReady, router.query.id, initialOrderId, editingOrderId, loadOrderForEdit]);

  useEffect(() => {
    if (!router.isReady && !resolvedFromOrderId) return;
    if (editingOrderId) return;
    if (!resolvedFromOrderId || resolvedFromOrderId <= 0) return;
    if (importedFromOrderId === resolvedFromOrderId) return;
    void loadOrderForTransfer(resolvedFromOrderId);
  }, [router.isReady, resolvedFromOrderId, editingOrderId, importedFromOrderId, loadOrderForTransfer]);

  useEffect(() => {
    if (lines.length === 0) {
      setSelectedLineId(null);
      return;
    }
    if (selectedLineId === null || !lines.some((line) => line.id === selectedLineId)) {
      setSelectedLineId(lines[0].id);
    }
  }, [lines, selectedLineId]);

  useEffect(() => {
    if (skipAutoLineRef.current) {
      skipAutoLineRef.current = false;
      return;
    }
    setLines((prev) => ensureTrailingAutoLine(prev));
  }, [lines]);

  const selectedLine = useMemo(() => lines.find((line) => line.id === selectedLineId) || null, [lines, selectedLineId]);

  const selectedCustomer = useMemo(() => {
    const cid = Number(customerId);
    return customers.find((customer) => customer.id === cid) || null;
  }, [customerId, customers]);

  const productMapByCode = useMemo(() => {
    const map = new Map<string, ProductItem>();
    products.forEach((product) => {
      const codeKey = String(product.modelNo || "").trim().toLowerCase();
      if (codeKey) {
        map.set(codeKey, product);
      }
    });
    return map;
  }, [products]);

  const colorMapByName = useMemo(() => {
    const map = new Map<string, ColorItem>();
    colors.forEach((color) => {
      const colorKey = String(color.name || "").trim().toLowerCase();
      if (colorKey) {
        map.set(colorKey, color);
      }
    });
    return map;
  }, [colors]);

  const resolveProductNameByCode = (productCode: string): string => {
    const codeKey = String(productCode || "").trim().toLowerCase();
    if (!codeKey) return "";
    return productMapByCode.get(codeKey)?.name || "";
  };

  useEffect(() => {
    if (!productMapByCode.size) return;

    setLines((prevLines) => {
      let changed = false;
      const nextLines = prevLines.map((line) => {
        const codeKey = String(line.productCode || "").trim().toLowerCase();
        const resolvedName = codeKey ? productMapByCode.get(codeKey)?.name || "" : "";
        if (!resolvedName || resolvedName === line.productName) {
          return line;
        }
        changed = true;
        return { ...line, productName: resolvedName };
      });
      return changed ? nextLines : prevLines;
    });
  }, [productMapByCode]);

  const totals = useMemo(() => {
    const qty = lines.reduce((sum, line) => sum + line.quantity, 0);
    const total = lines.reduce((sum, line) => sum + line.totalPrice, 0);
    const rowCount = lines.filter((line) => line.productCode || line.description || line.quantity > 0).length;
    return { qty, total, rowCount };
  }, [lines]);

  const matrixRows = useMemo<MatrixRow[]>(() => {
    const map = new Map<string, MatrixRow>();

    lines.forEach((line) => {
      const color = line.color.trim() || "RENKSIZ";
      const current =
        map.get(color) ||
        ({
          color,
          sizes: emptySizes(),
          total: 0,
        } as MatrixRow);

      SIZE_KEYS.forEach((key) => {
        current.sizes[key] += line.sizes[key];
      });
      current.total += line.quantity;

      map.set(color, current);
    });

    return Array.from(map.values()).sort((a, b) => a.color.localeCompare(b.color, "tr"));
  }, [lines]);

  const selectedSizeTotal = selectedLine ? sumSizes(selectedLine.sizes) : 0;
  const sizeMismatch = selectedLine ? Math.abs(selectedLine.quantity - selectedSizeTotal) > 0.001 : false;
  const voucherTypeDisplay = useMemo(() => {
    if (documentType !== "INVOICE") return "";
    if (voucherTypeLabel.trim()) return voucherTypeLabel.trim();
    if (typeof voucherTypeCode === "number" && Number.isInteger(voucherTypeCode)) {
      return String(voucherTypeCode);
    }
    return "";
  }, [documentType, voucherTypeCode, voucherTypeLabel]);

  const headerDocumentLabel = useMemo(() => {
    if (documentType === "INVOICE") {
      const actionText = editingOrderId ? "Fatura Fisi Duzenle" : "Fatura Fisi";
      return voucherTypeDisplay
        ? `${actionText} [${voucherMode} - ${voucherTypeDisplay}]`
        : `${actionText} [${voucherMode}]`;
    }

    return editingOrderId
      ? "Irsaliye Fisi Duzenle [Toptan Satis Irsaliyesi]"
      : "Irsaliye Fisi [Toptan Satis Irsaliyesi]";
  }, [documentType, editingOrderId, voucherMode, voucherTypeDisplay]);

  const updateLine = (lineId: number, updater: (line: OrderLine) => OrderLine): void => {
    setLines((prev) => prev.map((line) => (line.id === lineId ? updater(line) : line)));
  };

  const setLineText = (
    lineId: number,
    field: "productCode" | "productName" | "description" | "productionOrderNo" | "color" | "unit" | "deliveryDate" | "notes",
    value: string
  ): void => {
    updateLine(lineId, (line) => ({ ...line, [field]: value }));
  };

  const setProductCode = (lineId: number, value: string): void => {
    const code = value.trim();
    const product = productMapByCode.get(code.toLowerCase());
    updateLine(lineId, (line) => ({
      ...line,
      productCode: code,
      productName: product ? product.name : "",
      description: product && !line.description ? product.name : line.description,
    }));
  };

  const setColorCard = (lineId: number, colorName: string): void => {
    updateLine(lineId, (line) => ({
      ...line,
      color: String(colorName || "").trim(),
    }));
  };

  const setQuantity = (lineId: number, value: string): void => {
    const quantity = num(value);
    updateLine(lineId, (line) => ({ ...line, quantity, totalPrice: quantity * line.unitPrice }));
  };

  const setUnitPrice = (lineId: number, value: string): void => {
    const unitPrice = num(value);
    updateLine(lineId, (line) => ({ ...line, unitPrice, totalPrice: unitPrice * line.quantity }));
  };

  const setSize = (lineId: number, sizeKey: SizeKey, value: string): void => {
    const sizeValue = Math.floor(num(value));
    updateLine(lineId, (line) => {
      const sizes = { ...line.sizes, [sizeKey]: sizeValue };
      const quantity = sumSizes(sizes);
      return { ...line, sizes, quantity, totalPrice: quantity * line.unitPrice };
    });
  };

  const addLineAfter = (afterLineId?: number): void => {
    const line = createLine();
    setLines((prev) => {
      if (afterLineId === undefined) {
        return [...prev, line];
      }

      const insertIndex = prev.findIndex((item) => item.id === afterLineId);
      if (insertIndex === -1) {
        return [...prev, line];
      }

      const next = [...prev];
      next.splice(insertIndex + 1, 0, line);
      return next;
    });
    setSelectedLineId(line.id);
  };

  const addLine = (): void => {
    addLineAfter();
  };

  const addLineAfterSelected = (): void => {
    if (selectedLineId !== null) {
      addLineAfter(selectedLineId);
      return;
    }
    addLine();
  };

  const copySelected = (): void => {
    if (!selectedLine) {
      addLine();
      return;
    }
    const base = createLine();
    const copied: OrderLine = {
      ...selectedLine,
      id: base.id,
      sizes: { ...selectedLine.sizes },
      totalPrice: selectedLine.quantity * selectedLine.unitPrice,
    };
    setLines((prev) => [...prev, copied]);
    setSelectedLineId(copied.id);
  };

  const removeLine = (lineId: number): void => {
    skipAutoLineRef.current = true;
    setLines((prev) => {
      const next = prev.filter((line) => line.id !== lineId);
      return next.length ? next : [createLine()];
    });
    setSelectedLineId((prev) => (prev === lineId ? null : prev));
  };

  const resetForm = (): void => {
    setEditingOrderId(null);
    setImportedFromOrderId(null);
    setOrderNo(createOrderNo(documentType));
    setOrderDate(today());
    setDispatchDate(today());
    setDocumentNo("");
    setDispatchDocumentNo("");
    setOrderNote("");
    setCustomerId("");
    setLines([createLine()]);
    setSelectedLineId(null);

    if (router.isReady && router.query.id) {
      const isSalesRoute = router.pathname === "/sales/document-form";
      const basePath = isSalesRoute ? "/sales/document-form" : "/customer-orders/add";
      const queryParts = [`type=${documentType}`];
      if (documentType === "INVOICE") {
        queryParts.push(`voucherMode=${voucherMode}`);
        if (typeof voucherTypeCode === "number" && Number.isInteger(voucherTypeCode)) {
          queryParts.push(`voucherTypeCode=${voucherTypeCode}`);
        }
        if (voucherTypeLabel.trim()) {
          queryParts.push(`voucherTypeLabel=${encodeURIComponent(voucherTypeLabel.trim())}`);
        }
      }
      const querySuffix = `?${queryParts.join("&")}`;
      void router.replace(`${basePath}${querySuffix}`, undefined, { shallow: true });
    }
  };

  const saveOrder = async (): Promise<void> => {
    setError("");
    setSuccess("");

    if (!orderNo.trim()) {
      setError("Fis no zorunludur.");
      return;
    }
    if (!customerId) {
      setError("Musteri secimi zorunludur.");
      return;
    }

    const payloadLines = lines.filter((line) => line.productCode || line.description || line.quantity > 0);

    if (!payloadLines.length) {
      setError("En az bir satir girilmelidir.");
      return;
    }

    if (payloadLines.some((line) => !line.productCode.trim() || !line.color.trim() || line.quantity <= 0)) {
      setError("Her satirda urun kodu, renk ve miktar zorunludur.");
      return;
    }

    const hasInvalidProduct = payloadLines.some((line) => {
      const codeKey = String(line.productCode || "").trim().toLowerCase();
      return !productMapByCode.has(codeKey);
    });
    if (hasInvalidProduct) {
      setError("Urun kodu urun kartlarindan secilmelidir.");
      return;
    }

    const hasInvalidColor = payloadLines.some((line) => {
      const colorKey = String(line.color || "").trim().toLowerCase();
      return !colorMapByName.has(colorKey);
    });
    if (hasInvalidColor) {
      setError("Varyant alani renk kartlarindan secilmelidir.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        orderNo: orderNo.trim(),
        documentType,
        documentDate: orderDate || null,
        documentNo: documentNo.trim() || null,
        dispatchDate: dispatchDate || null,
        dispatchNo: dispatchDocumentNo.trim() || null,
        inWarehouseCode: warehouseCode.trim() || null,
        outWarehouseCode: warehouseCode.trim() || null,
        currencyCode: currencyCode.trim() || "TRY",
        currencyRate: Number(currencyRate || 1),
        note: orderNote.trim() || null,
        customerId: Number(customerId),
        items: payloadLines.map((line) => {
          const note = [line.notes.trim(), buildSizeNote(line.sizes)].filter(Boolean).join(" | ");
          return {
            productCode: line.productCode.trim(),
            color: line.color.trim(),
            description: line.description.trim() || line.productName.trim() || null,
            notes: note || null,
            quantity: line.quantity,
            unit: line.unit || "adet",
            deliveryDate: line.deliveryDate || null,
            unitPrice: line.unitPrice,
            totalPrice: line.totalPrice,
          };
        }),
      };

      if (editingOrderId) {
        await axios.put(
          "/api/customer-orders",
          {
            id: editingOrderId,
            ...payload,
          },
          { headers: getAuthHeaders() }
        );
        const updatedLabel = documentType === "INVOICE" ? "Fatura" : "Irsaliye";
        setSuccess(`${updatedLabel} guncellendi: ${orderNo}`);
      } else {
        await axios.post("/api/customer-orders", payload, { headers: getAuthHeaders() });
        const savedLabel = documentType === "INVOICE" ? "Fatura" : "Irsaliye";
        setSuccess(`${savedLabel} kaydedildi: ${orderNo}`);
        resetForm();
      }

      setActiveTab("genel");
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err !== null && "response" in err
          ? ((err as { response?: { data?: { message?: string; error?: string } } }).response?.data?.message ||
            (err as { response?: { data?: { message?: string; error?: string } } }).response?.data?.error)
          : "";
      setError(message || "Kaydetme sirasinda hata olustu.");
    } finally {
      setSaving(false);
    }
  };

  saveOrderRef.current = saveOrder;
  resetFormRef.current = resetForm;
  addLineRef.current = addLine;
  addLineAfterSelectedRef.current = addLineAfterSelected;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target;
      const inLineEditor =
        target instanceof Element && !!target.closest("[data-line-editor='true']");
      const inTextArea = target instanceof HTMLTextAreaElement;
      const isEditable = target instanceof HTMLElement && target.isContentEditable;
      const key = typeof event.key === "string" ? event.key.toLowerCase() : "";

      if (!event.ctrlKey && !event.metaKey) {
        if (key === "enter" && inLineEditor && !inTextArea && !isEditable) {
          event.preventDefault();
          addLineAfterSelectedRef.current();
        }
        return;
      }


      if (key === "s") {
        event.preventDefault();
        if (!saving) {
          void saveOrderRef.current();
        }
        return;
      }

      if (key === "n") {
        event.preventDefault();
        resetFormRef.current();
        return;
      }

      if (key === "enter") {
        event.preventDefault();
        addLineRef.current();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saving]);

  useEffect(() => {
    const closeMenu = () => setContextMenu({ visible: false, x: 0, y: 0 });
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, []);

  return (
    <div style={s.page}>
      <div style={s.shell}>
<div style={s.headLine}>
          <Link href="/customer-orders/list" style={s.headChipLink}>
            Satis Siparisleri Listesi
          </Link>
          <Link href={documentType === "INVOICE" ? "/sales/invoices" : "/sales/dispatch-notes"} style={s.headChipLink}>
            {documentType === "INVOICE" ? "Satis Fatura Fisleri" : "Satis Irsaliye Fisleri"}
          </Link>
          <div style={s.headChipActive}>
            {headerDocumentLabel}{" "}
            - {orderNo}
          </div>
        </div>

        <div style={s.toolbar}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={s.btn} onClick={() => void saveOrder()} disabled={saving} title="Ctrl+S">
              {saving ? "Kaydediliyor..." : editingOrderId ? "Guncelle" : "Kaydet"}
            </button>
            <button style={s.btnLight} onClick={addLine} title="Ctrl+Enter">Satir Ekle</button>
            <button style={s.btnLight} onClick={copySelected}>Seciliyi Kopyala</button>
            <button style={s.btnDanger} onClick={resetForm} title="Ctrl+N">Yeni Fis</button>
          </div>
          <div style={s.toolbarMeta}>
            <div style={s.toolbarInfo}>{loadingRef ? "Referans verileri yukleniyor..." : `${customers.length} musteri / ${products.length} urun`}</div>
            <div style={s.toolbarHint}>Kisayollar: Ctrl+S Kaydet | Ctrl+N Yeni Fis | Ctrl+Enter Satir Ekle</div>
            <div style={s.toolbarHint}>UX: Son satir urun + renk + miktar dolunca yeni satir otomatik eklenir.</div>
          </div>
        </div>

        {!!error && <div style={s.error}>{error}</div>}
        {!!success && <div style={s.success}>{success}</div>}

        <div style={s.tabs}>
          {TABS.map((tab) => (
            <button key={tab.key} style={activeTab === tab.key ? s.tabActive : s.tab} onClick={() => setActiveTab(tab.key)}>
              {tab.label}
            </button>
          ))}
        </div>

        <div
          style={s.content}
          onContextMenu={(event) => {
            event.preventDefault();
            setContextMenu({ visible: true, x: event.clientX, y: event.clientY });
          }}
        >
          {activeTab === "genel" && (
            <>
              <div style={s.box}>
                <div style={s.boxTitle}>Genel Bilgiler</div>
                <div style={s.grid}>
                  <label style={s.field}><span style={s.label}>Fis No</span><input style={s.input} value={orderNo} onChange={(e) => setOrderNo(e.target.value)} /></label>
                  <label style={s.field}><span style={s.label}>Fis Tarihi</span><input type="date" style={s.input} value={orderDate} onChange={(e) => setOrderDate(e.target.value)} /></label>
                  <label style={s.field}><span style={s.label}>Irsaliye Tarihi</span><input type="date" style={s.input} value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} /></label>
                  <label style={s.field}><span style={s.label}>Belge No</span><input style={s.input} value={documentNo} onChange={(e) => setDocumentNo(e.target.value)} /></label>
                  <label style={s.field}><span style={s.label}>Irsaliye Belge No</span><input style={s.input} value={dispatchDocumentNo} onChange={(e) => setDispatchDocumentNo(e.target.value)} /></label>
                </div>
              </div>

              <div style={s.box}>
                <div style={s.boxTitle}>Cari Hesap Bilgileri</div>
                <div style={s.grid}>
                  <label style={{ ...s.field, gridColumn: "span 2" }}>
                    <span style={s.label}>Musteri</span>
                    <select style={s.input} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                      <option value="">Musteri seciniz</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={String(customer.id)}>{customer.id} - {customer.name}</option>
                      ))}
                    </select>
                  </label>
                  <label style={s.field}><span style={s.label}>Cari Kod</span><input style={s.input} value={selectedCustomer ? `T.${String(selectedCustomer.id).padStart(4, "0")}` : ""} readOnly /></label>
                </div>
              </div>

              <div style={s.box}>
                <div style={s.boxTitle}>Doviz ve Depo Bilgileri</div>
                <div style={s.grid}>
                  <label style={s.field}><span style={s.label}>Doviz</span><select style={s.input} value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)}><option value="TRY">TRY</option><option value="USD">USD</option><option value="EUR">EUR</option></select></label>
                  <label style={s.field}><span style={s.label}>Kur</span><input style={s.input} value={currencyRate} onChange={(e) => setCurrencyRate(e.target.value)} /></label>
                  <label style={s.field}><span style={s.label}>Depo Kod</span><input style={s.input} value={warehouseCode} onChange={(e) => setWarehouseCode(e.target.value)} /></label>
                  <label style={s.field}><span style={s.label}>Depo Adi</span><input style={s.input} value={warehouseName} onChange={(e) => setWarehouseName(e.target.value)} /></label>
                </div>
              </div>

              <div style={s.main}>
                  <div style={s.left}>
                  <div style={{ overflow: "auto", flex: 1, minHeight: 0 }} data-line-editor="true">
                    <table style={s.table}>
                      <thead>
                        <tr>
                          <th style={{ ...s.th, width: 40, textAlign: "center" }}>It.</th>
                          <th style={{ ...s.th, width: 76 }}>Tip</th>
                          <th style={{ ...s.th, width: 68 }}>Id</th>
                          <th style={{ ...s.th, width: 142 }}>Kodu</th>
                          <th style={{ ...s.th, width: 230 }}>Adi</th>
                          <th style={{ ...s.th, width: 180 }}>Aciklama</th>
                          <th style={{ ...s.th, width: 130 }}>Uretim Order No</th>
                          <th style={{ ...s.th, width: 128 }}>Varyant1</th>
                          <th style={{ ...s.th, width: 108, textAlign: "right" }}>Miktar</th>
                          <th style={{ ...s.th, width: 84 }}>Birim</th>
                          <th style={{ ...s.th, width: 110, textAlign: "right" }}>Fiyat</th>
                          <th style={{ ...s.th, width: 112, textAlign: "right" }}>Tutar</th>
                          <th style={{ ...s.th, width: 120 }}>Teslim</th>
                          <th style={{ ...s.th, width: 66, textAlign: "center" }}>Sil</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line, i) => {
                          const selected = line.id === selectedLineId;
                          const rowStyle = selected ? s.tdSelected : i % 2 === 1 ? s.tdAlt : undefined;
                          return (
                            <tr key={line.id} onClick={() => setSelectedLineId(line.id)} style={selected ? s.rowSelected : undefined}>
                              <td style={{ ...s.td, ...rowStyle, textAlign: "center", fontWeight: 600 }}>
                                <button
                                  type="button"
                                  style={s.plus}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addLineAfter(line.id);
                                  }}
                                  title="Satir altina yeni satir ekle"
                                >
                                  +
                                </button>
                              </td>
                              <td style={{ ...s.td, ...rowStyle }}>Malzeme</td>
                              <td style={{ ...s.td, ...rowStyle }}>{String(line.id).slice(-5)}</td>
                              <td style={{ ...s.td, ...rowStyle }}>
                                <Combobox
                                  products={products}
                                  value={line.productCode}
                                  onSelect={(code) => setProductCode(line.id, code)}
                                  placeholder="Ürün kodu yazın..."
                                  className="h-[28px]"
                                />
                              </td>
                              <td style={{ ...s.td, ...rowStyle }}>
                                <input
                                  style={{ ...s.cellInput, ...s.readOnlyCell }}
                                  value={resolveProductNameByCode(line.productCode) || line.productName}
                                  readOnly
                                />
                              </td>
                              <td style={{ ...s.td, ...rowStyle }}><input style={s.cellInput} value={line.description} onChange={(e) => setLineText(line.id, "description", e.target.value)} /></td>
                              <td style={{ ...s.td, ...rowStyle }}><input style={s.cellInput} value={line.productionOrderNo} onChange={(e) => setLineText(line.id, "productionOrderNo", e.target.value)} /></td>
                              <td style={{ ...s.td, ...rowStyle }}>
                                <Combobox
                                  products={colors.map(c => ({id: c.id, modelNo: c.name, name: c.name})) as any}
                                  value={line.color}
                                  onSelect={(colorName) => setColorCard(line.id, colorName)}
                                  placeholder="Renk yazın..."
                                  className="h-[28px]"
                                />
                              </td>
                              <td style={{ ...s.td, ...rowStyle }}><input type="number" step="1" min="0" style={s.cellNum} value={line.quantity} onChange={(e) => setQuantity(line.id, e.target.value)} /></td>
                              <td style={{ ...s.td, ...rowStyle }}><select style={s.cellInput} value={line.unit} onChange={(e) => setLineText(line.id, "unit", e.target.value)}><option value="adet">adet</option><option value="m">m</option><option value="kg">kg</option></select></td>
                              <td style={{ ...s.td, ...rowStyle }}><input type="number" step="0.01" min="0" style={s.cellNum} value={line.unitPrice} onChange={(e) => setUnitPrice(line.id, e.target.value)} /></td>
                              <td style={{ ...s.td, ...rowStyle, textAlign: "right", fontWeight: 600 }}>{fmt2.format(line.totalPrice)}</td>
                              <td style={{ ...s.td, ...rowStyle }}><input type="date" style={s.cellInput} value={line.deliveryDate} onChange={(e) => setLineText(line.id, "deliveryDate", e.target.value)} /></td>
                              <td style={{ ...s.td, ...rowStyle }}>
                                <button
                                  type="button"
                                  style={s.del}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeLine(line.id);
                                  }}
                                >
                                  Sil
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={s.right}>
                  <div style={s.panel}>
                    <div style={s.panelTitle}>Renk Dagilimi</div>
                    <table style={s.sizeTable}>
                      <thead>
                        <tr>
                          <th style={s.sTh}>Renk</th>
                          {SIZE_KEYS.map((key) => <th key={`m-${key}`} style={s.sTh}>{key}</th>)}
                          <th style={s.sTh}>Toplam</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!matrixRows.length ? (
                          <tr><td style={s.sTd} colSpan={8}>Veri yok</td></tr>
                        ) : (
                          matrixRows.map((row) => (
                            <tr key={row.color}>
                              <td style={{ ...s.sTdLeft, ...getColorBadgeStyle(row.color) }}>{row.color}</td>
                              {SIZE_KEYS.map((key) => <td key={`${row.color}-${key}`} style={s.sTd}>{fmt0.format(row.sizes[key])}</td>)}
                              <td style={s.sTd}>{fmt0.format(row.total)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div style={s.panel}>
                    <div style={s.panelTitle}>Secili Satir Bedenleri</div>
                    {selectedLine ? (
                      <>
                        <table style={s.sizeTable}>
                          <thead>
                            <tr>
                              <th style={s.sTh}>Renk</th>
                              {SIZE_KEYS.map((key) => <th key={`s-${key}`} style={s.sTh}>{key}</th>)}
                              <th style={s.sTh}>Toplam</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td style={{ ...s.sTd, ...getColorBadgeStyle(selectedLine.color) }}>
                                <Combobox
                                  products={colors.map(c => ({id: c.id, modelNo: c.name, name: c.name})) as any}
                                  value={selectedLine.color}
                                  onSelect={(colorName) => setColorCard(selectedLine.id, colorName)}
                                  placeholder="Renk seçin..."
                                  className="h-[26px] min-w-[120px]"
                                />
                              </td>
                              {SIZE_KEYS.map((key) => (
                                <td key={`e-${key}`} style={s.sTd}>
                                  <input type="number" min="0" step="1" style={s.sizeInput} value={selectedLine.sizes[key]} onChange={(e) => setSize(selectedLine.id, key, e.target.value)} />
                                </td>
                              ))}
                              <td style={{ ...s.sTd, fontWeight: 700 }}>{fmt0.format(selectedLine.quantity)}</td>
                            </tr>
                          </tbody>
                        </table>
                        {sizeMismatch && <div style={s.warn}>Beden toplami ile miktar farkli.</div>}
                      </>
                    ) : (
                      <div style={s.empty}>Satir seciniz.</div>
                    )}
                  </div>
                </div>
              </div>

              <div style={s.totalBar}>
                <div>
                  <div>Toplam Miktar: {fmt0.format(totals.qty)} ({totals.rowCount} Kalem)</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div>Ara Toplam: {currencyCode} {fmt2.format(totals.total)}</div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>Genel Toplam: {currencyCode} {fmt2.format(totals.total)}</div>
                </div>
              </div>

            </>
          )}

          {activeTab === "detay" && (
            <div style={s.box}>
              <div style={s.boxTitle}>Kalem Detay Ozeti</div>
              <table style={s.simpleTable}>
                <thead><tr><th style={s.th}>#</th><th style={s.th}>Urun</th><th style={s.th}>Renk</th><th style={s.th}>Miktar</th><th style={s.th}>Toplam</th><th style={s.th}>Not</th></tr></thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={`d-${line.id}`}>
                      <td style={s.td}>{i + 1}</td>
                      <td style={s.td}>{line.productCode} - {line.productName || "-"}</td>
                      <td style={s.td}>{line.color || "-"}</td>
                      <td style={s.td}>{fmt0.format(line.quantity)} {line.unit}</td>
                      <td style={s.td}>{currencyCode} {fmt2.format(line.totalPrice)}</td>
                      <td style={s.td}>{[line.notes, buildSizeNote(line.sizes)].filter(Boolean).join(" | ") || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "aciklama" && (
            <div style={s.box}>
              <div style={s.boxTitle}>Siparis Aciklama</div>
              <textarea style={s.textarea} value={orderNote} onChange={(e) => setOrderNote(e.target.value)} placeholder="Genel siparis notu..." />
            </div>
          )}

          {activeTab === "toplamlar" && (
            <div style={s.cards}>
              <div style={s.card}><div style={s.cardLabel}>Kalem</div><div style={s.cardValue}>{fmt0.format(totals.rowCount)}</div></div>
              <div style={s.card}><div style={s.cardLabel}>Miktar</div><div style={s.cardValue}>{fmt0.format(totals.qty)}</div></div>
              <div style={s.card}><div style={s.cardLabel}>Toplam</div><div style={s.cardValue}>{currencyCode} {fmt2.format(totals.total)}</div></div>
            </div>
          )}

          {activeTab === "ekler" && <div style={s.empty}>Ekler paneli hazirlandi, dosya yukleme sonraki adimda eklenebilir.</div>}
        </div>

        {contextMenu.visible ? (
          <div
            style={{ ...s.contextMenu, top: contextMenu.y, left: contextMenu.x }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              style={s.contextMenuItem}
              onClick={() => {
                void openTransferFromOrderPrompt();
                setContextMenu({ visible: false, x: 0, y: 0 });
              }}
            >
              Siparisten Aktar
              <span style={s.contextMenuHint}>F7</span>
            </button>
            <button
              type="button"
              style={s.contextMenuItem}
              onClick={() => setContextMenu({ visible: false, x: 0, y: 0 })}
            >
              Kapat
              <span style={s.contextMenuHint}>Esc</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    height: "100%",
    minHeight: 0,
    background: "var(--fs-color-bg)",
    padding: 12,
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
    color: "var(--fs-color-text)",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
  },
  shell: {
    width: "100%",
    border: "1px solid var(--fs-color-border)",
    borderRadius: 16,
    background: "linear-gradient(180deg, var(--fs-color-surface) 0%, var(--fs-color-bg) 100%)",
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 20px 45px -28px rgba(15, 23, 42, 0.35)",
  },
  headLine: {
    display: "flex",
    gap: 8,
    padding: "12px 14px",
    borderBottom: "1px solid var(--fs-color-border)",
    background: "var(--fs-color-surface)",
    flexWrap: "wrap",
  },
  headChip: {
    border: "1px solid var(--fs-color-border-strong)",
    borderRadius: 999,
    background: "var(--fs-color-surface-soft)",
    padding: "6px 12px",
    fontSize: 12,
  },
  headChipLink: {
    border: "1px solid var(--fs-color-border-strong)",
    borderRadius: 999,
    background: "var(--fs-color-surface-soft)",
    padding: "6px 12px",
    fontSize: 12,
    color: "var(--fs-color-primary-strong)",
    textDecoration: "none",
    cursor: "pointer",
    fontWeight: 600,
  },
  headChipActive: {
    border: "1px solid #93c5fd",
    borderRadius: 999,
    background: "var(--fs-color-primary-soft)",
    color: "var(--fs-color-primary-strong)",
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 700,
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    padding: "10px 14px",
    borderBottom: "1px solid var(--fs-color-border)",
    background: "var(--fs-color-surface)",
    flexWrap: "wrap",
    alignItems: "center",
  },
  toolbarMeta: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 },
  toolbarInfo: { fontSize: 12, color: "var(--fs-color-text-muted)" },
  toolbarHint: { fontSize: 11, color: "var(--fs-color-text-muted)" },
  btn: {
    border: "1px solid var(--fs-color-primary-strong)",
    background: "linear-gradient(180deg, #3b82f6 0%, var(--fs-color-primary) 100%)",
    color: "#ffffff",
    borderRadius: 10,
    padding: "7px 14px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  btnLight: {
    border: "1px solid #93c5fd",
    background: "#eff6ff",
    color: "var(--fs-color-primary-strong)",
    borderRadius: 10,
    padding: "7px 14px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnDanger: {
    border: "1px solid #fecaca",
    background: "#fee2e2",
    color: "#b91c1c",
    borderRadius: 10,
    padding: "7px 14px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  error: {
    margin: "10px 14px 0",
    border: "1px solid #fecaca",
    borderRadius: 10,
    background: "#fef2f2",
    color: "#b91c1c",
    padding: 10,
    fontSize: 12,
  },
  success: {
    margin: "10px 14px 0",
    border: "1px solid #a7f3d0",
    borderRadius: 10,
    background: "#ecfdf3",
    color: "#047857",
    padding: 10,
    fontSize: 12,
  },
  tabs: {
    display: "flex",
    gap: 8,
    padding: "10px 14px 0",
    flexWrap: "wrap",
  },
  tab: {
    border: "1px solid var(--fs-color-border-strong)",
    borderRadius: 999,
    background: "var(--fs-color-surface)",
    padding: "7px 13px",
    fontSize: 12,
    color: "var(--fs-color-text-muted)",
    fontWeight: 600,
    cursor: "pointer",
  },
  tabActive: {
    border: "1px solid var(--fs-color-primary)",
    borderRadius: 999,
    background: "var(--fs-color-primary)",
    color: "#ffffff",
    padding: "7px 13px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  content: {
    padding: "10px 14px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    flex: 1,
    minHeight: 0,
    overflow: "auto",
  },
  box: {
    border: "1px solid var(--fs-color-border)",
    borderRadius: 12,
    background: "var(--fs-color-surface)",
    padding: 10,
  },
  boxTitle: { fontSize: 12, marginBottom: 8, color: "var(--fs-color-text)", fontWeight: 700 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 },
  field: { display: "flex", flexDirection: "column", gap: 4 },
  label: { fontSize: 12, color: "var(--fs-color-text-muted)" },
  input: {
    border: "1px solid var(--fs-color-border-strong)",
    borderRadius: 10,
    background: "var(--fs-color-surface-soft)",
    minHeight: 36,
    padding: "6px 9px",
    fontSize: 12,
    color: "var(--fs-color-text)",
  },
  main: { display: "flex", gap: 10, minHeight: 360, flexWrap: "wrap" },
  left: {
    flex: "1 1 760px",
    minWidth: 280,
    border: "1px solid var(--fs-color-border)",
    borderRadius: 12,
    background: "var(--fs-color-surface)",
    display: "flex",
    overflow: "hidden",
  },
  right: { width: 340, minWidth: 280, display: "flex", flexDirection: "column", gap: 10 },
  panel: {
    border: "1px solid var(--fs-color-border)",
    borderRadius: 12,
    background: "var(--fs-color-surface)",
    minHeight: 170,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  panelTitle: {
    padding: "8px 10px",
    borderBottom: "1px solid var(--fs-color-border)",
    fontSize: 12,
    fontWeight: 700,
    color: "var(--fs-color-text)",
    background: "var(--fs-color-surface-soft)",
  },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 1520 },
  simpleTable: { width: "100%", borderCollapse: "collapse" },
  th: {
    border: "1px solid var(--fs-color-border)",
    background: "var(--fs-color-surface-soft)",
    padding: 7,
    fontSize: 12,
    textAlign: "left",
    whiteSpace: "nowrap",
    color: "var(--fs-color-text)",
    fontWeight: 700,
  },
  td: {
    border: "1px solid var(--fs-color-border)",
    background: "#ffffff",
    padding: 5,
    fontSize: 12,
    verticalAlign: "top",
    color: "var(--fs-color-text)",
  },
  tdAlt: { background: "var(--fs-color-surface-soft)" },
  tdSelected: {
    background: "var(--fs-color-primary-soft)",
    color: "var(--fs-color-primary-strong)",
    borderColor: "#93c5fd",
  },
  rowSelected: { background: "var(--fs-color-primary-soft)" },
  cellInput: {
    width: "100%",
    border: "1px solid var(--fs-color-border-strong)",
    borderRadius: 8,
    minHeight: 28,
    fontSize: 12,
    padding: "4px 6px",
    boxSizing: "border-box",
    background: "var(--fs-color-surface-soft)",
    color: "var(--fs-color-text)",
  },
  readOnlyCell: {
    background: "#eef2ff",
    color: "var(--fs-color-primary-strong)",
    fontWeight: 700,
  },
  cellNum: {
    width: "100%",
    border: "1px solid var(--fs-color-border-strong)",
    borderRadius: 8,
    minHeight: 28,
    fontSize: 12,
    padding: "4px 6px",
    textAlign: "right",
    boxSizing: "border-box",
    background: "var(--fs-color-surface-soft)",
    color: "var(--fs-color-text)",
  },
  plus: {
    width: 22,
    height: 22,
    border: "1px solid #93c5fd",
    borderRadius: 999,
    background: "#eff6ff",
    color: "var(--fs-color-primary-strong)",
    fontSize: 14,
    fontWeight: 700,
    lineHeight: "20px",
    textAlign: "center",
    cursor: "pointer",
    padding: 0,
  },
  del: {
    width: "100%",
    border: "1px solid #fecaca",
    borderRadius: 8,
    background: "#fee2e2",
    color: "#b91c1c",
    fontSize: 11,
    fontWeight: 600,
    padding: "5px 6px",
    cursor: "pointer",
  },
  sizeTable: { width: "100%", borderCollapse: "collapse" },
  sTh: {
    border: "1px solid var(--fs-color-border)",
    background: "var(--fs-color-surface-soft)",
    padding: 6,
    fontSize: 12,
    textAlign: "center",
    color: "var(--fs-color-text)",
  },
  sTd: {
    border: "1px solid var(--fs-color-border)",
    background: "#ffffff",
    padding: 5,
    fontSize: 12,
    textAlign: "center",
    color: "var(--fs-color-text)",
  },
  sTdLeft: {
    border: "1px solid var(--fs-color-border)",
    background: "var(--fs-color-surface-soft)",
    padding: 5,
    fontSize: 12,
    textAlign: "left",
    fontWeight: 600,
    color: "var(--fs-color-text)",
  },
  sizeInput: {
    width: 54,
    border: "1px solid var(--fs-color-border-strong)",
    borderRadius: 8,
    minHeight: 26,
    fontSize: 12,
    padding: "3px 5px",
    textAlign: "right",
    background: "var(--fs-color-surface-soft)",
    color: "var(--fs-color-text)",
  },
  sizeSelect: {
    width: 120,
    textAlign: "left",
    paddingLeft: 6,
    paddingRight: 6,
  },
  warn: {
    borderTop: "1px solid #fcd34d",
    background: "#fef3c7",
    color: "#92400e",
    padding: "7px 9px",
    fontSize: 11,
  },
  totalBar: {
    border: "1px solid var(--fs-color-border)",
    borderRadius: 12,
    background: "var(--fs-color-surface)",
    padding: 10,
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  textarea: {
    width: "100%",
    minHeight: 180,
    border: "1px solid var(--fs-color-border-strong)",
    borderRadius: 12,
    background: "var(--fs-color-surface-soft)",
    color: "var(--fs-color-text)",
    padding: 10,
    fontSize: 13,
    boxSizing: "border-box",
    resize: "vertical",
  },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 },
  card: {
    border: "1px solid var(--fs-color-border)",
    borderRadius: 12,
    background: "var(--fs-color-surface)",
    padding: 12,
  },
  cardLabel: { fontSize: 12, color: "var(--fs-color-text-muted)", marginBottom: 6 },
  cardValue: { fontSize: 24, fontWeight: 700, color: "var(--fs-color-text)" },
  empty: {
    border: "1px dashed var(--fs-color-border-strong)",
    borderRadius: 12,
    background: "var(--fs-color-surface-soft)",
    color: "var(--fs-color-text-muted)",
    padding: 12,
    fontSize: 12,
  },
  contextMenu: {
    position: "fixed",
    minWidth: 220,
    border: "1px solid var(--fs-color-border-strong)",
    background: "var(--fs-color-surface)",
    borderRadius: 10,
    overflow: "hidden",
    zIndex: 160,
    boxShadow: "0 20px 35px -18px rgba(15, 23, 42, 0.45)",
  },
  contextMenuItem: {
    width: "100%",
    border: "none",
    borderBottom: "1px solid var(--fs-color-border)",
    background: "var(--fs-color-surface)",
    color: "var(--fs-color-text)",
    fontSize: 12,
    textAlign: "left",
    padding: "8px 10px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  contextMenuHint: {
    color: "var(--fs-color-text-muted)",
    fontSize: 11,
  },
};
