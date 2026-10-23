import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
  AlertTriangle,
  ArrowUpDown,
  Boxes,
  CheckCircle2,
  FilterX,
  RefreshCw,
  Search,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import ExportButtons from '../../components/ExportButtons';

type StockStatus = 'critical' | 'low' | 'healthy';
type QuickFilter = 'all' | 'critical' | 'low' | 'healthy';
type SortDirection = 'asc' | 'desc';

type StockItem = {
  id: number;
  fabricName: string;
  color: string;
  totalIn: number;
  totalOut: number;
  currentStock: number;
  defectiveQuantity: number;
  unit: string;
  category: string;
  minStockLevel: number;
  lastUpdated: string;
  status: StockStatus;
};

type SortKey =
  | 'id'
  | 'fabricName'
  | 'color'
  | 'totalIn'
  | 'totalOut'
  | 'currentStock'
  | 'defectiveQuantity'
  | 'unit'
  | 'category'
  | 'minStockLevel'
  | 'lastUpdated';

type ColumnKey =
  | 'fabricName'
  | 'color'
  | 'currentStock'
  | 'defectiveQuantity'
  | 'minStockLevel'
  | 'unit'
  | 'totalIn'
  | 'totalOut'
  | 'category'
  | 'lastUpdated'
  | 'status';

type ColumnDefinition = {
  key: ColumnKey;
  label: string;
  sortable: boolean;
};

type FilterPreset = {
  name: string;
  search: string;
  unitFilter: string;
  categoryFilter: string;
  minFilter: string;
  maxFilter: string;
  quickFilter: QuickFilter;
  visibleColumns: Record<ColumnKey, boolean>;
  sortKey: SortKey;
  sortDirection: SortDirection;
  pageSize: number;
};

type StockCalculationApiItem = {
  id?: unknown;
  fabricName?: unknown;
  color?: unknown;
  totalIn?: unknown;
  totalOut?: unknown;
  currentStock?: unknown;
  defectiveQuantity?: unknown;
  unit?: unknown;
  category?: unknown;
  minStockLevel?: unknown;
  lastUpdated?: unknown;
};

const DEFAULT_MIN_STOCK_LEVEL = 10;
const PRESET_STORAGE_KEY = 'stock-report-presets-v1';
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const QUICK_FILTERS: QuickFilter[] = ['all', 'critical', 'low', 'healthy'];
const SORT_KEYS: SortKey[] = [
  'id',
  'fabricName',
  'color',
  'totalIn',
  'totalOut',
  'currentStock',
  'defectiveQuantity',
  'unit',
  'category',
  'minStockLevel',
  'lastUpdated',
];
const TABLE_COLUMNS: ColumnDefinition[] = [
  { key: 'fabricName', label: 'Kumas', sortable: true },
  { key: 'color', label: 'Renk', sortable: true },
  { key: 'currentStock', label: 'Net Stok', sortable: true },
  { key: 'defectiveQuantity', label: 'Hatali Stok', sortable: true },
  { key: 'minStockLevel', label: 'Min', sortable: true },
  { key: 'unit', label: 'Birim', sortable: true },
  { key: 'totalIn', label: 'Giris', sortable: true },
  { key: 'totalOut', label: 'Cikis', sortable: true },
  { key: 'category', label: 'Kategori', sortable: true },
  { key: 'lastUpdated', label: 'Guncelleme', sortable: true },
  { key: 'status', label: 'Durum', sortable: false },
];
const COLUMN_KEYS: ColumnKey[] = TABLE_COLUMNS.map((column) => column.key);
const DEFAULT_VISIBLE_COLUMNS: Record<ColumnKey, boolean> = {
  fabricName: true,
  color: true,
  currentStock: true,
  defectiveQuantity: true,
  minStockLevel: true,
  unit: true,
  totalIn: true,
  totalOut: true,
  category: true,
  lastUpdated: true,
  status: true,
};

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toText = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const toNonEmptyText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const toIsoDate = (value: unknown): string => {
  const raw = toText(value, '');
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
};

const statusOf = (currentStock: number, minStockLevel: number): StockStatus => {
  if (currentStock <= minStockLevel * 0.5) return 'critical';
  if (currentStock <= minStockLevel) return 'low';
  return 'healthy';
};

const statusLabel = (status: StockStatus): string => {
  if (status === 'critical') return 'Kritik';
  if (status === 'low') return 'Dusuk';
  return 'Saglikli';
};

const statusClass = (status: StockStatus): string => {
  if (status === 'critical') return 'bg-red-100 text-red-700 border-red-200';
  if (status === 'low') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-emerald-100 text-emerald-700 border-emerald-200';
};

const formatNumber = (value: number): string =>
  new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(value);

const formatDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('tr-TR');
};

const normalizeQuickFilter = (value: unknown): QuickFilter =>
  QUICK_FILTERS.includes(value as QuickFilter) ? (value as QuickFilter) : 'all';

const normalizeSortKey = (value: unknown): SortKey =>
  SORT_KEYS.includes(value as SortKey) ? (value as SortKey) : 'currentStock';

const normalizePageSize = (value: unknown): number => {
  const size = Number(value);
  return PAGE_SIZE_OPTIONS.includes(size) ? size : 25;
};

const normalizeVisibleColumns = (
  candidate?: Partial<Record<ColumnKey, boolean>> | null
): Record<ColumnKey, boolean> => {
  const normalized = { ...DEFAULT_VISIBLE_COLUMNS };
  if (candidate) {
    COLUMN_KEYS.forEach((key) => {
      if (typeof candidate[key] === 'boolean') {
        normalized[key] = candidate[key] as boolean;
      }
    });
  }

  if (!Object.values(normalized).some(Boolean)) {
    normalized.fabricName = true;
  }

  return normalized;
};

const toPreset = (value: unknown): FilterPreset | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<FilterPreset>;
  const rawName = typeof candidate.name === 'string' ? candidate.name.trim() : '';
  if (!rawName) return null;

  return {
    name: rawName,
    search: typeof candidate.search === 'string' ? candidate.search : '',
    unitFilter: typeof candidate.unitFilter === 'string' ? candidate.unitFilter : '',
    categoryFilter: typeof candidate.categoryFilter === 'string' ? candidate.categoryFilter : '',
    minFilter: typeof candidate.minFilter === 'string' ? candidate.minFilter : '',
    maxFilter: typeof candidate.maxFilter === 'string' ? candidate.maxFilter : '',
    quickFilter: normalizeQuickFilter(candidate.quickFilter),
    visibleColumns: normalizeVisibleColumns(candidate.visibleColumns),
    sortKey: normalizeSortKey(candidate.sortKey),
    sortDirection: candidate.sortDirection === 'desc' ? 'desc' : 'asc',
    pageSize: normalizePageSize(candidate.pageSize),
  };
};

const StockReportsPage = () => {
  const router = useRouter();
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [minFilter, setMinFilter] = useState('');
  const [maxFilter, setMaxFilter] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('currentStock');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(() => ({
    ...DEFAULT_VISIBLE_COLUMNS,
  }));
  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [presetFeedback, setPresetFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;
    const focus = typeof router.query.focus === 'string' ? router.query.focus.toLowerCase() : '';
    if (focus === 'low') {
      setQuickFilter('low');
      setMaxFilter((prev) => prev || '25');
    }
  }, [router.isReady, router.query.focus]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRESET_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const loadedPresets = parsed
        .map((entry) => toPreset(entry))
        .filter((preset): preset is FilterPreset => preset !== null)
        .slice(0, 20);
      setPresets(loadedPresets);
    } catch (storageError) {
      console.error(storageError);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
    } catch (storageError) {
      console.error(storageError);
    }
  }, [presets]);

  const fetchStock = async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const response = await fetch('/api/reports/stock-calculations', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        throw new Error('Stok verisi alinamadi');
      }

      const rawData = (await response.json()) as unknown;
      const source = Array.isArray(rawData) ? (rawData as StockCalculationApiItem[]) : [];

      const mapped: StockItem[] = source.map((row) => {
        const currentStock = toNumber(row.currentStock);
        const defectiveQuantity = toNumber(row.defectiveQuantity);
        const minStockLevel = toNumber(row.minStockLevel, DEFAULT_MIN_STOCK_LEVEL);
        const category = toNonEmptyText(row.category) || 'Genel';
        const color = toNonEmptyText(row.color) || 'Belirtilmedi';

        return {
          id: toNumber(row.id),
          fabricName: toNonEmptyText(row.fabricName) || 'Tanimsiz',
          color,
          totalIn: toNumber(row.totalIn),
          totalOut: toNumber(row.totalOut),
          currentStock,
          defectiveQuantity,
          unit: toNonEmptyText(row.unit) || 'kg',
          category,
          minStockLevel,
          lastUpdated: toIsoDate(row.lastUpdated),
          status: statusOf(currentStock, minStockLevel),
        };
      });

      setItems(mapped);
      setLastUpdatedAt(new Date());
    } catch (requestError) {
      console.error(requestError);
      setItems([]);
      setError('Stok raporu su an yuklenemiyor. Lutfen tekrar deneyin.');
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    void fetchStock(false);
  }, []);

  const unitOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.unit))).sort((a, b) => a.localeCompare(b)),
    [items]
  );

  const categoryOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.category))).sort((a, b) => a.localeCompare(b)),
    [items]
  );

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR');
    const minValue = minFilter ? Number(minFilter) : null;
    const maxValue = maxFilter ? Number(maxFilter) : null;

    return items.filter((item) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        item.fabricName.toLocaleLowerCase('tr-TR').includes(normalizedSearch) ||
        item.color.toLocaleLowerCase('tr-TR').includes(normalizedSearch) ||
        item.category.toLocaleLowerCase('tr-TR').includes(normalizedSearch);

      const matchesUnit = unitFilter === '' || item.unit === unitFilter;
      const matchesCategory = categoryFilter === '' || item.category === categoryFilter;
      const matchesMin = minValue === null || item.currentStock >= minValue;
      const matchesMax = maxValue === null || item.currentStock <= maxValue;

      const matchesQuick =
        quickFilter === 'all' ||
        (quickFilter === 'critical' && item.status === 'critical') ||
        (quickFilter === 'low' && (item.status === 'low' || item.status === 'critical')) ||
        (quickFilter === 'healthy' && item.status === 'healthy');

      return matchesSearch && matchesUnit && matchesCategory && matchesMin && matchesMax && matchesQuick;
    });
  }, [categoryFilter, items, maxFilter, minFilter, quickFilter, search, unitFilter]);

  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    list.sort((a, b) => {
      const valueA = a[sortKey];
      const valueB = b[sortKey];

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
      }

      if (sortKey === 'lastUpdated') {
        const dateA = new Date(String(valueA)).getTime();
        const dateB = new Date(String(valueB)).getTime();
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      }

      const textA = String(valueA).toLocaleLowerCase('tr-TR');
      const textB = String(valueB).toLocaleLowerCase('tr-TR');
      return sortDirection === 'asc'
        ? textA.localeCompare(textB, 'tr')
        : textB.localeCompare(textA, 'tr');
    });

    return list;
  }, [filteredItems, sortDirection, sortKey]);

  const visibleTableColumns = useMemo(
    () => TABLE_COLUMNS.filter((column) => visibleColumns[column.key]),
    [visibleColumns]
  );

  const tableColumnCount = Math.max(1, visibleTableColumns.length);
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [search, unitFilter, categoryFilter, minFilter, maxFilter, quickFilter, pageSize]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [page, pageSize, sortedItems]);

  const metrics = useMemo(() => {
    const totalStock = filteredItems.reduce((sum, item) => sum + item.currentStock, 0);
    const totalIn = filteredItems.reduce((sum, item) => sum + item.totalIn, 0);
    const totalOut = filteredItems.reduce((sum, item) => sum + item.totalOut, 0);
    const totalDefective = filteredItems.reduce((sum, item) => sum + item.defectiveQuantity, 0);
    const lowCount = filteredItems.filter((item) => item.status === 'low' || item.status === 'critical').length;
    const criticalCount = filteredItems.filter((item) => item.status === 'critical').length;

    return {
      totalItems: filteredItems.length,
      totalStock,
      totalIn,
      totalOut,
      totalDefective,
      lowCount,
      criticalCount,
    };
  }, [filteredItems]);

  const topCriticalItems = useMemo(
    () =>
      filteredItems
        .filter((item) => item.status !== 'healthy')
        .sort((a, b) => a.currentStock - b.currentStock)
        .slice(0, 6),
    [filteredItems]
  );

  const exportRows = useMemo(
    () =>
      sortedItems.map((item) => ({
        ID: item.id,
        Kumas: item.fabricName,
        Renk: item.color,
        Giris: item.totalIn,
        Cikis: item.totalOut,
        NetStok: item.currentStock,
        HataliStok: item.defectiveQuantity,
        Birim: item.unit,
        MinSeviye: item.minStockLevel,
        Durum: statusLabel(item.status),
        Kategori: item.category,
        SonGuncelleme: formatDate(item.lastUpdated),
      })),
    [sortedItems]
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('asc');
  };

  const clearFilters = () => {
    setSearch('');
    setUnitFilter('');
    setCategoryFilter('');
    setMinFilter('');
    setMaxFilter('');
    setQuickFilter('all');
  };

  const toggleColumn = (columnKey: ColumnKey) => {
    setVisibleColumns((prev) => {
      const enabledCount = COLUMN_KEYS.filter((key) => prev[key]).length;
      if (prev[columnKey] && enabledCount <= 1) return prev;
      return {
        ...prev,
        [columnKey]: !prev[columnKey],
      };
    });
  };

  const savePreset = () => {
    const normalizedName = presetName.trim();
    if (normalizedName.length === 0) {
      setPresetFeedback('Preset adi gerekli.');
      return;
    }

    const nextPreset: FilterPreset = {
      name: normalizedName,
      search,
      unitFilter,
      categoryFilter,
      minFilter,
      maxFilter,
      quickFilter,
      visibleColumns: { ...visibleColumns },
      sortKey,
      sortDirection,
      pageSize,
    };

    setPresets((prev) => {
      const filtered = prev.filter(
        (preset) => preset.name.toLocaleLowerCase('tr-TR') !== normalizedName.toLocaleLowerCase('tr-TR')
      );
      return [nextPreset, ...filtered].slice(0, 20);
    });
    setPresetFeedback(`"${normalizedName}" kaydedildi.`);
    setPresetName('');
  };

  const applyPreset = (preset: FilterPreset) => {
    setSearch(preset.search);
    setUnitFilter(preset.unitFilter);
    setCategoryFilter(preset.categoryFilter);
    setMinFilter(preset.minFilter);
    setMaxFilter(preset.maxFilter);
    setQuickFilter(normalizeQuickFilter(preset.quickFilter));
    setVisibleColumns(normalizeVisibleColumns(preset.visibleColumns));
    setSortKey(normalizeSortKey(preset.sortKey));
    setSortDirection(preset.sortDirection === 'desc' ? 'desc' : 'asc');
    setPageSize(normalizePageSize(preset.pageSize));
    setPage(1);
    setPresetFeedback(`"${preset.name}" uygulandi.`);
  };

  const deletePreset = (name: string) => {
    setPresets((prev) => prev.filter((preset) => preset.name !== name));
    setPresetFeedback(`"${name}" silindi.`);
  };

  const sortIndicator = (key: SortKey): string => {
    if (sortKey !== key) return '';
    return sortDirection === 'asc' ? '^' : 'v';
  };

  const renderCell = (item: StockItem, key: ColumnKey): React.ReactNode => {
    if (key === 'fabricName') return <span className="font-semibold text-slate-800">{item.fabricName}</span>;
    if (key === 'color') return <span className="text-slate-700">{item.color}</span>;
    if (key === 'currentStock') {
      return (
        <span
          className={`font-semibold ${
            item.status === 'critical'
              ? 'text-red-700'
              : item.status === 'low'
                ? 'text-amber-700'
                : 'text-slate-800'
          }`}
        >
          {formatNumber(item.currentStock)}
        </span>
      );
    }
    if (key === 'defectiveQuantity') {
      return (
        <span className="font-semibold text-red-700">
          {formatNumber(item.defectiveQuantity)}
        </span>
      );
    }
    if (key === 'minStockLevel') return <span className="text-slate-600">{formatNumber(item.minStockLevel)}</span>;
    if (key === 'unit') return <span className="text-slate-600">{item.unit}</span>;
    if (key === 'totalIn') return <span className="text-emerald-700">{formatNumber(item.totalIn)}</span>;
    if (key === 'totalOut') return <span className="text-violet-700">{formatNumber(item.totalOut)}</span>;
    if (key === 'category') return <span className="text-slate-600">{item.category}</span>;
    if (key === 'lastUpdated') return <span className="text-slate-500">{formatDate(item.lastUpdated)}</span>;
    return (
      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(item.status)}`}>
        {statusLabel(item.status)}
      </span>
    );
  };

  return (
    <div className="w-full h-full p-3 md:p-4 bg-slate-50 text-slate-900">
      <div className="flex flex-col gap-4">
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardContent className="p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="m-0 text-xs font-semibold uppercase tracking-wider text-sky-700">
                  Stok Yonetimi
                </p>
                <h1 className="m-0 mt-1 text-2xl font-bold text-slate-900">Mevcut Stok Raporu</h1>
                <p className="m-0 mt-1 text-sm text-slate-600">
                  Filtrelenebilir, siralanabilir ve disa aktarilabilir envanter gorunumu.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">
                  {lastUpdatedAt
                    ? `Son guncelleme: ${lastUpdatedAt.toLocaleTimeString('tr-TR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}`
                    : 'Veri bekleniyor...'}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void fetchStock(true)}
                  isLoading={refreshing}
                >
                  <RefreshCw className="mr-1 h-4 w-4" />
                  Yenile
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {error ? (
          <Card className="rounded-xl border-red-200 bg-red-50">
            <CardContent className="p-3 text-sm font-semibold text-red-700">{error}</CardContent>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Card className="rounded-xl border-slate-200">
            <CardContent className="p-4">
              <p className="m-0 text-xs font-semibold text-slate-500">Kalem</p>
              <p className="m-0 mt-1 text-2xl font-bold text-slate-900">{metrics.totalItems}</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-emerald-200 bg-emerald-50">
            <CardContent className="p-4">
              <p className="m-0 text-xs font-semibold text-emerald-700">Net Stok</p>
              <p className="m-0 mt-1 text-2xl font-bold text-emerald-800">{formatNumber(metrics.totalStock)}</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-sky-200 bg-sky-50">
            <CardContent className="p-4">
              <p className="m-0 text-xs font-semibold text-sky-700">Toplam Giris</p>
              <p className="m-0 mt-1 text-2xl font-bold text-sky-800">{formatNumber(metrics.totalIn)}</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-violet-200 bg-violet-50">
            <CardContent className="p-4">
              <p className="m-0 text-xs font-semibold text-violet-700">Toplam Cikis</p>
              <p className="m-0 mt-1 text-2xl font-bold text-violet-800">{formatNumber(metrics.totalOut)}</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-red-200 bg-red-50">
            <CardContent className="p-4">
              <p className="m-0 text-xs font-semibold text-red-700">Hatalı Stok</p>
              <p className="m-0 mt-1 text-2xl font-bold text-red-800">{formatNumber(metrics.totalDefective)}</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <p className="m-0 text-xs font-semibold text-amber-700">Riskli Kalem</p>
              <p className="m-0 mt-1 text-2xl font-bold text-amber-800">
                {metrics.lowCount}
                <span className="ml-2 text-sm font-semibold text-red-700">Kritik: {metrics.criticalCount}</span>
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-slate-200">
          <CardContent className="p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {[
                { id: 'all', label: 'Tum Kalemler', icon: Boxes },
                { id: 'critical', label: 'Kritik', icon: ShieldAlert },
                { id: 'low', label: 'Dusuk Stok', icon: AlertTriangle },
                { id: 'healthy', label: 'Saglikli', icon: CheckCircle2 },
              ].map((item) => {
                const Icon = item.icon;
                const active = quickFilter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setQuickFilter(item.id as QuickFilter)}
                    className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'border-sky-300 bg-sky-100 text-sky-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
              <div className="relative xl:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm outline-none transition focus:border-sky-500"
                  placeholder="Kumas, renk veya kategori ara..."
                />
              </div>

              <select
                value={unitFilter}
                onChange={(event) => setUnitFilter(event.target.value)}
                className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-sky-500"
              >
                <option value="">Tum Birimler</option>
                {unitOptions.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>

              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-sky-500"
              >
                <option value="">Tum Kategoriler</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              <input
                type="number"
                value={minFilter}
                min={0}
                onChange={(event) => setMinFilter(event.target.value)}
                className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-sky-500"
                placeholder="Min stok"
              />

              <input
                type="number"
                value={maxFilter}
                min={0}
                onChange={(event) => setMaxFilter(event.target.value)}
                className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-sky-500"
                placeholder="Maks stok"
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <FilterX className="mr-1 h-4 w-4" />
                Filtreleri Temizle
              </Button>
              <p className="m-0 text-xs font-semibold text-slate-500">
                Gosterilen: {sortedItems.length} / {items.length}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="rounded-2xl border-slate-200">
            <CardContent className="p-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
                <p className="m-0 text-sm font-semibold text-slate-700">
                  Stok Listesi ({sortedItems.length})
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Sayfa boyutu</span>
                  <select
                    value={pageSize}
                    onChange={(event) => setPageSize(Number(event.target.value))}
                    className="h-8 rounded-md border border-slate-300 px-2 text-xs"
                  >
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-100">
                    <tr className="text-left text-xs font-semibold uppercase text-slate-600">
                      {visibleTableColumns.map((column) => (
                        <th key={column.key} className="px-3 py-3">
                          {column.sortable ? (
                            <button
                              type="button"
                              onClick={() => toggleSort(column.key as SortKey)}
                              className="inline-flex items-center gap-1 text-left text-xs font-semibold text-slate-600"
                            >
                              {column.label}
                              <ArrowUpDown className="h-3.5 w-3.5" />
                              <span className="text-slate-400">{sortIndicator(column.key as SortKey)}</span>
                            </button>
                          ) : (
                            <span>{column.label}</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={tableColumnCount} className="px-4 py-10 text-center text-sm text-slate-500">
                          Stok verisi yukleniyor...
                        </td>
                      </tr>
                    ) : pagedItems.length === 0 ? (
                      <tr>
                        <td colSpan={tableColumnCount} className="px-4 py-10 text-center text-sm text-slate-500">
                          Filtrelere uygun kayit bulunamadi.
                        </td>
                      </tr>
                    ) : (
                      pagedItems.map((item) => (
                        <tr
                          key={item.id}
                          className={`border-t border-slate-100 ${
                            item.status === 'critical'
                              ? 'bg-red-50/60'
                              : item.status === 'low'
                                ? 'bg-amber-50/50'
                                : 'bg-white'
                          }`}
                        >
                          {visibleTableColumns.map((column) => (
                            <td key={`${item.id}-${column.key}`} className="px-3 py-3">
                              {renderCell(item, column.key)}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3">
                <p className="m-0 text-xs text-slate-500">
                  Sayfa {page} / {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPage(1)} disabled={page <= 1}>
                    Ilk
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page <= 1}
                  >
                    Geri
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={page >= totalPages}
                  >
                    Ileri
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage(totalPages)}
                    disabled={page >= totalPages}
                  >
                    Son
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card className="rounded-2xl border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="m-0 text-sm font-semibold text-slate-800">Kolonlar</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setVisibleColumns({ ...DEFAULT_VISIBLE_COLUMNS })}
                  >
                    Sifirla
                  </Button>
                </div>
                <p className="m-0 mt-1 text-xs text-slate-500">
                  Tablo gorunumunu rolunuze gore sadelestirebilirsiniz.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {TABLE_COLUMNS.map((column) => (
                    <label
                      key={`column-${column.key}`}
                      className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns[column.key]}
                        onChange={() => toggleColumn(column.key)}
                        className="h-3.5 w-3.5 rounded border-slate-300"
                      />
                      {column.label}
                    </label>
                  ))}
                </div>
                <p className="m-0 mt-2 text-[11px] text-slate-500">En az bir kolon acik kalir.</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200">
              <CardContent className="p-4">
                <h3 className="m-0 text-sm font-semibold text-slate-800">Presetler</h3>
                <p className="m-0 mt-1 text-xs text-slate-500">
                  Filtre, kolon ve siralama durumunu tek tikla geri yukleyin.
                </p>

                <div className="mt-3 flex gap-2">
                  <input
                    value={presetName}
                    onChange={(event) => setPresetName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        savePreset();
                      }
                    }}
                    className="h-9 flex-1 rounded-md border border-slate-300 px-2 text-xs outline-none focus:border-sky-500"
                    placeholder="Preset adi"
                  />
                  <Button size="sm" onClick={savePreset}>
                    Kaydet
                  </Button>
                </div>

                {presetFeedback ? <p className="m-0 mt-2 text-xs font-semibold text-sky-700">{presetFeedback}</p> : null}

                {presets.length === 0 ? (
                  <p className="m-0 mt-3 text-xs text-slate-500">Kayitli preset yok.</p>
                ) : (
                  <div className="mt-3 flex flex-col gap-2">
                    {presets.map((preset) => (
                      <div
                        key={`preset-${preset.name}`}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2"
                      >
                        <p className="m-0 text-xs font-semibold text-slate-800">{preset.name}</p>
                        <p className="m-0 mt-1 text-[11px] text-slate-500">
                          {preset.quickFilter === 'all' ? 'Tum kalemler' : statusLabel(preset.quickFilter as StockStatus)}
                          {' | '}
                          Sayfa boyutu: {preset.pageSize}
                        </p>
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => applyPreset(preset)}>
                            Uygula
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => deletePreset(preset.name)}>
                            Sil
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200">
              <CardContent className="p-4">
                <h3 className="m-0 text-sm font-semibold text-slate-800">Risk Ozeti</h3>
                <p className="m-0 mt-1 text-xs text-slate-500">
                  Oncelikli kontrol edilmesi gereken kalemler.
                </p>
                {topCriticalItems.length === 0 ? (
                  <p className="m-0 mt-3 text-xs font-semibold text-emerald-700">
                    Su an kritik veya dusuk stok kalemi yok.
                  </p>
                ) : (
                  <div className="mt-3 flex flex-col gap-2">
                    {topCriticalItems.map((item) => (
                      <div key={`risk-${item.id}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="m-0 text-xs font-semibold text-slate-800">{item.fabricName}</p>
                         <p className="m-0 mt-1 text-[11px] text-slate-600">
                           Stok: {formatNumber(item.currentStock)} {item.unit} | Min: {item.minStockLevel}
                           {item.defectiveQuantity > 0 ? (
                             <span className="ml-2 text-red-600">| Hatalı: {formatNumber(item.defectiveQuantity)} {item.unit}</span>
                           ) : null}
                         </p>
                        <span
                          className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass(
                            item.status
                          )}`}
                        >
                          {statusLabel(item.status)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200">
              <CardContent className="p-4">
                <h3 className="m-0 text-sm font-semibold text-slate-800">Disa Aktar</h3>
                <p className="m-0 mt-1 text-xs text-slate-500">
                  Guncel filtre ve siralama sonucunu dosya olarak indirebilirsiniz.
                </p>
                <div className="mt-3">
                  <ExportButtons
                    data={exportRows}
                    filename={`stok-raporu-${new Date().toISOString().split('T')[0]}`}
                    disabled={sortedItems.length === 0}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200">
              <CardContent className="p-4">
                <h3 className="m-0 text-sm font-semibold text-slate-800">Trend</h3>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-emerald-700">
                    <p className="m-0 font-semibold">Giris</p>
                    <p className="m-0 mt-1 inline-flex items-center gap-1 text-[11px]">
                      <TrendingUp className="h-3.5 w-3.5" />
                      {formatNumber(metrics.totalIn)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-violet-200 bg-violet-50 p-2 text-violet-700">
                    <p className="m-0 font-semibold">Cikis</p>
                    <p className="m-0 mt-1 inline-flex items-center gap-1 text-[11px]">
                      <TrendingDown className="h-3.5 w-3.5" />
                      {formatNumber(metrics.totalOut)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockReportsPage;

