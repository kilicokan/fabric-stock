import React, { useCallback, useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import { buildScaleQueryParams, readScaleSettings, type ScaleReadResponse } from '../lib/scale';

type MotionProps = Record<string, unknown> & { children?: React.ReactNode };

const motion: any = new Proxy({}, {
  get: (_target, tag) => {
    if (typeof tag !== 'string') return undefined;
    return (props: MotionProps) => {
      const { initial, animate, exit, variants, transition, whileHover, whileTap, custom, ...rest } = props || {};
      return React.createElement(tag, rest);
    };
  }
});

const AnimatePresence: React.FC<{ children?: React.ReactNode }> = ({ children }) => <>{children}</>;

interface FabricExitFormData {
  modelNo: string;
  modelName: string;
  orderNo: string;
  customerIds: string[];
  layerCount: number;
  cutPieceCount: number;
  grammage: number;
  externalProductId: string;
  productionKg: number;
  productionMeters: number;
  unitType: 'kg' | 'm';
  cuttingTable: string;
  colors: string[];
  fabricType: string;
  reportNumber: string;
  isAutoReportNumber: boolean;
  pastelEni: number;
  pastelBoyu: number;
  metreKareAgirlik: number;
  pastelAgirlik: number;
  unitWeight: number;
}

interface Product {
  id: number;
  modelNo: string;
  name: string;
  materialTypeId?: number;
  fabricId?: number;
  fabric?: { id: number; name: string };
  groupId?: number;
  taxRateId?: number;
  description?: string;
  image?: string;
  createdAt: Date;
}

interface ExternalProduct {
  id: string;
  code: string;
  description: string;
}

interface CuttingTable {
  id: number;
  name: string;
}

interface LoadingState {
  products: boolean;
  external: boolean;
  submit: boolean;
  scale: boolean;
  cuttingTables: boolean;
}

interface NameOption {
  name: string;
}

interface Customer {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
}

interface CuttingOrderData {
  id: number;
}

interface CuttingSuggestionRequirement {
  resourceType: 'FABRIC' | 'ACCESSORY';
  resourceName: string;
  unit: string;
  requiredQuantity: number;
}

interface CuttingSuggestionItem {
  workOrderId: number;
  orderNo: string;
  productCode: string;
  productName: string;
  color: string;
  customerName: string;
  quantity: number;
  readiness: string;
  requirements: CuttingSuggestionRequirement[];
}

export default function FabricExit() {
  const router = useRouter();

  // ---------- Tema ----------
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    const stored = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const initial = stored || prefers;
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);
  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  };

  // ---------- State'ler ----------
  const [formData, setFormData] = useState<FabricExitFormData>({
    modelNo: '',
    modelName: '',
    orderNo: '',
    customerIds: [],
    layerCount: 1,
    cutPieceCount: 0,
    grammage: 0,
    externalProductId: '',
    productionKg: 0,
    productionMeters: 0,
    unitType: 'kg',
    cuttingTable: '',
    colors: [],
    fabricType: '',
    reportNumber: '',
    isAutoReportNumber: true,
    pastelEni: 0,
    pastelBoyu: 0,
    metreKareAgirlik: 0,
    pastelAgirlik: 0,
    unitWeight: 0,
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [externalProducts, setExternalProducts] = useState<ExternalProduct[]>([]);
  const [cuttingTables, setCuttingTables] = useState<CuttingTable[]>([]);
  const [loading, setLoading] = useState<LoadingState>({
    products: false,
    external: false,
    submit: false,
    scale: false,
    cuttingTables: false
  });
  const [error, setError] = useState<string>('');
  const [manualModelNo, setManualModelNo] = useState<string>('');
  const [manualModelName, setManualModelName] = useState<string>('');
  const [useManualModelNo, setUseManualModelNo] = useState<boolean>(false);

  const [cuttingOrderData, setCuttingOrderData] = useState<CuttingOrderData | null>(null);

  const [showProductModal, setShowProductModal] = useState<boolean>(false);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAutocomplete, setShowAutocomplete] = useState<boolean>(false);

  const [showCustomerModal, setShowCustomerModal] = useState<boolean>(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [selectedCustomers, setSelectedCustomers] = useState<Customer[]>([]);

  const [colorOptions, setColorOptions] = useState<string[]>([]);
  const [fabricTypeOptions, setFabricTypeOptions] = useState<string[]>([]);

  const [showColorModal, setShowColorModal] = useState<boolean>(false);
  const [colorSearchQuery, setColorSearchQuery] = useState<string>('');
  const [filteredColorOptions, setFilteredColorOptions] = useState<string[]>([]);

  const [filteredFabricTypes, setFilteredFabricTypes] = useState<string[]>([]);
  const [showFabricTypeAutocomplete, setShowFabricTypeAutocomplete] = useState<boolean>(false);

  const [cuttingSuggestions, setCuttingSuggestions] = useState<CuttingSuggestionItem[]>([]);
  const [filteredOrderSuggestions, setFilteredOrderSuggestions] = useState<CuttingSuggestionItem[]>([]);
  const [showOrderAutocomplete, setShowOrderAutocomplete] = useState<boolean>(false);
  const [selectedCuttingSuggestion, setSelectedCuttingSuggestion] = useState<CuttingSuggestionItem | null>(null);
  const [loadingCuttingSuggestions, setLoadingCuttingSuggestions] = useState<boolean>(false);

  // ---------- Yardımcılar ----------
  const getAuthHeaders = (): { Authorization: string } | undefined => {
    if (typeof window === 'undefined') return undefined;
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  };

  // ---------- Veri yükleme ----------
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(prev => ({ ...prev, products: true }));
        setLoadingCuttingSuggestions(true);
        setError('');
        const headers = getAuthHeaders();
        const [productsRes, colorsRes, fabricsRes, customersRes, cuttingSuggestionsRes] = await Promise.allSettled([
          axios.get<Product[]>('/api/products', { headers }),
          axios.get<NameOption[]>('/api/colors'),
          axios.get<NameOption[]>('/api/fabrics'),
          axios.get<Customer[]>('/api/customers', { headers }),
          axios.get('/api/fason/cutting-suggestions', { headers })
        ]);

        const extractArray = <T,>(result: PromiseSettledResult<unknown>): T[] => {
          if (result.status !== 'fulfilled') return [];
          const payload = result.value as { data?: unknown };
          if (Array.isArray(payload?.data)) return payload.data as T[];
          if (payload?.data && typeof payload.data === 'object' && Array.isArray((payload.data as { rows?: unknown }).rows)) {
            return ((payload.data as { rows: T[] }).rows) || [];
          }
          if (Array.isArray(payload)) return payload as T[];
          return [];
        };

        const productsData = extractArray<Product>(productsRes);
        const colorsData = extractArray<NameOption>(colorsRes);
        const fabricsData = extractArray<NameOption>(fabricsRes);
        const customersData = extractArray<Customer>(customersRes);
        const rawSuggestionRows = extractArray<Record<string, unknown>>(cuttingSuggestionsRes);

        const normalizedSuggestions = rawSuggestionRows
          .map((row: {
            workOrderId?: unknown;
            orderNo?: unknown;
            productCode?: unknown;
            productName?: unknown;
            color?: unknown;
            customerName?: unknown;
            quantity?: unknown;
            readiness?: unknown;
            requirements?: unknown[];
          }) => {
            const workOrderId = Number(row.workOrderId);
            const orderNo = typeof row.orderNo === 'string' ? row.orderNo.trim() : '';
            if (!Number.isInteger(workOrderId) || !orderNo) {
              return null;
            }

            const requirements: CuttingSuggestionRequirement[] = Array.isArray(row.requirements)
              ? row.requirements
                  .map((requirement) => {
                    const rawRequirement = requirement as {
                      resourceType?: unknown;
                      resourceName?: unknown;
                      unit?: unknown;
                      requiredQuantity?: unknown;
                    };
                    const resourceType: CuttingSuggestionRequirement['resourceType'] =
                      rawRequirement.resourceType === 'ACCESSORY' ? 'ACCESSORY' : 'FABRIC';
                    return {
                      resourceType,
                      resourceName: typeof rawRequirement.resourceName === 'string' ? rawRequirement.resourceName : '',
                      unit: typeof rawRequirement.unit === 'string' ? rawRequirement.unit : '',
                      requiredQuantity: Number(rawRequirement.requiredQuantity) || 0
                    };
                  })
                  .filter((requirement) => requirement.resourceName)
              : [];

            return {
              workOrderId,
              orderNo,
              productCode: typeof row.productCode === 'string' ? row.productCode : '',
              productName: typeof row.productName === 'string' ? row.productName : '',
              color: typeof row.color === 'string' ? row.color : '',
              customerName: typeof row.customerName === 'string' ? row.customerName : '',
              quantity: Number(row.quantity) || 0,
              readiness: typeof row.readiness === 'string' ? row.readiness : '',
              requirements
            } satisfies CuttingSuggestionItem;
          })
          .filter((item): item is CuttingSuggestionItem => item !== null)
          .sort((a, b) => {
            const aPriority = a.readiness === 'READY' ? 0 : 1;
            const bPriority = b.readiness === 'READY' ? 0 : 1;
            if (aPriority !== bPriority) {
              return aPriority - bPriority;
            }
            return a.orderNo.localeCompare(b.orderNo, 'tr', { sensitivity: 'base' });
          });

        setProducts(productsData);
        setColorOptions(colorsData.map((c) => c.name));
        setFabricTypeOptions(fabricsData.map((f) => f.name));
        setCustomers(customersData);
        setFilteredCustomers(customersData);
        setCuttingSuggestions(normalizedSuggestions);

        const loadIssues = [
          productsRes.status === 'rejected' ? 'modeller' : '',
          customersRes.status === 'rejected' ? 'müşteriler' : '',
          colorsRes.status === 'rejected' ? 'renkler' : '',
          fabricsRes.status === 'rejected' ? 'kumaş türleri' : '',
          cuttingSuggestionsRes.status === 'rejected' ? 'kesim önerileri' : ''
        ].filter(Boolean);

        if (loadIssues.length > 0) {
          setError(`${loadIssues.join(', ')} yüklenemedi, diğer alanlar getirildi.`);
        }
      } catch (err) {
        setError('Veriler yüklenemedi');
        console.error(err);
      } finally {
        setLoading(prev => ({ ...prev, products: false }));
        setLoadingCuttingSuggestions(false);
      }
    };
    fetchData();
  }, []);

  // Model No değiştiğinde otomatik fabric type ve model name
  useEffect(() => {
    if (useManualModelNo && formData.modelNo && products.length > 0) {
      const selectedProduct = products.find(p => p.modelNo === formData.modelNo);
      if (selectedProduct) {
        setFormData(prev => ({
          ...prev,
          fabricType: selectedProduct.fabric?.name || '',
          modelName: selectedProduct.name || ''
        }));
        setManualModelName(selectedProduct.name || '');
      }
    }
  }, [formData.modelNo, useManualModelNo, products]);

  // Kesim masaları
  useEffect(() => {
    const fetchCuttingTables = async () => {
      try {
        setLoading(prev => ({ ...prev, cuttingTables: true }));
        const response = await axios.get('/api/cutting-tables');
        setCuttingTables(response.data.data);
      } catch (err) {
        setError('Kesim masaları yüklenemedi');
        console.error(err);
      } finally {
        setLoading(prev => ({ ...prev, cuttingTables: false }));
      }
    };
    fetchCuttingTables();
  }, []);

  // ---------- Pastel ağırlık otomatik hesaplama ----------
  useEffect(() => {
    const { pastelEni, pastelBoyu, metreKareAgirlik } = formData;
    if (pastelEni > 0 && pastelBoyu > 0 && metreKareAgirlik > 0) {
      const agirlik = (pastelEni * pastelBoyu * metreKareAgirlik) / 1000;
      setFormData(prev => ({ ...prev, pastelAgirlik: Number(agirlik.toFixed(2)) }));
    } else {
      setFormData(prev => ({ ...prev, pastelAgirlik: 0 }));
    }
  }, [formData.pastelEni, formData.pastelBoyu, formData.metreKareAgirlik]);

  useEffect(() => {
    const quantity = formData.unitType === 'kg' ? formData.productionKg : formData.productionMeters;
    if (quantity > 0 && formData.cutPieceCount > 0) {
      const calculated = quantity / formData.cutPieceCount;
      setFormData(prev => ({ ...prev, unitWeight: Number(calculated.toFixed(3)) }));
    } else {
      setFormData(prev => ({ ...prev, unitWeight: 0 }));
    }
  }, [formData.unitType, formData.productionKg, formData.productionMeters, formData.cutPieceCount]);

  // ---------- Olay işleyiciler ----------
  const fetchExternalProducts = async () => {
    try {
      setLoading(prev => ({ ...prev, external: true }));
      setError('');
      const response = await axios.get<ExternalProduct[]>('/api/external-products');
      setExternalProducts(response.data);
    } catch (err) {
      setError('Dış sistem ürünleri alınamadı');
      console.error(err);
    } finally {
      setLoading(prev => ({ ...prev, external: false }));
    }
  };

  const handleScaleData = async () => {
    if (formData.unitType !== 'kg') {
      alert('Kg birimi seçili olmalıdır.');
      return;
    }
    try {
      setLoading(prev => ({ ...prev, scale: true }));
      const { data } = await axios.get<ScaleReadResponse>('/api/scale', {
        params: buildScaleQueryParams(readScaleSettings()),
      });

      if (data.ok === false) {
        const failure = data as { error?: string };
        alert(failure.error || 'Tartıdan veri alınamadı!');
        return;
      }

      setFormData(prev => ({ ...prev, productionKg: Number(data.weight) }));
    } catch (err) {
      alert('Tartıdan veri alınamadı!');
      console.error(err);
    } finally {
      setLoading(prev => ({ ...prev, scale: false }));
    }
  };

  const fetchCuttingOrderData = async (reportNumber: string) => {
    if (!reportNumber.trim()) {
      setCuttingOrderData(null);
      return;
    }

    try {
      const response = await axios.get(`/api/fabric-exits?reportNumber=${encodeURIComponent(reportNumber)}`);
      const responseData = response.data?.data || response.data || [];
      if (responseData && responseData.length > 0) {
        setCuttingOrderData(responseData[0]);
      } else {
        setCuttingOrderData(null);
      }
    } catch (error) {
      console.error('Kesim emri verisi alınırken hata:', error);
      setCuttingOrderData(null);
    }
  };

  const isMeterUnit = (unit: string): boolean => {
    const normalized = unit.toLowerCase().replace(/\s+/g, '');
    return normalized.includes('m') && !normalized.includes('kg');
  };

  const handleOrderNoAutocomplete = (value: string) => {
    const trimmedValue = value.trim();
    const normalizedQuery = trimmedValue.toLowerCase();
    const selectedOrderNo = selectedCuttingSuggestion?.orderNo?.toLowerCase();
    if (!normalizedQuery || selectedOrderNo !== normalizedQuery) {
      setSelectedCuttingSuggestion(null);
    }

    if (!trimmedValue) {
      setFilteredOrderSuggestions([]);
      setShowOrderAutocomplete(false);
      return;
    }

    const filtered = cuttingSuggestions.filter((suggestion) =>
      suggestion.orderNo.toLowerCase().includes(normalizedQuery)
    );
    setFilteredOrderSuggestions(filtered.slice(0, 8));
    setShowOrderAutocomplete(filtered.length > 0);
  };

  const handleCuttingSuggestionSelect = useCallback((suggestion: CuttingSuggestionItem) => {
    const matchedCustomers: Customer[] = [];
    const normalizedCustomerName = suggestion.customerName.trim().toLowerCase();

    if (normalizedCustomerName) {
      const existingCustomer = customers.find(
        (customer) => customer.name.trim().toLowerCase() === normalizedCustomerName
      );
      if (existingCustomer) {
        matchedCustomers.push(existingCustomer);
      } else {
        matchedCustomers.push({
          id: -suggestion.workOrderId,
          name: suggestion.customerName.trim()
        });
      }
    }

    const primaryFabricRequirement = suggestion.requirements.find(
      (requirement) => requirement.resourceType === 'FABRIC'
    );

    const hasRequirementQuantity =
      primaryFabricRequirement && Number(primaryFabricRequirement.requiredQuantity) > 0;
    const requirementQuantity = Number(primaryFabricRequirement?.requiredQuantity || 0);
    const useMeter = hasRequirementQuantity && isMeterUnit(primaryFabricRequirement?.unit || '');

    setSelectedCustomers(matchedCustomers);
    setFormData((prev) => ({
      ...prev,
      orderNo: suggestion.orderNo,
      modelNo: suggestion.productCode || prev.modelNo,
      modelName: suggestion.productName || prev.modelName,
      customerIds: matchedCustomers.length > 0 ? matchedCustomers.map((customer) => customer.name) : prev.customerIds,
      colors: suggestion.color ? [suggestion.color] : prev.colors,
      fabricType: primaryFabricRequirement?.resourceName || prev.fabricType,
      unitType: hasRequirementQuantity ? (useMeter ? 'm' : 'kg') : prev.unitType,
      productionKg: hasRequirementQuantity ? (useMeter ? 0 : requirementQuantity) : prev.productionKg,
      productionMeters: hasRequirementQuantity ? (useMeter ? requirementQuantity : 0) : prev.productionMeters,
      cutPieceCount: suggestion.quantity > 0 ? suggestion.quantity : prev.cutPieceCount
    }));

    setSelectedCuttingSuggestion(suggestion);
    setShowOrderAutocomplete(false);
  }, [customers]);

  // URL parametresinden gelen siparişi otomatik seç
  useEffect(() => {
    if (!cuttingSuggestions.length) return;
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const orderNo = params.get('orderNo');
    const workOrderId = params.get('workOrderId');
    if (!orderNo && !workOrderId) return;

    const matched = cuttingSuggestions.find(s => {
      if (workOrderId && Number.isFinite(Number(workOrderId)) && s.workOrderId === Number(workOrderId)) return true;
      if (orderNo && orderNo.trim().length > 0 && s.orderNo.trim().toLowerCase() === orderNo.trim().toLowerCase()) return true;
      return false;
    });

    if (matched) {
      handleCuttingSuggestionSelect(matched);
    }
  }, [cuttingSuggestions, handleCuttingSuggestionSelect]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]:
        name === 'layerCount' ||
        name === 'cutPieceCount' ||
        name === 'grammage' ||
        name === 'productionKg' ||
        name === 'productionMeters' ||
        name === 'pastelEni' ||
        name === 'pastelBoyu' ||
        name === 'metreKareAgirlik'
          ? Number(value)
          : value
    }));

    if (name === 'modelNo' && !useManualModelNo) {
      handleModelNoChange(value);
    }

    if (name === 'orderNo') {
      handleOrderNoAutocomplete(value);
    }

    if (name === 'reportNumber') {
      fetchCuttingOrderData(value);
    }
  };

  const handleModelNoChange = (value: string) => {
    if (value.length > 0) {
      const filtered = products.filter(product =>
        product.modelNo.toLowerCase().includes(value.toLowerCase()) ||
        product.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredProducts(filtered.slice(0, 5));
      setShowAutocomplete(filtered.length > 0);
    } else {
      setShowAutocomplete(false);
    }
  };

  const generateReportNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `RPT-${year}${month}${day}-${hours}${minutes}${seconds}`;
  };

  const handleFabricTypeChange = (value: string) => {
    if (value.length > 0) {
      const filtered = fabricTypeOptions.filter(type =>
        type.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredFabricTypes(filtered.slice(0, 5));
      setShowFabricTypeAutocomplete(filtered.length > 0);
    } else {
      setShowFabricTypeAutocomplete(false);
    }
  };

  const handleProductSelect = (product: Product) => {
    setFormData(prev => ({
      ...prev,
      modelNo: product.modelNo,
      modelName: product.name,
      fabricType: product.fabric?.name || ''
    }));
    setShowAutocomplete(false);
  };

  const handleAddColor = (color: string) => {
    if (!formData.colors.includes(color)) {
      setFormData(prev => ({
        ...prev,
        colors: [...prev.colors, color]
      }));
    }
  };

  const handleRemoveColor = (colorToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      colors: prev.colors.filter(color => color !== colorToRemove)
    }));
  };

  const handleFabricTypeSelect = (fabricType: string) => {
    setFormData(prev => ({
      ...prev,
      fabricType: fabricType
    }));
    setShowFabricTypeAutocomplete(false);
  };

  const handleShowProductModal = () => {
    setShowProductModal(true);
    setFilteredProducts(products);
    setSearchQuery('');
  };

  const handleModalProductSelect = (product: Product) => {
    setFormData(prev => ({
      ...prev,
      modelNo: product.modelNo,
      modelName: product.name,
      fabricType: product.fabric?.name || ''
    }));
    setShowProductModal(false);
  };

  const handleModalSearch = (query: string) => {
    setSearchQuery(query);
    if (query.length > 0) {
      const filtered = products.filter(product =>
        product.modelNo.toLowerCase().includes(query.toLowerCase()) ||
        product.name.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(products);
    }
  };

  const handleCustomerModalSearch = (query: string) => {
    setCustomerSearchQuery(query);
    if (query.length > 0) {
      const filtered = customers.filter(customer =>
        customer.name.toLowerCase().includes(query.toLowerCase()) ||
        (customer.phone && customer.phone.includes(query)) ||
        (customer.email && customer.email.toLowerCase().includes(query.toLowerCase()))
      );
      setFilteredCustomers(filtered);
    } else {
      setFilteredCustomers(customers);
    }
  };

  const handleCustomerSelect = (customer: Customer) => {
    if (!selectedCustomers.some(c => c.id === customer.id)) {
      const newSelectedCustomers = [...selectedCustomers, customer];
      setSelectedCustomers(newSelectedCustomers);
      setFormData(prev => ({
        ...prev,
        customerIds: newSelectedCustomers.map(c => c.name)
      }));
    }
    setShowCustomerModal(false);
  };

  const handleRemoveCustomer = (customerId: number) => {
    const newSelectedCustomers = selectedCustomers.filter(c => c.id !== customerId);
    setSelectedCustomers(newSelectedCustomers);
    setFormData(prev => ({
      ...prev,
      customerIds: newSelectedCustomers.map(c => c.name)
    }));
  };

  const handleManualModelNoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setManualModelNo(value);
    setFormData(prev => ({ ...prev, modelNo: value }));
  };

  const handleManualModelNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setManualModelName(value);
    setFormData(prev => ({ ...prev, modelName: value }));
  };

  const toggleManualModelNo = () => {
    setUseManualModelNo(!useManualModelNo);
    if (!useManualModelNo) {
      setFormData(prev => ({
        ...prev,
        modelNo: '',
        modelName: '',
        fabricType: '',
        reportNumber: '',
        isAutoReportNumber: true,
        pastelEni: 0,
        pastelBoyu: 0,
        metreKareAgirlik: 0,
        pastelAgirlik: 0,
      }));
      setManualModelNo('');
      setManualModelName('');
    }
  };

  const toggleAutoReportNumber = () => {
    const newIsAuto = !formData.isAutoReportNumber;
    setFormData(prev => ({
      ...prev,
      isAutoReportNumber: newIsAuto,
      reportNumber: newIsAuto ? generateReportNumber() : ''
    }));
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value as 'kg' | 'm';
    setFormData(prev => ({
      ...prev,
      unitType: value,
      ...(value === 'kg' ? { productionMeters: 0 } : { productionKg: 0 })
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!formData.reportNumber.trim()) {
      setError('Rapor Numarası girilmelidir.');
      return;
    }
    if (!formData.modelNo.trim()) {
      setError('Model No girilmelidir.');
      return;
    }
    if (!formData.modelName.trim()) {
      setError('Model Adı girilmelidir.');
      return;
    }
    if (!formData.orderNo.trim()) {
      setError('Sipariş No girilmelidir.');
      return;
    }
    if (formData.customerIds.length === 0) {
      setError('En az bir müşteri seçilmelidir.');
      return;
    }
    if ((formData.unitType === 'kg' && formData.productionKg <= 0) || (formData.unitType === 'm' && formData.productionMeters <= 0)) {
      setError('Üretim miktarı girilmelidir.');
      return;
    }
    if (!formData.cuttingTable) {
      setError('Kesim masası seçilmelidir.');
      return;
    }
    if (formData.colors.length === 0) {
      setError('En az bir renk seçilmelidir.');
      return;
    }
    if (!formData.fabricType) {
      setError('Kumaş türü seçilmelidir.');
      return;
    }
    if (formData.externalProductId && !externalProducts.some(p => p.id === formData.externalProductId)) {
      setError('Geçerli bir dış sistem ürün ID seçilmelidir.');
      return;
    }

    const normalizedOrderNo = formData.orderNo.trim().toLowerCase();
    const linkedSuggestion =
      selectedCuttingSuggestion && selectedCuttingSuggestion.orderNo.toLowerCase() === normalizedOrderNo
        ? selectedCuttingSuggestion
        : cuttingSuggestions.find((suggestion) => suggestion.orderNo.toLowerCase() === normalizedOrderNo) || null;
    const resolvedCutPieceCount =
      formData.cutPieceCount > 0
        ? Math.round(formData.cutPieceCount)
        : linkedSuggestion?.quantity || null;

    if (linkedSuggestion && (!resolvedCutPieceCount || resolvedCutPieceCount <= 0)) {
      setError('Kesilen adet girilmelidir.');
      return;
    }

    try {
      setLoading(prev => ({ ...prev, submit: true }));
      setError('');
      console.log('Gönderilen formData:', formData);
      const response = await axios.post('/api/fabric-exit', {
        ...formData,
        workOrderId: linkedSuggestion?.workOrderId || null,
        cutPieceCount: resolvedCutPieceCount,
        createdAt: new Date().toISOString()
      });
      console.log('API yanıtı:', response.data);

      if (cuttingOrderData) {
        try {
          await axios.put(`/api/fabric-exits/${cuttingOrderData.id}`, {
            modelNo: formData.modelNo,
            modelName: formData.modelName,
            orderNo: formData.orderNo,
            customerId: formData.customerIds.join(', '),
            color: formData.colors.join(', '),
            fabricType: formData.fabricType,
            cuttingTable: formData.cuttingTable,
            layerCount: formData.layerCount,
            grammage: formData.grammage,
            unitType: formData.unitType,
            productWeightKg: formData.productionKg,
            productLengthMeter: formData.productionMeters,
            reportNumber: formData.reportNumber,
            pastelEni: formData.pastelEni,
            pastelBoyu: formData.pastelBoyu,
            metreKareAgirlik: formData.metreKareAgirlik,
            pastelAgirlik: formData.pastelAgirlik,
          });
        } catch (updateError) {
          console.error('Kesim emri güncellenirken hata:', updateError);
        }
      }

      router.push('/success');
    } catch (err: unknown) {
      console.error('Gönderme hatası:', err);
      const fallbackError = 'Kayıt işlemi başarısız oldu. Lütfen verileri kontrol edin.';
      if (axios.isAxiosError<{ error?: string }>(err)) {
        setError(err.response?.data?.error || fallbackError);
      } else {
        setError(fallbackError);
      }
    } finally {
      setLoading(prev => ({ ...prev, submit: false }));
    }
  };

  // ---------- Dışa aktarma ----------
const exportToPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default as unknown as (
      doc: unknown,
      options: Record<string, unknown>
    ) => void;

    const A4_WIDTH = 210;
    const MARGIN = 10;

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();

    const usableWidth = pageWidth - MARGIN * 2;

    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text('Kumaş Çıkış Raporu', MARGIN, 12);

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Rapor Numarası: ${formData.reportNumber || 'Belirtilmemiş'}`, MARGIN, 18);
    doc.text(`Oluşturulma Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, MARGIN, 22);

    const tableData: string[][] = [
      ['Model No', formData.modelNo || '-'],
      ['Model Adı', formData.modelName || '-'],
      ['Sipariş No', formData.orderNo || '-'],
      ['Müşteriler', formData.customerIds.join(', ') || '-'],
      ['Kat Sayısı', formData.layerCount.toString()],
      ['Gramaj (g/m²)', formData.grammage.toString()],
      ['Birim Gramaj', formData.unitWeight > 0 ? `${formData.unitWeight} g/parça` : '-'],
      ['Kumaş Türü', formData.fabricType || '-'],
      ['Renkler', formData.colors.join(', ') || '-'],
      ['Kesim Masası', formData.cuttingTable || '-'],
      ['Üretim Miktarı', formData.unitType === 'kg' ? `${formData.productionKg} kg` : `${formData.productionMeters} m`],
      ['Birim Tipi', formData.unitType === 'kg' ? 'Kg' : 'Metre'],
      ['Pastal Eni (cm)', formData.pastelEni > 0 ? formData.pastelEni.toString() : '-'],
      ['Pastal Boyu (cm)', formData.pastelBoyu > 0 ? formData.pastelBoyu.toString() : '-'],
      ['Metre Kare Ağırlık (g/m²)', formData.metreKareAgirlik > 0 ? formData.metreKareAgirlik.toString() : '-'],
      ['Pastal Ağırlık', formData.pastelAgirlik > 0 ? formData.pastelAgirlik.toString() : '-'],
    ];

    autoTable(doc, {
      startY: 27,
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: [79, 70, 229], cellWidth: usableWidth * 0.4 },
        1: { fillColor: [240, 240, 240], cellWidth: usableWidth * 0.6 },
      },
      margin: { left: MARGIN, right: MARGIN },
      tableWidth: usableWidth,
    });

    doc.save(`kumas-cikis-raporu-${formData.reportNumber || 'yeni'}.pdf`);
  };

  const exportToExcel = async () => {
    const XLSX = await import('xlsx');
    const data = [{
      'Rapor Numarası': formData.reportNumber,
      'Model No': formData.modelNo,
      'Model Adı': formData.modelName,
      'Sipariş No': formData.orderNo,
      'Müşteriler': formData.customerIds.join(', '),
      'Kat Sayısı': formData.layerCount,
      'Gramaj': formData.grammage,
      'Birim Gramaj': formData.unitWeight,
      'Kumaş Türü': formData.fabricType,
      'Renkler': formData.colors.join(', '),
      'Kesim Masası': formData.cuttingTable,
      'Üretim Miktarı': formData.unitType === 'kg' ? formData.productionKg : formData.productionMeters,
      'Birim': formData.unitType === 'kg' ? 'kg' : 'm',
      'Pastal Eni': formData.pastelEni,
      'Pastal Boyu': formData.pastelBoyu,
      'Metre Kare Ağırlık': formData.metreKareAgirlik,
      'Pastal Ağırlık': formData.pastelAgirlik,
      'Tarih': new Date().toISOString().split('T')[0]
    }];
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Kumaş Çıkış');
    XLSX.writeFile(workbook, `kumas-cikis-raporu-${formData.reportNumber || 'yeni'}.xlsx`);
  };

  const exportToCSV = () => {
  const headers = ['Rapor Numarası', 'Model No', 'Model Adı', 'Sipariş No', 'Müşteriler', 'Kat Sayısı', 'Gramaj', 'Birim Gramaj', 'Kumaş Türü', 'Renkler', 'Kesim Masası', 'Üretim Miktarı', 'Birim', 'Pastal Eni', 'Pastal Boyu', 'Metre Kare Ağırlık', 'Pastal Ağırlık', 'Tarih'];
  const values = [
    formData.reportNumber,
    formData.modelNo,
    formData.modelName,
    formData.orderNo,
    formData.customerIds.join('; '),
    formData.layerCount.toString(),
    formData.grammage.toString(),
    formData.unitWeight.toString(),
    formData.fabricType,
    formData.colors.join('; '),
    formData.cuttingTable,
    (formData.unitType === 'kg' ? formData.productionKg : formData.productionMeters).toString(),
    formData.unitType === 'kg' ? 'kg' : 'm',
    formData.pastelEni.toString(),
    formData.pastelBoyu.toString(),
    formData.metreKareAgirlik.toString(),
    formData.pastelAgirlik.toString(),
    new Date().toISOString().split('T')[0]
  ];
    const csvContent = [headers.join(','), values.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `kumas-cikis-raporu-${formData.reportNumber || 'yeni'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ---------- Animasyon varyantları ----------
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }
  };

  const rowVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: { delay: i * 0.07, duration: 0.3, ease: 'easeOut' }
    })
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 10 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
    exit: { opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.2, ease: 'easeIn' } }
  };

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, transition: { duration: 0.2 } }
  };

  // ---------- JSX ----------
  return (
    <motion.div
      style={styles.container}
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <div style={styles.header}>
        <motion.h1
          style={styles.title}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          📤 Kumaş Çıkış Formu
        </motion.h1>
        <div style={styles.headerActions}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleTheme}
            style={styles.themeToggle}
            title="Temayı değiştir"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </motion.button>
          <div style={styles.exportButtons}>
            <motion.button
              whileHover={{ scale: 1.02, backgroundColor: '#e0f2fe' }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={exportToPDF}
              style={styles.exportButton}
              title="PDF'e Aktar"
            >
              📄 PDF
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02, backgroundColor: '#e0f2fe' }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={exportToExcel}
              style={styles.exportButton}
              title="Excel'e Aktar"
            >
              📊 Excel
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02, backgroundColor: '#e0f2fe' }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={exportToCSV}
              style={styles.exportButton}
              title="CSV'ye Aktar"
            >
              📋 CSV
            </motion.button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={styles.error}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.form
        onSubmit={handleSubmit}
        style={styles.form}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* 1. Satır — Rapor Bilgileri */}
        <motion.div style={styles.sectionCard} custom={0} variants={rowVariants}>
          <div style={styles.sectionHeader}>
            <div style={styles.sectionIcon}>📋</div>
            <span>Rapor Bilgileri</span>
          </div>
          <motion.div style={styles.row} custom={0} variants={rowVariants}>
            <div style={styles.inputGroup}>
              <div style={styles.reportNumberHeader}>
                <label style={styles.label}>Rapor Numarası</label>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={toggleAutoReportNumber}
                  style={formData.isAutoReportNumber ? styles.autoButtonActive : styles.autoButton}
                >
                  {formData.isAutoReportNumber ? '🔄 Otomatik' : '✏️ Manuel'}
                </motion.button>
              </div>
              <input
                type="text"
                name="reportNumber"
                value={formData.reportNumber}
                onChange={handleChange}
                style={styles.input}
                placeholder={formData.isAutoReportNumber ? "Otomatik oluşturulacak..." : "Rapor numarasını girin..."}
                required
                readOnly={formData.isAutoReportNumber}
              />
            </div>

            <div style={styles.inputGroup}>
              <div style={styles.modelNoHeader}>
                <label style={styles.label}>Model No</label>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={toggleManualModelNo}
                  style={useManualModelNo ? styles.manualButtonActive : styles.manualButton}
                >
                  {useManualModelNo ? '📝 Manuel' : '📋 Listeden Seç'}
                </motion.button>
              </div>
              {useManualModelNo ? (
                <>
                  <input
                    type="text"
                    value={manualModelNo}
                    onChange={handleManualModelNoChange}
                    style={styles.input}
                    placeholder="Model numarasını yazın..."
                    required
                  />
                  <input
                    type="text"
                    value={manualModelName}
                    onChange={handleManualModelNameChange}
                    style={styles.input}
                    placeholder="Model adını yazın..."
                    required
                  />
                </>
              ) : (
                <div style={styles.inputWithAutocomplete}>
                  <input
                    type="text"
                    name="modelNo"
                    value={formData.modelNo}
                    onChange={handleChange}
                    style={styles.input}
                    placeholder="Model numarası yazın veya listeden seçin..."
                    required
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={handleShowProductModal}
                    style={styles.listButton}
                    title="Ürün listesinden seç"
                  >
                    📋
                  </motion.button>

                  <AnimatePresence>
                    {showAutocomplete && filteredProducts.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        style={styles.autocompleteDropdown}
                      >
                        {filteredProducts.map(product => (
                          <motion.div
                            key={product.id}
                            style={styles.autocompleteItem}
                            onClick={() => handleProductSelect(product)}
                            whileHover={{ backgroundColor: 'var(--fs-color-surface-hover)' }}
                          >
                            <div style={styles.autocompleteModelNo}>{product.modelNo}</div>
                            <div style={styles.autocompleteName}>{product.name}</div>
                            {product.fabric && (
                              <div style={styles.autocompleteFabricType}>
                                Kumaş: {product.fabric.name}
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Model Adı</label>
              <input
                type="text"
                name="modelName"
                value={formData.modelName}
                onChange={handleChange}
                style={styles.input}
                placeholder="Model adı..."
                required
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Kumaş Türü</label>
              <div style={styles.inputWithAutocomplete}>
                <input
                  type="text"
                  name="fabricType"
                  value={formData.fabricType}
                  onChange={(e) => {
                    handleChange(e);
                    handleFabricTypeChange(e.target.value);
                  }}
                  style={styles.input}
                  placeholder="Kumaş türü yazın veya listeden seçin..."
                  required
                />
                <AnimatePresence>
                  {showFabricTypeAutocomplete && filteredFabricTypes.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      style={styles.fabricTypeAutocompleteDropdown}
                    >
                      {filteredFabricTypes.map(type => (
                        <motion.div
                          key={type}
                          style={styles.autocompleteItem}
                          onClick={() => handleFabricTypeSelect(type)}
                          whileHover={{ backgroundColor: 'var(--fs-color-surface-hover)' }}
                        >
                          {type}
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* 2. Satır — Sipariş Bilgileri */}
        <motion.div style={styles.sectionCard} custom={1} variants={rowVariants}>
          <div style={styles.sectionHeader}>
            <div style={styles.sectionIcon}>📦</div>
            <span>Sipariş Bilgileri</span>
          </div>
          <motion.div style={styles.row} custom={1} variants={rowVariants}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Sipariş No</label>
              <div style={styles.inputWithAutocomplete}>
                <input
                  type="text"
                  name="orderNo"
                  value={formData.orderNo}
                  onChange={handleChange}
                  onFocus={() => handleOrderNoAutocomplete(formData.orderNo)}
                  onBlur={() => {
                    setTimeout(() => {
                      setShowOrderAutocomplete(false);
                    }, 120);
                  }}
                  style={styles.input}
                  placeholder="Kesim iş emri no yazın veya seçin..."
                  required
                />
                <AnimatePresence>
                  {showOrderAutocomplete && filteredOrderSuggestions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      style={styles.orderAutocompleteDropdown}
                    >
                      {filteredOrderSuggestions.map((suggestion) => (
                        <motion.div
                          key={`${suggestion.workOrderId}-${suggestion.orderNo}`}
                          style={styles.autocompleteItem}
                          onClick={() => handleCuttingSuggestionSelect(suggestion)}
                          whileHover={{ backgroundColor: 'var(--fs-color-surface-hover)' }}
                        >
                          <div style={styles.autocompleteModelNo}>{suggestion.orderNo}</div>
                          <div style={styles.autocompleteName}>
                            {suggestion.productCode} | {suggestion.productName}
                          </div>
                          <div style={styles.orderAutocompleteMeta}>
                            Renk: {suggestion.color || '-'} | Adet: {suggestion.quantity} | Durum: {suggestion.readiness || '-'}
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {loadingCuttingSuggestions && (
                <div style={styles.orderAutocompleteHint}>Kesim önerilerinden iş emri listesi yükleniyor...</div>
              )}
              {selectedCuttingSuggestion && selectedCuttingSuggestion.orderNo === formData.orderNo && (
                <div style={styles.orderAutocompleteHint}>
                  Seçili iş emri: {selectedCuttingSuggestion.orderNo} ({selectedCuttingSuggestion.quantity} adet)
                </div>
              )}
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Müşteriler</label>
              <div style={styles.customerSelection}>
                <div style={styles.selectedCustomers}>
                  {selectedCustomers.map(customer => (
                    <motion.div
                      key={customer.id}
                      style={styles.customerTag}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                    >
                      <span>{customer.name}</span>
                      <motion.button
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        type="button"
                        onClick={() => handleRemoveCustomer(customer.id)}
                        style={styles.removeButton}
                        title="Müşteriyi kaldır"
                      >
                        ×
                      </motion.button>
                    </motion.div>
                  ))}
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => setShowCustomerModal(true)}
                  style={styles.addCustomerButton}
                  title="Müşteri ekle"
                >
                  ➕ Müşteri Ekle
                </motion.button>
              </div>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Kat Sayısı</label>
              <input
                type="number"
                name="layerCount"
                value={formData.layerCount}
                onChange={handleChange}
                style={styles.input}
                min={1}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Kesilen Adet</label>
              <input
                type="number"
                name="cutPieceCount"
                value={formData.cutPieceCount}
                onChange={handleChange}
                style={styles.input}
                min={0}
                step={1}
                placeholder="Örn: 900"
              />
            </div>
          </motion.div>
        </motion.div>

        {/* 3. Satır — Kesim Bilgileri */}
        <motion.div style={styles.sectionCard} custom={2} variants={rowVariants}>
          <div style={styles.sectionHeader}>
            <div style={styles.sectionIcon}>✂️</div>
            <span>Kesim Bilgileri</span>
          </div>
          <motion.div style={styles.row} custom={2} variants={rowVariants}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Gramaj (g/m²)</label>
              <input
                type="number"
                name="grammage"
                value={formData.grammage}
                onChange={handleChange}
                style={styles.input}
                step={0.01}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Birim Gramaj (g/parça)</label>
              <input
                type="number"
                value={formData.unitWeight || ''}
                readOnly
                style={{ ...styles.input, backgroundColor: 'var(--fs-color-surface-soft)', opacity: 0.8 }}
                step="0.001"
                placeholder="Otomatik hesaplanır"
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Model No (Dış Sistem)</label>
              <div style={styles.selectWithButton}>
                <select
                  name="externalProductId"
                  value={formData.externalProductId}
                  onChange={handleChange}
                  style={styles.select}
                >
                  <option value="">Seçiniz</option>
                  {externalProducts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.description}
                    </option>
                  ))}
                </select>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={fetchExternalProducts}
                  style={loading.external ? {...styles.fetchButton, ...styles.fetchButtonLoading} : styles.fetchButton}
                  disabled={loading.external}
                >
                  {loading.external ? '...' : 'Getir'}
                </motion.button>
              </div>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Kesim Masası</label>
              <select
                name="cuttingTable"
                value={formData.cuttingTable}
                onChange={handleChange}
                style={loading.cuttingTables ? {...styles.select, ...styles.disabled} : styles.select}
                required
                disabled={loading.cuttingTables}
              >
                <option value="">Seçiniz</option>
                {cuttingTables.map(table => (
                  <option key={table.id} value={table.id.toString()}>
                    {table.name}
                  </option>
                ))}
              </select>
            </div>
          </motion.div>
        </motion.div>

        {/* 4. Satır — Üretim Bilgileri */}
        <motion.div style={styles.sectionCard} custom={3} variants={rowVariants}>
          <div style={styles.sectionHeader}>
            <div style={styles.sectionIcon}>🏭</div>
            <span>Üretim Bilgileri</span>
          </div>
          <motion.div style={styles.row} custom={3} variants={rowVariants}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Renkler</label>
              <div style={styles.colorSelection}>
                <div style={styles.selectedColors}>
                  {formData.colors.map(color => (
                    <motion.div
                      key={color}
                      style={styles.colorTag}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                    >
                      <span>{color}</span>
                      <motion.button
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        type="button"
                        onClick={() => handleRemoveColor(color)}
                        style={styles.removeButton}
                        title="Rengi kaldır"
                      >
                        ×
                      </motion.button>
                    </motion.div>
                  ))}
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => {
                    setShowColorModal(true);
                    setFilteredColorOptions(colorOptions);
                    setColorSearchQuery('');
                  }}
                  style={styles.addColorButton}
                  title="Renk ekle"
                >
                  ➕ Renk Ekle
                </motion.button>
              </div>
            </div>

            <div style={{ ...styles.inputGroup, flex: 2 }}>
              <label style={styles.label}>Üretim Miktarı</label>
              <div style={styles.unitGroup}>
                <div style={styles.radioGroup}>
                  <label>
                    <input
                      type="radio"
                      name="unitType"
                      value="kg"
                      checked={formData.unitType === 'kg'}
                      onChange={handleUnitChange}
                    />
                    Kg (Tartı)
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="unitType"
                      value="m"
                      checked={formData.unitType === 'm'}
                      onChange={handleUnitChange}
                    />
                    Metre (Manuel)
                  </label>
                </div>
                <div style={styles.inputWithButton}>
                  {formData.unitType === 'kg' ? (
                    <>
                      <input
                        type="number"
                        name="productionKg"
                        value={formData.productionKg}
                        onChange={handleChange}
                        style={styles.input}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={handleScaleData}
                        style={loading.scale ? {...styles.scaleButton, ...styles.scaleButtonLoading} : styles.scaleButton}
                        disabled={loading.scale}
                      >
                        {loading.scale ? '⏳' : '⚖️'}
                      </motion.button>
                    </>
                  ) : (
                    <input
                      type="number"
                      name="productionMeters"
                      value={formData.productionMeters}
                      onChange={handleChange}
                      style={styles.input}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* 5. Satır — Pastel Bilgileri */}
        <motion.div style={styles.sectionCard} custom={4} variants={rowVariants}>
          <div style={styles.sectionHeader}>
            <div style={styles.sectionIcon}>📐</div>
            <span>Pastel Bilgileri</span>
          </div>
          <motion.div style={styles.row} custom={4} variants={rowVariants}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Pastal Eni (cm)</label>
              <input
                type="number"
                name="pastelEni"
                value={formData.pastelEni}
                onChange={handleChange}
                style={styles.input}
                step="0.01"
                min="0"
                placeholder="0.00"
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Pastal Boyu (cm)</label>
              <input
                type="number"
                name="pastelBoyu"
                value={formData.pastelBoyu}
                onChange={handleChange}
                style={styles.input}
                step="0.01"
                min="0"
                placeholder="0.00"
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Metre Kare Ağırlık (g/m²)</label>
              <input
                type="number"
                name="metreKareAgirlik"
                value={formData.metreKareAgirlik}
                onChange={handleChange}
                style={styles.input}
                step="0.01"
                min="0"
                placeholder="0.00"
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Pastal Ağırlık</label>
              <input
                type="number"
                name="pastelAgirlik"
                value={formData.pastelAgirlik}
                onChange={handleChange}
                style={{ ...styles.input, backgroundColor: 'var(--fs-color-surface-soft)', opacity: 0.7 }}
                step="0.01"
                min="0"
                placeholder="0.00"
                readOnly
              />
            </div>
          </motion.div>
        </motion.div>

        {/* Kaydet */}
        <motion.div
          style={{ ...styles.submitContainer, paddingTop: '0.5rem' }}
          custom={5}
          variants={rowVariants}
        >
          <motion.button
            whileHover={{ scale: 1.02, boxShadow: '0 4px 16px rgba(79, 70, 229, 0.3)' }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            style={loading.submit ? {...styles.submitButton, ...styles.submitButtonLoading} : styles.submitButton}
            disabled={loading.submit}
          >
            {loading.submit ? 'Kaydediliyor...' : '💾 Kaydet'}
          </motion.button>
        </motion.div>
      </motion.form>

      {/* Ürün Seçim Modalı */}
      <AnimatePresence>
        {showProductModal && (
          <motion.div
            style={styles.modalOverlay}
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => setShowProductModal(false)}
          >
            <motion.div
              style={styles.modalContent}
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <div style={styles.modalHeader}>
                <h2 style={styles.modalTitle}>Ürün Seç</h2>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  style={styles.modalCloseButton}
                >
                  ✕
                </motion.button>
              </div>
              <div style={styles.modalSearch}>
                <input
                  type="text"
                  placeholder="Model No veya ürün adı ile ara..."
                  value={searchQuery}
                  onChange={(e) => handleModalSearch(e.target.value)}
                  style={styles.modalSearchInput}
                />
              </div>
              <div style={styles.modalBody}>
                {filteredProducts.length > 0 ? (
                  <div style={styles.productList}>
                    {filteredProducts.map(product => (
                      <motion.div
                        key={product.id}
                        style={styles.productItem}
                        onClick={() => handleModalProductSelect(product)}
                        whileHover={{ backgroundColor: 'var(--fs-color-surface-hover)' }}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <div style={styles.productModelNo}>{product.modelNo}</div>
                        <div style={styles.productName}>{product.name}</div>
                        {product.fabric && (
                          <div style={styles.productFabricType}>
                            Kumaş Türü: {product.fabric.name}
                          </div>
                        )}
                        {product.description && (
                          <div style={styles.productDescription}>{product.description}</div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div style={styles.noResults}>Ürün bulunamadı</div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Müşteri Seçim Modalı */}
      <AnimatePresence>
        {showCustomerModal && (
          <motion.div
            style={styles.modalOverlay}
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => setShowCustomerModal(false)}
          >
            <motion.div
              style={styles.modalContent}
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <div style={styles.modalHeader}>
                <h2 style={styles.modalTitle}>Müşteri Seç</h2>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  style={styles.modalCloseButton}
                >
                  ✕
                </motion.button>
              </div>
              <div style={styles.modalSearch}>
                <input
                  type="text"
                  placeholder="Müşteri adı, telefon veya e-posta ile ara..."
                  value={customerSearchQuery}
                  onChange={(e) => handleCustomerModalSearch(e.target.value)}
                  style={styles.modalSearchInput}
                />
              </div>
              <div style={styles.modalBody}>
                {filteredCustomers.length > 0 ? (
                  <div style={styles.customerList}>
                    {filteredCustomers.map(customer => (
                      <motion.div
                        key={customer.id}
                        style={styles.customerItem}
                        onClick={() => handleCustomerSelect(customer)}
                        whileHover={{ backgroundColor: 'var(--fs-color-surface-hover)' }}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <div style={styles.customerName}>{customer.name}</div>
                        <div style={styles.customerDetails}>
                          {customer.phone || "-"} {customer.email ? `• ${customer.email}` : ""}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div style={styles.noResults}>Müşteri bulunamadı</div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Renk Seçim Modalı */}
      <AnimatePresence>
        {showColorModal && (
          <motion.div
            style={styles.modalOverlay}
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => setShowColorModal(false)}
          >
            <motion.div
              style={styles.modalContent}
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <div style={styles.modalHeader}>
                <h2 style={styles.modalTitle}>Renk Seç</h2>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={() => setShowColorModal(false)}
                  style={styles.modalCloseButton}
                >
                  ✕
                </motion.button>
              </div>
              <div style={styles.modalSearch}>
                <input
                  type="text"
                  placeholder="Renk ara..."
                  value={colorSearchQuery}
                  onChange={(e) => {
                    setColorSearchQuery(e.target.value);
                    if (e.target.value.length > 0) {
                      const filtered = colorOptions.filter(color =>
                        color.toLowerCase().includes(e.target.value.toLowerCase())
                      );
                      setFilteredColorOptions(filtered);
                    } else {
                      setFilteredColorOptions(colorOptions);
                    }
                  }}
                  style={styles.modalSearchInput}
                />
              </div>
              <div style={styles.modalBody}>
                {filteredColorOptions.length > 0 ? (
                  <div style={styles.colorList}>
                    {filteredColorOptions.map(color => (
                      <motion.div
                        key={color}
                        style={styles.colorItem}
                        onClick={() => {
                          handleAddColor(color);
                          setShowColorModal(false);
                        }}
                        whileHover={{ backgroundColor: 'var(--fs-color-surface-hover)' }}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        {color}
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div style={styles.noResults}>Renk bulunamadı</div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------- Stiller ----------
const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    maxWidth: '1100px',
    margin: '0 auto',
    minHeight: '100vh',
    padding: '24px',
    background: 'var(--fs-color-bg)',
    borderRadius: '0',
    border: 'none',
    boxShadow: 'none',
    boxSizing: 'border-box',
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
    color: 'var(--fs-color-text)',
    transition: 'background 0.3s ease, color 0.3s ease'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
    flexWrap: 'wrap' as const,
    gap: '1rem',
    paddingBottom: '1rem',
    borderBottom: '2px solid var(--fs-color-border)'
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap' as const
  },
  themeToggle: {
    padding: '0.5rem 0.9rem',
    backgroundColor: 'var(--fs-color-surface-soft)',
    color: 'var(--fs-color-text)',
    border: '1px solid var(--fs-color-border)',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '1.2rem',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
    backdropFilter: 'blur(2px)'
  },
  exportButtons: {
    display: 'flex',
    gap: '0.6rem',
    flexWrap: 'wrap' as const
  },
  exportButton: {
    padding: '0.5rem 1rem',
    backgroundColor: 'var(--fs-color-surface-soft)',
    color: 'var(--fs-color-text)',
    border: '1px solid var(--fs-color-border)',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: '600',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
    backdropFilter: 'blur(2px)'
  },
  title: {
    textAlign: 'left' as const,
    color: 'var(--fs-color-text)',
    marginBottom: 0,
    fontSize: '1.7rem',
    fontWeight: 700,
    letterSpacing: '-0.02em'
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
    width: '100%',
    maxWidth: '100%',
    border: 'none',
    borderRadius: '0',
    background: 'transparent',
    padding: 0,
    boxShadow: 'none',
    transition: 'background 0.3s ease, border-color 0.3s ease'
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '0.75rem',
    alignItems: 'start'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.4rem',
    minWidth: '160px'
  },
  modelNoHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  reportNumberHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  autoButton: {
    padding: '0.25rem 0.7rem',
    backgroundColor: 'var(--fs-color-surface-soft)',
    color: 'var(--fs-color-text-muted)',
    border: '1px solid var(--fs-color-border-strong)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: '600',
    transition: 'all 0.2s ease',
    lineHeight: '1.4'
  },
  autoButtonActive: {
    padding: '0.25rem 0.7rem',
    backgroundColor: '#ecfdf3',
    color: 'var(--fs-color-success)',
    border: '1px solid #a7f3d0',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: '700',
    transition: 'all 0.2s ease',
    lineHeight: '1.4'
  },
  label: {
    fontWeight: '600',
    color: 'var(--fs-color-text-muted)',
    fontSize: '0.8rem',
    letterSpacing: '0.01em',
    textTransform: 'uppercase' as const
  },
  manualButton: {
    padding: '0.25rem 0.7rem',
    backgroundColor: 'var(--fs-color-surface-soft)',
    color: 'var(--fs-color-text-muted)',
    border: '1px solid var(--fs-color-border-strong)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: '600',
    transition: 'all 0.2s ease',
    lineHeight: '1.4'
  },
  manualButtonActive: {
    padding: '0.25rem 0.7rem',
    backgroundColor: '#ecfdf3',
    color: 'var(--fs-color-success)',
    border: '1px solid #a7f3d0',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: '700',
    transition: 'all 0.2s ease',
    lineHeight: '1.4'
  },
  selectWithButton: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center'
  },
  input: {
    padding: '0.6rem 0.8rem',
    border: '1px solid var(--fs-color-border-strong)',
    borderRadius: '10px',
    fontSize: '0.92rem',
    outline: 'none',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    backgroundColor: 'var(--fs-color-surface-soft)',
    color: 'var(--fs-color-text)',
    width: '100%',
    boxSizing: 'border-box'
  },
  select: {
    padding: '0.6rem 0.8rem',
    border: '1px solid var(--fs-color-border-strong)',
    borderRadius: '10px',
    fontSize: '0.92rem',
    backgroundColor: 'var(--fs-color-surface-soft)',
    color: 'var(--fs-color-text)',
    outline: 'none',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    flex: 1,
    minWidth: '120px'
  },
  fetchButton: {
    padding: '0.6rem 1.2rem',
    backgroundColor: 'var(--fs-color-primary)',
    border: 'none',
    color: '#fff',
    fontWeight: '600',
    fontSize: '0.85rem',
    borderRadius: '10px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  },
  fetchButtonLoading: {
    backgroundColor: 'var(--fs-color-surface-soft)',
    color: 'var(--fs-color-text-muted)',
    cursor: 'not-allowed',
    boxShadow: 'none'
  },
  submitButton: {
    padding: '0.7rem 2rem',
    background: 'var(--fs-color-primary)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: '700',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
  },
  submitButtonLoading: {
    backgroundColor: 'var(--fs-color-surface-soft)',
    color: 'var(--fs-color-text-muted)',
    cursor: 'not-allowed',
    boxShadow: 'none'
  },
  submitContainer: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '0.5rem'
  },
  error: {
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    padding: '0.75rem 1rem',
    borderRadius: '10px',
    marginBottom: '1rem',
    border: '1px solid #fecaca',
    fontSize: '0.9rem'
  },
  disabled: {
    backgroundColor: 'var(--fs-color-surface-soft)',
    cursor: 'not-allowed',
    opacity: 0.6
  },
  unitGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.6rem'
  },
  radioGroup: {
    display: 'flex',
    gap: '1.5rem',
    alignItems: 'center',
    fontSize: '0.9rem'
  },
  inputWithButton: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center'
  },
  scaleButton: {
    padding: '0.6rem 0.9rem',
    backgroundColor: 'var(--fs-color-surface-soft)',
    color: 'var(--fs-color-text)',
    border: '1px solid var(--fs-color-border-strong)',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '600',
    transition: 'all 0.2s ease'
  },
  scaleButtonLoading: {
    backgroundColor: 'var(--fs-color-surface-soft)',
    color: 'var(--fs-color-text-muted)',
    cursor: 'not-allowed',
    opacity: 0.6
  },
  inputWithAutocomplete: {
    position: 'relative' as const,
    display: 'flex',
    gap: '0.5rem',
    width: '100%'
  },
  listButton: {
    padding: '0.6rem 0.8rem',
    backgroundColor: 'var(--fs-color-surface-soft)',
    color: 'var(--fs-color-text)',
    border: '1px solid var(--fs-color-border-strong)',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '600',
    minWidth: '44px',
    transition: 'all 0.2s ease'
  },
  autocompleteDropdown: {
    position: 'absolute' as const,
    top: 'calc(100% + 4px)',
    left: 0,
    right: '52px',
    backgroundColor: 'var(--fs-color-surface)',
    border: '1px solid var(--fs-color-border)',
    borderRadius: '12px',
    boxShadow: '0 12px 32px -12px rgba(15, 23, 42, 0.2)',
    zIndex: 1000,
    maxHeight: '240px',
    overflowY: 'auto' as const,
    padding: '4px 0'
  },
  orderAutocompleteDropdown: {
    position: 'absolute' as const,
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    backgroundColor: 'var(--fs-color-surface)',
    border: '1px solid var(--fs-color-border)',
    borderRadius: '12px',
    boxShadow: '0 12px 32px -12px rgba(15, 23, 42, 0.2)',
    zIndex: 1000,
    maxHeight: '240px',
    overflowY: 'auto' as const,
    padding: '4px 0'
  },
  autocompleteItem: {
    padding: '0.6rem 0.8rem',
    cursor: 'pointer',
    borderBottom: '1px solid var(--fs-color-border)',
    backgroundColor: 'var(--fs-color-surface)',
    color: 'var(--fs-color-text)',
    transition: 'background-color 0.15s ease'
  },
  autocompleteModelNo: {
    fontWeight: '600',
    color: 'var(--fs-color-text)',
    fontSize: '0.9rem'
  },
  autocompleteName: {
    color: 'var(--fs-color-text-muted)',
    fontSize: '0.85rem',
    marginTop: '0.1rem'
  },
  orderAutocompleteMeta: {
    color: 'var(--fs-color-text-muted)',
    fontSize: '0.8rem',
    marginTop: '0.2rem',
    opacity: 0.8
  },
  orderAutocompleteHint: {
    color: 'var(--fs-color-primary-strong)',
    fontSize: '0.78rem',
    marginTop: '0.3rem',
    paddingLeft: '0.1rem'
  },
  autocompleteFabricType: {
    color: 'var(--fs-color-success)',
    fontSize: '0.8rem',
    marginTop: '0.2rem',
    fontStyle: 'italic'
  },
  modalOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '2rem'
  },
  modalContent: {
    backgroundColor: 'var(--fs-color-surface)',
    border: '1px solid var(--fs-color-border)',
    borderRadius: '16px',
    maxWidth: '700px',
    width: '100%',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column' as const,
    boxShadow: '0 24px 48px -20px rgba(15, 23, 42, 0.3)',
    overflow: 'hidden'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid var(--fs-color-border)',
    background: 'var(--fs-color-surface-soft)'
  },
  modalTitle: {
    margin: 0,
    color: 'var(--fs-color-text)',
    fontSize: '1.2rem',
    fontWeight: 700
  },
  modalCloseButton: {
    background: 'none',
    border: 'none',
    fontSize: '1.5rem',
    cursor: 'pointer',
    color: 'var(--fs-color-text-muted)',
    padding: '0.25rem 0.5rem',
    borderRadius: '6px',
    transition: 'background-color 0.2s ease'
  },
  modalSearch: {
    padding: '1rem 1.5rem',
    borderBottom: '1px solid var(--fs-color-border)'
  },
  modalSearchInput: {
    width: '100%',
    padding: '0.6rem 0.8rem',
    border: '1px solid var(--fs-color-border-strong)',
    borderRadius: '10px',
    fontSize: '0.92rem',
    outline: 'none',
    backgroundColor: 'var(--fs-color-surface-soft)',
    color: 'var(--fs-color-text)',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
  },
  modalBody: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '1rem 1.5rem 1.5rem'
  },
  productList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem'
  },
  productItem: {
    padding: '0.75rem 1rem',
    border: '1px solid var(--fs-color-border)',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    backgroundColor: 'var(--fs-color-surface-soft)'
  },
  productModelNo: {
    fontWeight: '600',
    color: 'var(--fs-color-text)',
    fontSize: '0.95rem'
  },
  productName: {
    color: 'var(--fs-color-text-muted)',
    fontSize: '0.9rem',
    marginTop: '0.1rem'
  },
  productFabricType: {
    color: 'var(--fs-color-success)',
    fontSize: '0.8rem',
    marginTop: '0.2rem',
    fontWeight: '500'
  },
  productDescription: {
    color: 'var(--fs-color-text-muted)',
    fontSize: '0.8rem',
    marginTop: '0.15rem',
    fontStyle: 'italic'
  },
  noResults: {
    textAlign: 'center' as const,
    color: 'var(--fs-color-text-muted)',
    padding: '2.5rem 0',
    fontSize: '0.95rem'
  },
  colorAutocompleteDropdown: {
    position: 'absolute' as const,
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    backgroundColor: 'var(--fs-color-surface)',
    border: '1px solid var(--fs-color-border)',
    borderRadius: '12px',
    boxShadow: '0 12px 32px -12px rgba(15, 23, 42, 0.2)',
    zIndex: 1000,
    maxHeight: '200px',
    overflowY: 'auto' as const,
    padding: '4px 0'
  },
  fabricTypeAutocompleteDropdown: {
    position: 'absolute' as const,
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    backgroundColor: 'var(--fs-color-surface)',
    border: '1px solid var(--fs-color-border)',
    borderRadius: '12px',
    boxShadow: '0 12px 32px -12px rgba(15, 23, 42, 0.2)',
    zIndex: 1000,
    maxHeight: '200px',
    overflowY: 'auto' as const,
    padding: '4px 0'
  },
  customerList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem'
  },
  customerItem: {
    padding: '0.75rem 1rem',
    border: '1px solid var(--fs-color-border)',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    backgroundColor: 'var(--fs-color-surface-soft)'
  },
  customerName: {
    fontWeight: '600',
    color: 'var(--fs-color-text)',
    fontSize: '0.95rem'
  },
  customerDetails: {
    color: 'var(--fs-color-text-muted)',
    fontSize: '0.85rem',
    marginTop: '0.1rem'
  },
  customerSelection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem'
  },
  selectedCustomers: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.5rem',
    minHeight: '40px',
    padding: '0.4rem 0.6rem',
    border: '1px solid var(--fs-color-border)',
    borderRadius: '10px',
    backgroundColor: 'var(--fs-color-surface-soft)',
    alignItems: 'center'
  },
  customerTag: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.2rem 0.6rem',
    backgroundColor: 'var(--fs-color-primary-light)',
    color: 'var(--fs-color-primary-strong)',
    border: '1px solid var(--fs-color-primary-border)',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontWeight: '600'
  },
  addCustomerButton: {
    padding: '0.5rem 0.9rem',
    backgroundColor: 'var(--fs-color-surface-soft)',
    color: 'var(--fs-color-text)',
    border: '1px solid var(--fs-color-border-strong)',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: '600',
    transition: 'all 0.2s ease',
    alignSelf: 'flex-start'
  },
  colorSelection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem'
  },
  selectedColors: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.5rem',
    minHeight: '40px',
    padding: '0.4rem 0.6rem',
    border: '1px solid var(--fs-color-border)',
    borderRadius: '10px',
    backgroundColor: 'var(--fs-color-surface-soft)',
    alignItems: 'center'
  },
  colorTag: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.2rem 0.6rem',
    backgroundColor: 'var(--fs-color-primary-light)',
    color: 'var(--fs-color-primary-strong)',
    border: '1px solid var(--fs-color-primary-border)',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontWeight: '600'
  },
  addColorButton: {
    padding: '0.5rem 0.9rem',
    backgroundColor: 'var(--fs-color-surface-soft)',
    color: 'var(--fs-color-text)',
    border: '1px solid var(--fs-color-border-strong)',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: '600',
    transition: 'all 0.2s ease',
    alignSelf: 'flex-start'
  },
  removeButton: {
    background: 'none',
    border: 'none',
    color: 'var(--fs-color-danger)',
    cursor: 'pointer',
    fontSize: '1.2rem',
    padding: '0',
    lineHeight: '1',
    opacity: 0.7,
    transition: 'opacity 0.2s ease'
  },
  colorList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem'
  },
  colorItem: {
    padding: '0.75rem 1rem',
    border: '1px solid var(--fs-color-border)',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    backgroundColor: 'var(--fs-color-surface-soft)'
  },
  // ---------- Section Cards ----------
  sectionCard: {
    background: 'var(--fs-color-surface)',
    border: '1px solid var(--fs-color-border)',
    borderRadius: '14px',
    padding: '1.25rem 1.5rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
    transition: 'box-shadow 0.2s ease, border-color 0.2s ease'
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    marginBottom: '1rem',
    paddingBottom: '0.75rem',
    borderBottom: '2px solid var(--fs-color-border)',
    fontSize: '0.95rem',
    fontWeight: 700,
    color: 'var(--fs-color-text)',
    letterSpacing: '-0.01em'
  },
  sectionIcon: {
    fontSize: '1.1rem',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    background: 'var(--fs-color-primary-light)',
    color: 'var(--fs-color-primary-strong)',
    flexShrink: 0
  }
};