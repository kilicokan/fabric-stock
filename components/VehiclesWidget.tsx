import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  MapPin,
  RefreshCw,
  Truck,
  UserRound,
} from 'lucide-react';
import styles from './VehiclesWidget.module.css';

interface VehicleLocation {
  latitude: number;
  longitude: number;
  address?: string;
  timestamp: string;
}

interface Vehicle {
  id: number;
  licensePlate: string;
  model?: string;
  color?: string;
  assignedUser?: {
    id: number;
    name?: string;
    email?: string;
  };
  locations?: VehicleLocation[];
}

interface VehiclesWidgetProps {
  limit?: number;
}

const getLatestLocation = (locations?: VehicleLocation[]): VehicleLocation | null => {
  if (!locations || locations.length === 0) return null;
  return [...locations].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0];
};

const formatRelativeTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Zaman bilgisi yok';

  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'Simdi';
  if (minutes < 60) return `${minutes} dk once`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} saat once`;
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
};

const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1] || ''));
    if (!payload || typeof payload.exp !== 'number') return true;
    return payload.exp < Date.now() / 1000;
  } catch {
    return true;
  }
};

const VehiclesWidget = ({ limit = 5 }: VehiclesWidgetProps) => {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVehicles = useCallback(
    async (silent = false) => {
      try {
        if (silent) setRefreshing(true);
        else setLoading(true);
        setError(null);

        const token = localStorage.getItem('token');
        if (!token || isTokenExpired(token)) {
          localStorage.removeItem('token');
          setVehicles([]);
          setError('Oturum bulunamadi. Lutfen yeniden giris yapin.');
          router.replace('/login');
          return;
        }

        const response = await axios.get('/api/vehicles', {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000,
        });

        const allVehicles = Array.isArray(response.data?.data) ? response.data.data : [];
        const activeVehicles = allVehicles.filter(
          (vehicle: Vehicle) => Array.isArray(vehicle.locations) && vehicle.locations.length > 0
        );

        setVehicles(activeVehicles.slice(0, limit));
      } catch (requestError) {
        const status = axios.isAxiosError(requestError)
          ? requestError.response?.status
          : undefined;

        if (status === 401) {
          localStorage.removeItem('token');
          setVehicles([]);
          setError('Oturum suresi doldu. Lutfen yeniden giris yapin.');
          router.replace('/login');
          return;
        }

        console.error('Araclar yuklenirken hata:', requestError);
        setVehicles([]);
        setError('Arac verisi alinamadi. Lutfen tekrar deneyin.');
      } finally {
        if (silent) setRefreshing(false);
        else setLoading(false);
      }
    },
    [limit, router]
  );

  useEffect(() => {
    void fetchVehicles(false);
  }, [fetchVehicles]);

  const summaryText = useMemo(() => {
    if (loading) return 'Arac listesi guncelleniyor...';
    if (vehicles.length === 0) return 'Konum bilgisi paylasan aktif arac bulunamadi.';
    return `${vehicles.length} aktif arac goruntuleniyor.`;
  }, [loading, vehicles.length]);

  const openVehicle = (vehicleId: number) => router.push(`/vehicles?id=${vehicleId}`);
  const openAllVehicles = () => router.push('/vehicles');

  return (
    <section className={styles.widget}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Saha Gorunumu</p>
          <h3 className={styles.title}>
            <Truck className={styles.titleIcon} />
            Aktif Araclar
          </h3>
          <p className={styles.subtitle}>{summaryText}</p>
        </div>

        <div className={styles.headerActions}>
          <span className={styles.counterBadge}>{vehicles.length}</span>
          <button
            type="button"
            className={styles.refreshButton}
            onClick={() => void fetchVehicles(true)}
          >
            <RefreshCw className={`${styles.refreshIcon} ${refreshing ? styles.spinning : ''}`} />
            Yenile
          </button>
          <button type="button" className={styles.viewAllButton} onClick={openAllVehicles}>
            Tumunu Gor
          </button>
        </div>
      </header>

      {loading ? (
        <div className={styles.loadingGrid}>
          {Array.from({ length: Math.max(Math.min(limit, 3), 2) }).map((_, index) => (
            <div key={`loading-${index}`} className={styles.loadingCard}>
              <div className={styles.loadingLinePrimary} />
              <div className={styles.loadingLine} />
              <div className={styles.loadingLineShort} />
            </div>
          ))}
        </div>
      ) : null}

      {!loading && error ? (
        <div className={styles.stateCard}>
          <AlertTriangle className={styles.stateIconError} />
          <p>{error}</p>
        </div>
      ) : null}

      {!loading && !error && vehicles.length === 0 ? (
        <div className={styles.stateCard}>
          <Truck className={styles.stateIconNeutral} />
          <p>Konum bilgisi olan aktif arac bulunamadi.</p>
        </div>
      ) : null}

      {!loading && !error && vehicles.length > 0 ? (
        <div className={styles.grid}>
          {vehicles.map((vehicle) => {
            const latestLocation = getLatestLocation(vehicle.locations);
            const driverName = vehicle.assignedUser?.name || 'Atanmamis';
            const address = latestLocation?.address
              ? latestLocation.address
              : latestLocation
                ? `${latestLocation.latitude.toFixed(4)}, ${latestLocation.longitude.toFixed(4)}`
                : 'Konum yok';

            return (
              <button
                key={vehicle.id}
                type="button"
                className={styles.vehicleCard}
                onClick={() => openVehicle(vehicle.id)}
              >
                <div className={styles.vehicleHeader}>
                  <div>
                    <p className={styles.plate}>{vehicle.licensePlate}</p>
                    <p className={styles.model}>{vehicle.model || 'Model bilgisi yok'}</p>
                  </div>
                  <ArrowRight className={styles.cardArrow} />
                </div>

                <div className={styles.row}>
                  <UserRound className={styles.rowIcon} />
                  <span>{driverName}</span>
                </div>
                <div className={styles.row}>
                  <MapPin className={styles.rowIcon} />
                  <span className={styles.addressText}>{address}</span>
                </div>
                <div className={styles.row}>
                  <Clock3 className={styles.rowIcon} />
                  <span>{latestLocation ? formatRelativeTime(latestLocation.timestamp) : 'Zaman yok'}</span>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
};

export default VehiclesWidget;
