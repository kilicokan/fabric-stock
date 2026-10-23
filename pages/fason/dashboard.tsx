import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Card,
  CardContent,
  Chip,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  TextField,
  Tooltip,
} from '@mui/material';
import axios from 'axios';
import {
  AlertTriangle,
  Calendar,
  Download,
  Factory,
  Filter,
  Loader2,
  MapPin,
  Package2,
  RefreshCw,
  Search,
  UserRound,
} from 'lucide-react';
import { useRouter } from 'next/router';
import { useAuth } from '../../components/AuthContext';

type MobileFilter = 'ALL' | 'MOBILE' | 'NON_MOBILE';
type DateRangeFilter = 'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM';
type FocusFilter = 'NONE' | 'DELAYED' | 'URGENT';

interface FasonTracking {
  id: number;
  processType: string;
  status: string;
  notes?: string;
  problemNotes?: string;
  createdAt?: string | null;
  workshop?: { name?: string; specialization?: string } | null;
  user?: { name?: string; email?: string } | null;
}

interface WorkOrder {
  id: number;
  orderNo: string;
  productCode: string;
  productName?: string;
  quantity: number;
  customerName?: string;
  status: string;
  priority?: string;
  deliveryDate?: string | null;
  createdAt?: string | null;
  assignedToMobile?: boolean;
  fasonTrackings: FasonTracking[];
}

const STATUS_LABELS: Record<string, string> = {
  BEKLIYOR: 'Bekliyor',
  ALINDI: 'Alindi',
  ATOLYEDE: 'Atolyede',
  HAZIR: 'Hazir',
  TESLIM_EDILDI: 'Teslim Edildi',
  SORUN_VAR: 'Sorun Var',
  IPTAL_EDILDI: 'Iptal Edildi',
};

const STATUS_COLORS: Record<string, { solid: string; soft: string }> = {
  BEKLIYOR: { solid: '#64748b', soft: '#f1f5f9' },
  ALINDI: { solid: '#2563eb', soft: '#dbeafe' },
  ATOLYEDE: { solid: '#d97706', soft: '#ffedd5' },
  HAZIR: { solid: '#0d9488', soft: '#ccfbf1' },
  TESLIM_EDILDI: { solid: '#16a34a', soft: '#dcfce7' },
  SORUN_VAR: { solid: '#dc2626', soft: '#fee2e2' },
  IPTAL_EDILDI: { solid: '#52525b', soft: '#f4f4f5' },
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#16a34a',
  MEDIUM: '#d97706',
  HIGH: '#ea580c',
  URGENT: '#dc2626',
};

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Tum Durumlar' },
  { value: 'BEKLIYOR', label: 'Bekliyor' },
  { value: 'ALINDI', label: 'Alindi' },
  { value: 'ATOLYEDE', label: 'Atolyede' },
  { value: 'HAZIR', label: 'Hazir' },
  { value: 'TESLIM_EDILDI', label: 'Teslim Edildi' },
  { value: 'SORUN_VAR', label: 'Sorun Var' },
  { value: 'IPTAL_EDILDI', label: 'Iptal Edildi' },
];

const MOBILE_OPTIONS: Array<{ value: MobileFilter; label: string }> = [
  { value: 'MOBILE', label: 'Sadece Mobile Atananlar' },
  { value: 'ALL', label: 'Tum Is Emirleri' },
  { value: 'NON_MOBILE', label: 'Mobile Atanmayanlar' },
];

const DATE_RANGE_OPTIONS: Array<{ value: DateRangeFilter; label: string }> = [
  { value: 'ALL', label: 'Tum Tarihler' },
  { value: 'TODAY', label: 'Bugun' },
  { value: 'THIS_WEEK', label: 'Bu Hafta' },
  { value: 'THIS_MONTH', label: 'Bu Ay' },
  { value: 'CUSTOM', label: 'Ozel Aralik' },
];

const normalizeStatus = (status?: string | null): string => {
  if (!status) return 'BEKLIYOR';
  const upper = status.toUpperCase().replace(/\s+/g, '_');
  if (upper === 'IPTAL') return 'IPTAL_EDILDI';
  if (/AT.*LYEDE/.test(upper) || /AT.*OLYEDE/.test(upper)) return 'ATOLYEDE';
  return upper;
};

const statusLabel = (status?: string): string => {
  const key = normalizeStatus(status);
  return STATUS_LABELS[key] ?? key.replaceAll('_', ' ');
};

const statusColor = (status?: string): { solid: string; soft: string } =>
  STATUS_COLORS[normalizeStatus(status)] ?? STATUS_COLORS.BEKLIYOR;

const formatDate = (value?: string | null): string => {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('tr-TR');
};

const parseDateValue = (value?: string | null): Date | null => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const isInDateRange = (
  value: string | null | undefined,
  range: DateRangeFilter,
  customFrom?: string,
  customTo?: string
): boolean => {
  if (range === 'ALL') return true;

  const parsed = parseDateValue(value);
  if (!parsed) return false;
  const target = startOfDay(parsed);
  const now = startOfDay(new Date());

  if (range === 'TODAY') {
    return target.getTime() === now.getTime();
  }

  if (range === 'THIS_WEEK') {
    const weekStart = new Date(now);
    const day = weekStart.getDay();
    const distanceToMonday = day === 0 ? 6 : day - 1;
    weekStart.setDate(weekStart.getDate() - distanceToMonday);
    return target >= weekStart && target <= now;
  }

  if (range === 'THIS_MONTH') {
    return target.getFullYear() === now.getFullYear() && target.getMonth() === now.getMonth();
  }

  const from = customFrom ? startOfDay(new Date(customFrom)) : null;
  const to = customTo ? startOfDay(new Date(customTo)) : null;
  if (!from && !to) return true;
  if (from && target < from) return false;
  if (to && target > to) return false;
  return true;
};

const toMillis = (value?: string | null): number => {
  if (!value) return 0;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
};

const getLatestTracking = (order: WorkOrder): FasonTracking | null =>
  order.fasonTrackings?.length ? order.fasonTrackings[0] : null;

const isCompleted = (status: string): boolean => normalizeStatus(status) === 'TESLIM_EDILDI';

const isDelayed = (order: WorkOrder): boolean => {
  if (!order.deliveryDate) return false;
  const date = new Date(order.deliveryDate);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today && !isCompleted(order.status);
};

const parseOrders = (payload: unknown): WorkOrder[] => {
  const root = (payload as { data?: unknown; workOrders?: unknown }) || {};
  const list =
    (Array.isArray(payload) ? payload : null) ||
    (Array.isArray(root.data) ? root.data : null) ||
    (Array.isArray(root.workOrders) ? root.workOrders : null) ||
    (Array.isArray((root.data as { workOrders?: unknown })?.workOrders)
      ? (root.data as { workOrders: unknown[] }).workOrders
      : []);

  return (list as Array<Record<string, unknown>>).map((item) => {
    const trackingsRaw = Array.isArray(item.fasonTrackings) ? item.fasonTrackings : [];
    const fasonTrackings = (trackingsRaw as Array<Record<string, unknown>>)
      .map((tracking) => ({
        id: Number(tracking.id || 0),
        processType: String(tracking.processType || 'BILINMIYOR'),
        status: normalizeStatus(String(tracking.status || 'BEKLIYOR')),
        notes: String(tracking.notes || ''),
        problemNotes: String(tracking.problemNotes || ''),
        createdAt: String(tracking.createdAt || '') || null,
        workshop: tracking.workshop
          ? {
              name: String((tracking.workshop as { name?: unknown }).name || ''),
              specialization: String((tracking.workshop as { specialization?: unknown }).specialization || ''),
            }
          : null,
        user: tracking.user
          ? {
              name: String((tracking.user as { name?: unknown }).name || ''),
              email: String((tracking.user as { email?: unknown }).email || ''),
            }
          : null,
      }))
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

    return {
      id: Number(item.id || 0),
      orderNo: String(item.orderNo || `#${item.id || 0}`),
      productCode: String(item.productCode || '-'),
      productName: String(item.productName || ''),
      quantity: Number(item.quantity || 0),
      customerName: String(item.customerName || ''),
      status: normalizeStatus(String(item.status || 'BEKLIYOR')),
      priority: String(item.priority || ''),
      deliveryDate: String(item.deliveryDate || '') || null,
      createdAt: String(item.createdAt || '') || null,
      assignedToMobile: Boolean(item.assignedToMobile),
      fasonTrackings,
    };
  });
};

type TrendPoint = { key: string; label: string; value: number };

const buildTrendSeries = (
  orders: WorkOrder[],
  selector: (order: WorkOrder) => string | null | undefined,
  days = 7
): TrendPoint[] => {
  const today = startOfDay(new Date());
  const points: TrendPoint[] = [];
  const indexByKey: Record<string, number> = {};

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
    indexByKey[key] = points.length;
    points.push({ key, label, value: 0 });
  }

  orders.forEach((order) => {
    const rawDate = selector(order);
    const parsed = parseDateValue(rawDate);
    if (!parsed) return;
    const key = startOfDay(parsed).toISOString().split('T')[0];
    const idx = indexByKey[key];
    if (typeof idx === 'number') points[idx].value += 1;
  });

  return points;
};

const MiniTrendCard = ({
  title,
  subtitle,
  series,
  color,
}: {
  title: string;
  subtitle: string;
  series: TrendPoint[];
  color: string;
}) => {
  const max = Math.max(...series.map((s) => s.value), 1);

  return (
    <Card style={{ borderRadius: 12 }}>
      <CardContent style={{ padding: 14 }}>
        <h4 style={{ margin: 0, fontSize: 15 }}>{title}</h4>
        <p style={{ margin: '2px 0 10px 0', fontSize: 12, color: '#64748b' }}>{subtitle}</p>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))`, gap: 6, alignItems: 'end', minHeight: 86 }}>
          {series.map((item) => (
            <div key={`${title}-${item.key}`} style={{ textAlign: 'center' }}>
              <div style={{ height: 58, display: 'flex', alignItems: 'flex-end' }}>
                <div
                  title={`${item.label}: ${item.value}`}
                  style={{
                    width: '100%',
                    height: `${Math.max((item.value / max) * 100, item.value > 0 ? 16 : 6)}%`,
                    borderRadius: 6,
                    background: `linear-gradient(180deg, ${color}CC 0%, ${color} 100%)`,
                  }}
                />
              </div>
              <div style={{ marginTop: 4, fontSize: 10, color: '#64748b' }}>{item.label}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>{item.value}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const FasonDashboard: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [mobileFilter, setMobileFilter] = useState<MobileFilter>('MOBILE');
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>('ALL');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [focusFilter, setFocusFilter] = useState<FocusFilter>('NONE');

  useEffect(() => {
    if (!router.isReady) return;
    const focusParam = typeof router.query.focus === 'string' ? router.query.focus.toLowerCase() : '';
    if (focusParam === 'delayed') {
      setFocusFilter('DELAYED');
      return;
    }
    if (focusParam === 'urgent') {
      setFocusFilter('URGENT');
      return;
    }
    setFocusFilter('NONE');
  }, [router.isReady, router.query.focus]);

  useEffect(() => {
    const id = window.setTimeout(() => setSearchTerm(searchInput.trim()), 250);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const fetchOrders = useCallback(
    async (silent = false) => {
      try {
        setError(null);
        if (silent) setRefreshing(true);
        else setLoading(true);

        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const params = new URLSearchParams({ page: '1', limit: '200' });
        if (searchTerm) params.append('search', searchTerm);
        if (statusFilter !== 'ALL') params.append('status', statusFilter);
        if (mobileFilter === 'MOBILE') params.append('assignedToMobile', 'true');
        if (mobileFilter === 'NON_MOBILE') params.append('assignedToMobile', 'false');

        const response = await axios.get(`/api/fason/work-orders?${params.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          timeout: 15000,
        });

        setOrders(parseOrders(response.data));
      } catch (e: unknown) {
        const err = e as { response?: { status?: number } };
        if (err.response?.status === 401 && typeof window !== 'undefined') {
          localStorage.removeItem('token');
          window.location.href = '/login';
          return;
        }
        setOrders([]);
        setError('Is emirleri yuklenemedi. Lutfen tekrar deneyin.');
      } finally {
        if (silent) setRefreshing(false);
        else setLoading(false);
      }
    },
    [mobileFilter, searchTerm, statusFilter]
  );

  useEffect(() => {
    void fetchOrders(false);
  }, [fetchOrders]);

  const filteredOrders = useMemo(() => {
    const q = searchTerm.toLocaleLowerCase('tr-TR');
    return orders.filter((o) => {
      const searchHit =
        !q ||
        o.orderNo.toLocaleLowerCase('tr-TR').includes(q) ||
        o.productCode.toLocaleLowerCase('tr-TR').includes(q) ||
        o.productName?.toLocaleLowerCase('tr-TR').includes(q) ||
        o.customerName?.toLocaleLowerCase('tr-TR').includes(q);
      const statusHit = statusFilter === 'ALL' || normalizeStatus(o.status) === statusFilter;
      const mobileHit =
        mobileFilter === 'ALL' ||
        (mobileFilter === 'MOBILE' && o.assignedToMobile) ||
        (mobileFilter === 'NON_MOBILE' && !o.assignedToMobile);
      const dateHit = isInDateRange(o.deliveryDate, dateRangeFilter, customFromDate, customToDate);
      const focusHit =
        focusFilter === 'NONE' ||
        (focusFilter === 'DELAYED' && isDelayed(o)) ||
        (focusFilter === 'URGENT' &&
          (isDelayed(o) || o.priority === 'URGENT' || normalizeStatus(o.status) === 'SORUN_VAR'));
      return searchHit && statusHit && mobileHit && dateHit && focusHit;
    });
  }, [customFromDate, customToDate, dateRangeFilter, focusFilter, mobileFilter, orders, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    const total = filteredOrders.length;
    const completed = filteredOrders.filter((o) => isCompleted(o.status)).length;
    const delayed = filteredOrders.filter((o) => isDelayed(o)).length;
    const problems = filteredOrders.filter((o) => normalizeStatus(o.status) === 'SORUN_VAR').length;
    const completionRate = total ? Math.round((completed / total) * 100) : 0;
    return { total, completed, delayed, problems, completionRate };
  }, [filteredOrders]);

  const statusDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    filteredOrders.forEach((o) => {
      const key = normalizeStatus(o.status);
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredOrders]);

  const workshopSummary = useMemo(() => {
    const map: Record<string, { qty: number; count: number; problems: number }> = {};
    filteredOrders.forEach((o) => {
      const name = getLatestTracking(o)?.workshop?.name;
      if (!name) return;
      if (!map[name]) map[name] = { qty: 0, count: 0, problems: 0 };
      map[name].qty += o.quantity;
      map[name].count += 1;
      if (normalizeStatus(o.status) === 'SORUN_VAR') map[name].problems += 1;
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6);
  }, [filteredOrders]);

  const criticalOrders = useMemo(
    () => filteredOrders.filter((o) => isDelayed(o) || o.priority === 'URGENT' || normalizeStatus(o.status) === 'SORUN_VAR').slice(0, 6),
    [filteredOrders]
  );

  const deliveryTrend = useMemo(() => buildTrendSeries(filteredOrders, (o) => o.deliveryDate, 7), [filteredOrders]);
  const createdTrend = useMemo(() => buildTrendSeries(filteredOrders, (o) => o.createdAt, 7), [filteredOrders]);

  const exportToExcel = useCallback(async () => {
    if (filteredOrders.length === 0) {
      window.alert('Disa aktarilacak kayit bulunamadi.');
      return;
    }

    const rows = filteredOrders.map((o) => {
      const t = getLatestTracking(o);
      return {
        IsEmriNo: o.orderNo,
        Model: `${o.productCode}${o.productName ? ` - ${o.productName}` : ''}`,
        Musteri: o.customerName || '',
        Miktar: o.quantity,
        Durum: statusLabel(o.status),
        Oncelik: o.priority || '',
        Termin: formatDate(o.deliveryDate),
        Atolye: t?.workshop?.name || '',
        SonSurec: t?.processType || '',
        Takipci: t?.user?.name || t?.user?.email || '',
        Not: t?.notes || '',
        Sorun: t?.problemNotes || '',
      };
    });

    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Dış Kaynak Üretim Dashboard');
      const stamp = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `fason-dashboard-${stamp}.xlsx`);
    } catch (exportError) {
      console.error(exportError);
      window.alert('Excel olusturulamadi.');
    }
  }, [filteredOrders]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at top right, rgba(125, 211, 252, 0.2), transparent 50%), linear-gradient(180deg, #f8fafc 0%, #eff6ff 100%)',
        padding: 20,
      }}
    >
      <div style={{ maxWidth: 1500, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: 'linear-gradient(120deg, #0f172a 0%, #1e3a8a 60%, #0284c7 100%)', borderRadius: 16, padding: 20, color: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <p style={{ margin: 0, opacity: 0.75, fontSize: 13 }}>Dış Kaynak Üretim Modulu</p>
              <h1 style={{ margin: '4px 0', fontSize: 30, fontWeight: 800 }}>Gosterge Paneli</h1>
              <p style={{ margin: 0, opacity: 0.9, fontSize: 14 }}>
                {user?.name ? `${user.name},` : 'Ekip,'} aktif dış kaynak üretim operasyonlarini tek ekrandan yonetebilirsiniz.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Tooltip title="Yenile">
                <IconButton onClick={() => void fetchOrders(true)} style={{ color: '#fff', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.2)' }}>
                  {refreshing ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={18} />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Excel disa aktar">
                <IconButton onClick={() => void exportToExcel()} style={{ color: '#fff', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <Download size={18} />
                </IconButton>
              </Tooltip>
            </div>
          </div>
        </div>

        {loading && orders.length === 0 ? <LinearProgress /> : null}
        {error ? <Alert severity="warning">{error}</Alert> : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
          {[
            { label: 'Toplam Is Emri', value: stats.total, key: 'ALINDI', note: `${stats.completed} tamamlandi` },
            { label: 'Tamamlanma Orani', value: `%${stats.completionRate}`, key: 'TESLIM_EDILDI', note: `${stats.completed} adet teslim edildi` },
            { label: 'Geciken Isler', value: stats.delayed, key: 'SORUN_VAR', note: stats.delayed ? 'Termin riski var' : 'Terminler normal' },
            { label: 'Sorunlu Isler', value: stats.problems, key: 'ATOLYEDE', note: `${criticalOrders.length} kritik is emri` },
          ].map((s) => {
            const c = statusColor(s.key);
            return (
              <Card key={s.label} style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <CardContent style={{ padding: 14 }}>
                  <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>{s.label}</p>
                  <p style={{ margin: '8px 0 0 0', fontSize: 28, fontWeight: 800, color: c.solid }}>{s.value}</p>
                  <p style={{ margin: '4px 0 0 0', color: '#475569', fontSize: 12 }}>{s.note}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card style={{ borderRadius: 12 }}>
          <CardContent style={{ padding: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
              <TextField
                size="small"
                placeholder="Is emri, model veya musteri ara..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search size={16} color="#64748b" /></InputAdornment> }}
              />
              <TextField
                select
                size="small"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Filter size={16} color="#64748b" /></InputAdornment> }}
              >
                {STATUS_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </TextField>
              <TextField select size="small" value={mobileFilter} onChange={(e) => setMobileFilter(e.target.value as MobileFilter)}>
                {MOBILE_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </TextField>
              <TextField select size="small" value={dateRangeFilter} onChange={(e) => setDateRangeFilter(e.target.value as DateRangeFilter)}>
                {DATE_RANGE_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </TextField>
              {dateRangeFilter === 'CUSTOM' ? (
                <TextField
                  size="small"
                  type="date"
                  label="Baslangic"
                  value={customFromDate}
                  onChange={(e) => setCustomFromDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              ) : null}
              {dateRangeFilter === 'CUSTOM' ? (
                <TextField
                  size="small"
                  type="date"
                  label="Bitis"
                  value={customToDate}
                  onChange={(e) => setCustomToDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              ) : null}
            </div>
            {focusFilter !== 'NONE' ? (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Chip
                  size="small"
                  label={focusFilter === 'DELAYED' ? 'Odak: Geciken Isler' : 'Odak: Acil / Sorunlu Isler'}
                  style={{
                    background: focusFilter === 'DELAYED' ? '#fee2e2' : '#ffedd5',
                    color: focusFilter === 'DELAYED' ? '#991b1b' : '#9a3412',
                    fontWeight: 700,
                  }}
                />
                <button
                  onClick={() => {
                    setFocusFilter('NONE');
                    router.replace('/fason/dashboard', undefined, { shallow: true });
                  }}
                  style={{
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    borderRadius: 8,
                    padding: '4px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#334155',
                    cursor: 'pointer',
                  }}
                >
                  Odagi Temizle
                </button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 10 }}>
          <Card style={{ borderRadius: 12 }}>
            <CardContent style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Durum Dagilimi</h3>
                <Chip size="small" label={`${filteredOrders.length} is`} />
              </div>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {statusDistribution.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Veri yok.</p>
                ) : statusDistribution.map(([key, count]) => {
                  const c = statusColor(key);
                  const width = filteredOrders.length ? Math.max((count / filteredOrders.length) * 100, 7) : 0;
                  return (
                    <div key={key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span>{statusLabel(key)}</span><strong style={{ color: c.solid }}>{count}</strong>
                      </div>
                      <div style={{ height: 8, borderRadius: 999, background: c.soft, overflow: 'hidden' }}>
                        <div style={{ width: `${width}%`, height: '100%', background: c.solid }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card style={{ borderRadius: 12 }}>
            <CardContent style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Atolye Yuku</h3>
                <Factory size={18} color="#1e3a8a" />
              </div>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {workshopSummary.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Atolye bazli veri yok.</p>
                ) : workshopSummary.map((w) => (
                  <div key={w.name} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 10px', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <strong style={{ fontSize: 13 }}>{w.name}</strong>
                      <span style={{ fontSize: 12, color: '#475569' }}>{w.count} is</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 3 }}>
                      <span style={{ fontSize: 12, color: '#475569' }}>Toplam adet: {w.qty}</span>
                      <span style={{ fontSize: 12, color: w.problems ? '#dc2626' : '#16a34a' }}>Sorunlu: {w.problems}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10 }}>
          <MiniTrendCard
            title="Son 7 Gun Acilan Isler"
            subtitle="Olusturma tarihine gore gunluk kayit adedi"
            series={createdTrend}
            color="#2563eb"
          />
          <MiniTrendCard
            title="Son 7 Gun Termin Yogunlugu"
            subtitle="Termin tarihine gore gunluk is adedi"
            series={deliveryTrend}
            color="#d97706"
          />
        </div>

        <Card style={{ borderRadius: 12 }}>
          <CardContent style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 17 }}>Is Emri Listesi</h3>
              <span style={{ fontSize: 13, color: '#64748b' }}>{filteredOrders.length} kayit</span>
            </div>

            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredOrders.length === 0 ? (
                <div style={{ border: '1px dashed #cbd5e1', borderRadius: 10, padding: 18, textAlign: 'center', color: '#64748b' }}>
                  Filtrelere uygun kayit bulunamadi.
                </div>
              ) : filteredOrders.map((o) => {
                const t = getLatestTracking(o);
                const cs = statusColor(o.status);
                const cst = statusColor(t?.status);
                const pColor = PRIORITY_COLORS[o.priority || ''] || '#64748b';
                return (
                  <div key={o.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: 17 }}>{o.orderNo}</strong>
                          {o.priority ? <Chip size="small" label={o.priority} style={{ background: `${pColor}20`, color: pColor, fontWeight: 700, border: `1px solid ${pColor}40` }} /> : null}
                          {o.assignedToMobile ? <Chip size="small" label="Mobile Atandi" style={{ background: '#dbeafe', color: '#1d4ed8', fontWeight: 700 }} /> : null}
                        </div>
                        <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#475569' }}>
                          {o.productCode} {o.productName ? `- ${o.productName}` : ''} ({o.quantity} adet)
                        </p>
                      </div>
                      <Chip size="small" label={statusLabel(o.status)} style={{ background: cs.soft, color: cs.solid, fontWeight: 700 }} />
                    </div>

                    <div style={{ marginTop: 9, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: '#334155' }}><UserRound size={14} />{o.customerName || 'Musteri yok'}</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: '#334155' }}><Package2 size={14} />{o.quantity} adet</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: '#334155' }}><Calendar size={14} />Termin: {formatDate(o.deliveryDate)}</div>
                    </div>

                    {t ? (
                      <div style={{ marginTop: 10, borderTop: '1px dashed #e2e8f0', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 700 }}>Son Surec: {t.processType}</span>
                            <Chip size="small" label={statusLabel(t.status)} style={{ background: cst.soft, color: cst.solid, fontWeight: 700 }} />
                          </div>
                          {t.workshop?.name ? <span style={{ fontSize: 12, color: '#334155', display: 'flex', alignItems: 'center', gap: 5 }}><MapPin size={13} />{t.workshop.name}</span> : null}
                        </div>
                        {(t.user?.name || t.user?.email) ? <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Takipci: {t.user?.name || t.user?.email}</p> : null}
                        {t.notes ? <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 7, padding: '5px 7px', fontSize: 12, color: '#1e3a8a' }}>Not: {t.notes}</div> : null}
                        {t.problemNotes ? <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, padding: '5px 7px', fontSize: 12, color: '#991b1b', display: 'flex', gap: 5, alignItems: 'center' }}><AlertTriangle size={13} />Sorun: {t.problemNotes}</div> : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card style={{ borderRadius: 12 }}>
          <CardContent style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Kritik Isler</h3>
              <AlertTriangle size={17} color={criticalOrders.length ? '#dc2626' : '#16a34a'} />
            </div>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {criticalOrders.length === 0 ? (
                <p style={{ margin: 0, color: '#16a34a', fontSize: 13 }}>Kritik seviyede is bulunmuyor.</p>
              ) : criticalOrders.map((o) => (
                <div key={`critical-${o.id}`} style={{ border: '1px solid #e2e8f0', borderRadius: 9, padding: '8px 10px', display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <strong style={{ fontSize: 13 }}>{o.orderNo}</strong>
                    <p style={{ margin: '3px 0 0 0', fontSize: 12, color: '#64748b' }}>{o.productCode} - {o.customerName || 'Musteri yok'}</p>
                  </div>
                  <Chip size="small" label={statusLabel(o.status)} style={{ background: statusColor(o.status).soft, color: statusColor(o.status).solid, fontWeight: 700 }} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FasonDashboard;

