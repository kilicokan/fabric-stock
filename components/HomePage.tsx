import React, { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import {
  ArrowRightCircle,
  BarChart3,
  Boxes,
  ClipboardPlus,
  ChevronDown,
  Clock3,
  Gauge,
  Factory,
  LogOut,
  Navigation,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Truck,
  Warehouse,
  Scissors,
} from 'lucide-react';
import VehiclesWidget from './VehiclesWidget';
import { useTabs } from './TabContext';
import styles from './HomePage.module.css';

interface User {
  id: number;
  email: string;
  name?: string;
  role: string;
  stockAccess: boolean;
  fasonAccess: boolean;
}

interface HomePageProps {
  user: User;
}

interface ModuleCard {
  id: string;
  title: string;
  description: string;
  route: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'stock' | 'fason';
}

interface KpiSummary {
  activeVehicles: number;
  openWorkOrders: number;
  delayedWorkOrders: number;
  urgentWorkOrders: number;
  fabricCount: number;
  lowStockCount: number;
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  route: string;
  icon: React.ComponentType<{ className?: string }>;
}

const roleLabel = (value: string): string =>
  value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const normalizeStatus = (value?: string): string => {
  if (!value) return 'BEKLIYOR';
  const upper = value.toUpperCase().replace(/\s+/g, '_');
  if (upper === 'IPTAL') return 'IPTAL_EDILDI';
  if (/AT.*LYEDE/.test(upper) || /AT.*OLYEDE/.test(upper)) return 'ATOLYEDE';
  return upper;
};

const isDelayedOrder = (deliveryDate?: string | null, status?: string): boolean => {
  if (!deliveryDate) return false;
  const delivery = new Date(deliveryDate);
  if (Number.isNaN(delivery.getTime())) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  delivery.setHours(0, 0, 0, 0);
  return delivery < now && normalizeStatus(status) !== 'TESLIM_EDILDI';
};

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const stripQuery = (path: string): string => path.split('?')[0];

const ROUTE_TITLE_MAP: Record<string, string> = {
  '/stock': 'Mira Stock',
  '/fason': 'Mira Dış Kaynak Üretim Takip',
  '/vehicles': 'Araclar',
  '/license': 'Lisans Durumu',
  '/fabric-entry': 'Kumas Girisi',
  '/reports/stock': 'Mevcut Stok Raporu',
  '/fason/create-work-order': 'Dış Kaynak Üretim Is Emri Olustur',
  '/fason/dashboard': 'Dış Kaynak Üretim Dashboard',
  '/fason/cutting-suggestions': 'Kesim Onerileri',
  '/fason/cutting-workshop': 'Kesimhane Ekrani',
  '/reports/cutting-fabric-conversion': 'Kumas Donusum Raporu',
  '/kesimhane': 'Kesimhane',
};

const extractDataArray = (payload: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(payload)) return payload as Array<Record<string, unknown>>;

  if (payload !== null && typeof payload === 'object') {
    const root = payload as { data?: unknown; workOrders?: unknown };
    if (Array.isArray(root.data)) return root.data as Array<Record<string, unknown>>;
    if (Array.isArray(root.workOrders)) return root.workOrders as Array<Record<string, unknown>>;

    if (root.data !== null && typeof root.data === 'object') {
      const nested = root.data as { workOrders?: unknown };
      if (Array.isArray(nested.workOrders)) {
        return nested.workOrders as Array<Record<string, unknown>>;
      }
    }
  }

  return [];
};

const EMPTY_KPI: KpiSummary = {
  activeVehicles: 0,
  openWorkOrders: 0,
  delayedWorkOrders: 0,
  urgentWorkOrders: 0,
  fabricCount: 0,
  lowStockCount: 0,
};

const HomePage: React.FC<HomePageProps> = ({ user }) => {
  const router = useRouter();
  const { addTab } = useTabs();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [kpiSummary, setKpiSummary] = useState<KpiSummary>(EMPTY_KPI);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiRefreshing, setKpiRefreshing] = useState(false);
  const [kpiError, setKpiError] = useState<string | null>(null);
  const [kpiUpdatedAt, setKpiUpdatedAt] = useState<Date | null>(null);

  const modules = useMemo<ModuleCard[]>(() => {
    const list: ModuleCard[] = [];

    if (user.stockAccess) {
      list.push({
        id: 'stock',
        title: 'Mira Stock',
        description: 'Kumas stok giris-cikis, tedarik ve rapor akislarini yonetin.',
        route: '/stock',
        icon: Boxes,
        tone: 'stock',
      });
    }

if (user.fasonAccess) {
      list.push({
        id: 'fason',
        title: 'Mira Dış Kaynak Üretim Takip',
        description: 'Atolye surecleri, is emirleri ve mobil takip operasyonunu yonetin.',
        route: '/fason',
        icon: Truck,
        tone: 'fason',
      });

      list.push({
        id: 'kesimhane',
        title: 'Kesimhane',
        description: 'Kesim onerileri, kesimhane ekrani ve kumas donusum raporlari.',
        route: '/kesimhane',
        icon: Scissors,
        tone: 'fason',
      });
    }

    return list;
  }, [user.fasonAccess, user.stockAccess]);

  const quickActions = useMemo<QuickAction[]>(() => {
    const list: QuickAction[] = [
      {
        id: 'license-status',
        title: 'Lisans Durumu',
        description: 'Lisansin gecerlilik ve modul erisim durumunu kontrol edin.',
        route: '/license',
        icon: ShieldCheck,
      },
      {
        id: 'vehicles',
        title: 'Araclari Ac',
        description: 'Tum araclarin konum ve durum ekranina gecin.',
        route: '/vehicles',
        icon: Navigation,
      },
    ];

    if (user.stockAccess) {
      list.unshift(
        {
          id: 'fabric-entry',
          title: 'Kumas Girisi',
          description: 'Depoya yeni kumas girisi hareketi olusturun.',
          route: '/fabric-entry',
          icon: ClipboardPlus,
        },
        {
          id: 'stock-report',
          title: 'Stok Raporu',
          description: 'Anlik stok durumunu detayli raporlayin.',
          route: '/reports/stock',
          icon: BarChart3,
        }
      );
    }

    if (user.fasonAccess) {
      list.unshift(
        {
          id: 'fason-order',
          title: 'Is Emri Ac',
          description: 'Yeni dış kaynak üretim is emri olusturup atama yapin.',
          route: '/fason/create-work-order',
          icon: ClipboardPlus,
        },
        {
          id: 'fason-dashboard',
          title: 'Dış Kaynak Üretim Dashboard',
          description: 'Gecikme, durum ve atolye analizlerini inceleyin.',
          route: '/fason/dashboard',
          icon: Gauge,
        }
      );
    }

    return list;
  }, [user.fasonAccess, user.stockAccess]);

  const kpiCards = useMemo(() => {
    const cards: Array<{
      id: string;
      title: string;
      value: number;
      hint: string;
      icon: React.ComponentType<{ className?: string }>;
      tone: 'blue' | 'teal' | 'amber' | 'rose' | 'slate';
    }> = [
      {
        id: 'active-vehicles',
        title: 'Aktif Arac',
        value: kpiSummary.activeVehicles,
        hint: 'Konum guncelleyen arac sayisi',
        icon: Truck,
        tone: 'blue',
      },
    ];

    if (user.fasonAccess) {
      cards.push(
        {
          id: 'open-work-orders',
          title: 'Acik Dış Kaynak Üretim Isi',
          value: kpiSummary.openWorkOrders,
          hint: 'Teslim edilmemis is emirleri',
          icon: Factory,
          tone: 'teal',
        },
        {
          id: 'delayed-work-orders',
          title: 'Geciken Is',
          value: kpiSummary.delayedWorkOrders,
          hint: 'Termin tarihi gecen isler',
          icon: Clock3,
          tone: 'amber',
        },
        {
          id: 'urgent-work-orders',
          title: 'Acil / Sorunlu',
          value: kpiSummary.urgentWorkOrders,
          hint: 'Urgent veya sorunlu kayitlar',
          icon: ArrowRightCircle,
          tone: 'rose',
        }
      );
    }

    if (user.stockAccess) {
      cards.push(
        {
          id: 'fabric-count',
          title: 'Kumas Cesidi',
          value: kpiSummary.fabricCount,
          hint: 'Sistemdeki toplam kumas karti',
          icon: Boxes,
          tone: 'slate',
        },
        {
          id: 'low-stock',
          title: 'Kritik Stok',
          value: kpiSummary.lowStockCount,
          hint: '25 ve altindaki stok kalemleri',
          icon: Warehouse,
          tone: 'amber',
        }
      );
    }

    return cards;
  }, [kpiSummary, user.fasonAccess, user.stockAccess]);

  const userDisplay = user.name?.trim() || user.email;
  const avatarLetter = userDisplay.charAt(0).toUpperCase();

  const fetchKpis = useCallback(
    async (silent = false) => {
      if (silent) {
        setKpiRefreshing(true);
      } else {
        setKpiLoading(true);
      }

      setKpiError(null);
      const next: KpiSummary = { ...EMPTY_KPI };
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      let partialErrors = 0;

      try {
        const vehiclesResponse = await axios.get('/api/vehicles', { headers, timeout: 12000 });
        const vehicles = extractDataArray((vehiclesResponse as { data?: unknown }).data);
        next.activeVehicles = vehicles.filter((vehicle) => {
          const locations = asArray<unknown>((vehicle as { locations?: unknown }).locations);
          return locations.length > 0;
        }).length;
      } catch {
        partialErrors += 1;
      }

      if (user.fasonAccess) {
        try {
          const fasonResponse = await axios.get('/api/fason/work-orders?page=1&limit=100', {
            headers,
            timeout: 12000,
          });
          const orders = extractDataArray((fasonResponse as { data?: unknown }).data);
          next.openWorkOrders = orders.filter((order) => {
            const status = normalizeStatus(String((order as { status?: unknown }).status || ''));
            return status !== 'TESLIM_EDILDI' && status !== 'IPTAL_EDILDI';
          }).length;
          next.delayedWorkOrders = orders.filter((order) => {
            const deliveryDate = String((order as { deliveryDate?: unknown }).deliveryDate || '');
            const status = String((order as { status?: unknown }).status || '');
            return isDelayedOrder(deliveryDate || null, status);
          }).length;
          next.urgentWorkOrders = orders.filter((order) => {
            const status = normalizeStatus(String((order as { status?: unknown }).status || ''));
            const priority = String((order as { priority?: unknown }).priority || '').toUpperCase();
            return status === 'SORUN_VAR' || priority === 'URGENT';
          }).length;
        } catch {
          partialErrors += 1;
        }
      }

      if (user.stockAccess) {
        try {
          const fabricsResponse = await axios.get('/api/fabrics', { headers, timeout: 12000 });
          const fabrics = extractDataArray((fabricsResponse as { data?: unknown }).data);
          next.fabricCount = fabrics.length;
          next.lowStockCount = fabrics.filter((fabric) => {
            const stockValue = Number((fabric as { stockQuantity?: unknown }).stockQuantity ?? 0);
            return Number.isFinite(stockValue) && stockValue <= 25;
          }).length;
        } catch {
          partialErrors += 1;
        }
      }

      setKpiSummary(next);
      setKpiUpdatedAt(new Date());
      setKpiError(partialErrors > 0 ? 'Bazi KPI verileri su an alinmiyor.' : null);
      if (silent) {
        setKpiRefreshing(false);
      } else {
        setKpiLoading(false);
      }
    },
    [user.fasonAccess, user.stockAccess]
  );

  useEffect(() => {
    void fetchKpis(false);
  }, [fetchKpis]);

  useEffect(() => {
    if (!dropdownOpen) return undefined;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [dropdownOpen]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.replace('/login');
  };

  const getComponentForPath = useCallback(async (path: string): Promise<React.ComponentType | null> => {
    const basePath = stripQuery(path);
    const pathMap: Record<string, () => Promise<{ default: React.ComponentType }>> = {
      '/': () => import('../pages/home'),
      '/stock': () => import('../pages/stock'),
      '/fason': () => import('../pages/fason'),
      '/vehicles': () => import('../pages/vehicles/index'),
      '/license': () => import('../pages/license'),
      '/fabric-entry': () => import('../pages/fabric-entry'),
      '/reports/stock': () => import('../pages/reports/stock'),
      '/fason/create-work-order': () => import('../pages/fason/create-work-order'),
      '/fason/dashboard': () => import('../pages/fason/dashboard'),
      '/fason/cutting-suggestions': () => import('../pages/fason/cutting-suggestions'),
      '/fason/cutting-workshop': () => import('../pages/fason/cutting-workshop'),
      '/reports/cutting-fabric-conversion': () => import('../pages/reports/cutting-fabric-conversion'),
      '/kesimhane': () => import('../pages/kesimhane'),
    };

    const importFn = pathMap[path] || pathMap[basePath];
    if (!importFn) return null;

    try {
      const loaded = await importFn();
      return loaded.default;
    } catch (error) {
      console.error('Sayfa yuklenemedi:', path, error);
      return null;
    }
  }, []);

  const openModule = useCallback(
    async (route: string, title?: string) => {
      const component = await getComponentForPath(route);
      if (component) {
        addTab({
          title: title || ROUTE_TITLE_MAP[stripQuery(route)] || route,
          path: route,
          component,
          closable: true,
        });
        return;
      }

      router.push(route);
    },
    [addTab, getComponentForPath, router]
  );

  const openKpiTarget = (kpiId: string) => {
    const routeMap: Record<string, string> = {
      'active-vehicles': '/vehicles',
      'open-work-orders': '/fason/dashboard',
      'delayed-work-orders': '/fason/dashboard?focus=delayed',
      'urgent-work-orders': '/fason/dashboard?focus=urgent',
      'fabric-count': '/reports/stock',
      'low-stock': '/reports/stock?focus=low',
    };

    const route = routeMap[kpiId];
    if (route) {
      void openModule(route);
    }
  };

  const kpiUpdatedLabel = kpiUpdatedAt
    ? `Son guncelleme: ${kpiUpdatedAt.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : 'KPI verileri bekleniyor...';

  const onModuleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, route: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      void openModule(route);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div className={styles.heroContent}>
            <p className={styles.kicker}>MiraApp Platform</p>
            <h1 className={styles.title}>Operasyon Merkezi</h1>
            <p className={styles.subtitle}>
              Stok, dış kaynak üretim ve saha hareketlerini tek panelden yonetin. Erisim yetkilerinize gore
              hizli moduller burada listelenir.
            </p>
            <div className={styles.metaRow}>
              <span className={styles.metaChip}>
                <ShieldCheck className={styles.metaIcon} />
                {roleLabel(user.role)}
              </span>
              <span className={styles.metaChip}>
                <Sparkles className={styles.metaIcon} />
                {modules.length} Modul Aktif
              </span>
            </div>
          </div>

          <div className={styles.profileArea} ref={dropdownRef}>
            <button
              type="button"
              className={styles.profileButton}
              onClick={() => setDropdownOpen((prev) => !prev)}
            >
              <span className={styles.avatar}>{avatarLetter}</span>
              <span className={styles.profileText}>
                <strong>{userDisplay}</strong>
                <small>{user.email}</small>
              </span>
              <ChevronDown
                className={`${styles.chevron} ${dropdownOpen ? styles.chevronOpen : ''}`}
              />
            </button>

            {dropdownOpen ? (
              <div className={styles.dropdown}>
                <p className={styles.dropdownTitle}>{userDisplay}</p>
                <p className={styles.dropdownInfo}>{roleLabel(user.role)}</p>
                <button type="button" className={styles.logoutButton} onClick={handleLogout}>
                  <LogOut className={styles.logoutIcon} />
                  Cikis Yap
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <section className={styles.kpiSection}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Operasyon Ozeti</h2>
            <div className={styles.sectionActions}>
              <p className={styles.kpiMeta}>
                {kpiUpdatedLabel}
              </p>
              <button
                type="button"
                className={styles.kpiRefreshButton}
                onClick={() => void fetchKpis(true)}
              >
                <RefreshCw className={`${styles.kpiRefreshIcon} ${kpiRefreshing ? styles.kpiRefreshSpin : ''}`} />
                Yenile
              </button>
            </div>
          </div>

          {kpiError ? <p className={styles.kpiWarning}>{kpiError}</p> : null}

          <div className={styles.kpiGrid}>
            {kpiCards.map((card) => {
              const Icon = card.icon;
              const toneClass =
                card.tone === 'blue'
                  ? styles.kpiBlue
                  : card.tone === 'teal'
                    ? styles.kpiTeal
                    : card.tone === 'amber'
                      ? styles.kpiAmber
                      : card.tone === 'rose'
                        ? styles.kpiRose
                        : styles.kpiSlate;

              return (
                <button
                  key={card.id}
                  type="button"
                  className={`${styles.kpiCard} ${toneClass}`}
                  onClick={() => openKpiTarget(card.id)}
                >
                  <span className={styles.kpiIconWrap}>
                    <Icon className={styles.kpiIcon} />
                  </span>
                  <p className={styles.kpiTitle}>{card.title}</p>
                  <p className={styles.kpiValue}>{kpiLoading ? '...' : card.value}</p>
                  <p className={styles.kpiHint}>{card.hint}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className={styles.vehiclesSection}>
          <VehiclesWidget limit={5} />
        </section>

        <section className={styles.quickSection}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Hizli Islemler</h2>
            <p className={styles.sectionText}>
              Sik kullandiginiz ekranlara tek tikla gecin.
            </p>
          </div>
          <div className={styles.quickGrid}>
            {quickActions.map((action, index) => {
              const Icon = action.icon;

              return (
                <button
                  key={action.id}
                  type="button"
                    className={styles.quickActionCard}
                    style={{ animationDelay: `${index * 90}ms` }}
                    onClick={() => void openModule(action.route)}
                  >
                  <span className={styles.quickActionIconWrap}>
                    <Icon className={styles.quickActionIcon} />
                  </span>
                  <span className={styles.quickActionBody}>
                    <strong>{action.title}</strong>
                    <small>{action.description}</small>
                  </span>
                  <ArrowRightCircle className={styles.quickActionArrow} />
                </button>
              );
            })}
          </div>
        </section>

        <section className={styles.modulesSection}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Moduller</h2>
            <p className={styles.sectionText}>
              Isiniza hizli baslamak icin alttaki kartlardan ilgili modulu acabilirsiniz.
            </p>
          </div>

          {modules.length === 0 ? (
            <div className={styles.noAccessCard}>
              <Factory className={styles.noAccessIcon} />
              <p className={styles.noAccessTitle}>Erisim Yetkisi Bulunamadi</p>
              <p className={styles.noAccessText}>
                Hesabinizda aktif modul gorunmuyor. Sistem yoneticinizle iletisime gecin.
              </p>
            </div>
          ) : (
            <div className={styles.moduleGrid}>
              {modules.map((module, index) => {
                const Icon = module.icon;
                const toneClass = module.tone === 'stock' ? styles.stockCard : styles.fasonCard;

                return (
                  <button
                    key={module.id}
                    type="button"
                    className={`${styles.moduleCard} ${toneClass}`}
                    style={{ animationDelay: `${index * 120}ms` }}
                    onClick={() => void openModule(module.route)}
                    onKeyDown={(event) => onModuleKeyDown(event, module.route)}
                  >
                    <span className={styles.moduleIconWrap}>
                      <Icon className={styles.moduleIcon} />
                    </span>
                    <span className={styles.moduleTitle}>{module.title}</span>
                    <span className={styles.moduleDescription}>{module.description}</span>
                    <span className={styles.moduleAction}>Modulu Ac</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <footer className={styles.footer}>
          <p>
            (c) {new Date().getFullYear()} MiraApp - Kumas Stok ve Dış Kaynak Üretim Takip Platformu
          </p>
        </footer>
      </div>
      <div className={styles.backdropOne} />
      <div className={styles.backdropTwo} />
      <div className={styles.backdropThree} />
    </div>
  );
};

export default HomePage;

