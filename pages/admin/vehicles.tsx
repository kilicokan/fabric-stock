import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import styles from '@/styles/admin-vehicles.module.css';

declare const google: any;

type Vehicle = {
  id: number;
  licensePlate: string;
  model?: string;
  color?: string;
  capacity?: number;
  isActive?: boolean;
  assignedUser?: {
    id: number;
    name: string;
    email: string;
  };
  locations?: Array<{
    latitude: number;
    longitude: number;
    address?: string;
    timestamp: string;
  }>;
};

export default function AdminVehicles() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    fetchVehicles();
    loadGoogleMaps();
  }, []);

  useEffect(() => {
    if (mapReady && vehicles.length > 0) {
      initializeMap();
    }
  }, [mapReady, vehicles]);

  const fetchVehicles = async () => {
    try {
      const response = await fetch('/api/vehicles', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Araçlar yüklenemedi');
      }

      const data = await response.json();
      setVehicles(data.data || []);
    } catch (error) {
      console.error('Araçları yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGoogleMaps = () => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapReady(true);
    document.body.appendChild(script);
  };

  const initializeMap = () => {
    if (typeof google === 'undefined') return;

    const mapElement = document.getElementById('vehicles-map');
    if (!mapElement) return;

    // Türkiye'nin merkezi
    const turkey = { lat: 39.0, lng: 35.0 };

    const map = new google.maps.Map(mapElement, {
      zoom: 6,
      center: turkey,
      mapTypeId: 'roadmap',
    });

    // Tüm araçların konumlarını haritaya ekle
    vehicles.forEach((vehicle) => {
      const location = vehicle.locations?.[0];
      if (location) {
        const marker = new google.maps.Marker({
          position: {
            lat: location.latitude,
            lng: location.longitude,
          },
          map,
          title: vehicle.licensePlate,
          icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
        });

        // Info window
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="font-family: Arial, sans-serif; min-width: 250px;">
              <h3 style="margin: 0 0 8px 0; color: #1f2937;">${vehicle.licensePlate}</h3>
              ${vehicle.model ? `<p style="margin: 4px 0; font-size: 12px; color: #666;"><strong>Model:</strong> ${vehicle.model}</p>` : ''}
              ${vehicle.assignedUser?.name ? `<p style="margin: 4px 0; font-size: 12px; color: #666;"><strong>Sürücü:</strong> ${vehicle.assignedUser.name}</p>` : ''}
              <p style="margin: 4px 0; font-size: 11px; color: #999;">
                📍 ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}
              </p>
              ${location.address ? `<p style="margin: 4px 0; font-size: 12px; color: #666;">${location.address}</p>` : ''}
              <p style="margin: 4px 0; font-size: 10px; color: #999;">
                ⏰ ${new Date(location.timestamp).toLocaleString('tr-TR')}
              </p>
            </div>
          `,
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
          setSelectedVehicle(vehicle);
        });
      }
    });

    // Tüm markerlerin görünmesi için bounds ayarla
    const bounds = new google.maps.LatLngBounds();
    vehicles.forEach((vehicle) => {
      const location = vehicle.locations?.[0];
      if (location) {
        bounds.extend({
          lat: location.latitude,
          lng: location.longitude,
        });
      }
    });

    if (vehicles.some((v) => v.locations?.length)) {
      map.fitBounds(bounds);
    }
  };

  const getLocationStatus = (vehicle: Vehicle) => {
    if (!vehicle.locations || vehicle.locations.length === 0) {
      return { status: 'Konum Bilinmiyor', color: '#ef4444', icon: '❌' };
    }
    const lastLocation = vehicle.locations[0];
    const timeDiff = Date.now() - new Date(lastLocation.timestamp).getTime();
    const minutesAgo = Math.floor(timeDiff / 60000);

    if (minutesAgo < 5) {
      return { status: 'Aktif (Şimdi)', color: '#10b981', icon: '✅' };
    } else if (minutesAgo < 30) {
      return { status: `Aktif (${minutesAgo} dk. önce)`, color: '#3b82f6', icon: '🟢' };
    } else if (minutesAgo < 120) {
      return { status: `Eski (${Math.floor(minutesAgo / 60)}s. önce)`, color: '#f59e0b', icon: '🟡' };
    } else {
      return { status: 'Çok Eski Bilgi', color: '#6b7280', icon: '⚪' };
    }
  };

  if (loading) {
    return (
      <Layout title="Admin - Araç Takip">
        <div className={styles.container}>
          <div className={styles.loadingContainer}>
            <div className={styles.spinner}></div>
            <p>Araçlar yükleniyor...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Admin - Araç Takip">
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>📍 Araç Konum Takip Paneli</h1>
            <p className={styles.subtitle}>
              Tüm araçların harita üzerinde gerçek zamanlı konumlarını görüntüleyin
            </p>
          </div>
          <button onClick={fetchVehicles} className={styles.refreshBtn}>
            🔄 Yenile
          </button>
        </div>

        <div className={styles.mainContent}>
          {/* Harita */}
          <div className={styles.mapContainer}>
            <div id="vehicles-map" className={styles.map}></div>
          </div>

          {/* Araçlar Listesi */}
          <div className={styles.vehiclesList}>
            <div className={styles.listHeader}>
              <h2 className={styles.listTitle}>Araçlar ({vehicles.length})</h2>
              <div className={styles.stats}>
                <span className={styles.statBadge}>
                  ✅ Aktif: {vehicles.filter((v) => v.locations?.length).length}
                </span>
                <span className={styles.statBadge} style={{ borderColor: '#ef4444', color: '#ef4444' }}>
                  ❌ Pasif: {vehicles.filter((v) => !v.locations?.length).length}
                </span>
              </div>
            </div>

            <div className={styles.listContent}>
              {vehicles.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>Henüz kayıtlı araç bulunmamaktadır.</p>
                </div>
              ) : (
                vehicles.map((vehicle) => {
                  const locationStatus = getLocationStatus(vehicle);
                  const lastLocation = vehicle.locations?.[0];

                  return (
                    <div
                      key={vehicle.id}
                      className={`${styles.vehicleItem} ${
                        selectedVehicle?.id === vehicle.id ? styles.vehicleItemSelected : ''
                      }`}
                      onClick={() => setSelectedVehicle(vehicle)}
                    >
                      <div className={styles.vehicleHeader}>
                        <div className={styles.vehicleInfo}>
                          <h3 className={styles.vehiclePlate}>{vehicle.licensePlate}</h3>
                          {vehicle.model && (
                            <p className={styles.vehicleModel}>{vehicle.model}</p>
                          )}
                        </div>
                        <div
                          className={styles.statusBadge}
                          style={{
                            borderColor: locationStatus.color,
                            color: locationStatus.color,
                          }}
                        >
                          <span>{locationStatus.icon}</span>
                          <span>{locationStatus.status}</span>
                        </div>
                      </div>

                      {lastLocation && (
                        <div className={styles.vehicleDetails}>
                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>📍 Konumu:</span>
                            <span className={styles.detailValue}>
                              {lastLocation.latitude.toFixed(6)}, {lastLocation.longitude.toFixed(6)}
                            </span>
                          </div>
                          {lastLocation.address && (
                            <div className={styles.detailRow}>
                              <span className={styles.detailLabel}>🏠 Adres:</span>
                              <span className={styles.detailValue}>{lastLocation.address}</span>
                            </div>
                          )}
                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>⏰ Güncelleme:</span>
                            <span className={styles.detailValue}>
                              {new Date(lastLocation.timestamp).toLocaleString('tr-TR')}
                            </span>
                          </div>
                        </div>
                      )}

                      {vehicle.assignedUser && (
                        <div className={styles.driverInfo}>
                          <span>👤 {vehicle.assignedUser.name}</span>
                          <span className={styles.driverEmail}>{vehicle.assignedUser.email}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
