import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
  Modal,
  Platform,
  AppState,
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { io } from 'socket.io-client';
import {
  Package,
  Clock,
  CheckCircle,
  Truck,
  AlertCircle,
  ArrowLeft,
  MapPin,
  Search,
  User,
  Save,
  Home,
  BarChart3,
  Settings,
  Bell,
} from 'lucide-react-native';

// API base URL - change this to your server's IP if running on device/emulator
// For Android emulator: http://10.0.2.2:3000
// For iOS simulator: http://localhost:3000
// For physical device: http://YOUR_IP:3000
const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');
const THEME = {
  primary: '#0F4C81',
  primaryDark: '#0B3458',
  primarySoft: '#E8F1F8',
  accent: '#0EA5A4',
  surface: '#FFFFFF',
  background: '#F3F6FB',
  text: '#0F172A',
  textMuted: '#64748B',
  border: '#D8E2EE',
};

const MobileTracker = () => {
  const [workOrders, setWorkOrders] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [popupNotification, setPopupNotification] = useState(null);
  const [activeFilter, setActiveFilter] = useState('TÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼');
  const [isAdmin, setIsAdmin] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [vehiclesError, setVehiclesError] = useState(null);

  const [formData, setFormData] = useState({
    processType: 'DIKIM',
    status: 'ALINDI',
    workshopId: '',
    notes: '',
    problemNotes: ''
  });

  const knownAssignedOrderIdsRef = useRef(new Set());
  const hasInitializedOrderSnapshotRef = useRef(false);
  const popupTimeoutRef = useRef(null);
  const socketRef = useRef(null);
  const lastAssignmentCheckAtRef = useRef(Date.now());

  const getWorkOrdersFromResponse = (responseData) => {
    if (Array.isArray(responseData?.workOrders)) {
      return responseData.workOrders;
    }

    if (Array.isArray(responseData?.data?.workOrders)) {
      return responseData.data.workOrders;
    }

    if (Array.isArray(responseData?.data)) {
      return responseData.data;
    }

    return [];
  };

  const showOrderPopup = (newOrders) => {
    if (!newOrders || newOrders.length === 0) return;

    const listedOrders = newOrders.slice(0, 3).map((order) => order.orderNo).join(', ');
    const extraCount = newOrders.length - 3;
    const extraText = extraCount > 0 ? ` ve ${extraCount} is emri daha` : '';
    const message = `${listedOrders}${extraText} mobil uygulamaya atandi.`;

    setPopupNotification({
      title: 'Yeni Is Emri',
      message,
      createdAt: Date.now(),
    });

    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current);
    }

    popupTimeoutRef.current = setTimeout(() => {
      setPopupNotification(null);
    }, 6000);

    Alert.alert('Yeni Is Emri', message);
  };

  const getOrderAssignmentTimestamp = (order) => {
    if (!order) {
      return 0;
    }

    const dateCandidate = order.mobileAssignmentDate || order.updatedAt || order.createdAt;
    if (!dateCandidate) {
      return 0;
    }

    const parsed = new Date(dateCandidate).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const syncNewAssignments = (orders, shouldNotify = false) => {
    const mobileAssignedOrders = orders.filter((order) => order.assignedToMobile !== false);
    const latestAssignedIds = new Set(mobileAssignedOrders.map((order) => String(order.id)));
    const latestAssignmentTimestamp = mobileAssignedOrders.reduce((maxValue, order) => {
      const assignmentTimestamp = getOrderAssignmentTimestamp(order);
      return Math.max(maxValue, assignmentTimestamp);
    }, 0);

    if (!hasInitializedOrderSnapshotRef.current) {
      knownAssignedOrderIdsRef.current = latestAssignedIds;
      if (latestAssignmentTimestamp > 0) {
        lastAssignmentCheckAtRef.current = latestAssignmentTimestamp;
      }
      hasInitializedOrderSnapshotRef.current = true;
      return;
    }

    if (shouldNotify) {
      const newOrdersById = mobileAssignedOrders.filter(
        (order) => !knownAssignedOrderIdsRef.current.has(String(order.id))
      );
      const newOrdersByDate = mobileAssignedOrders.filter((order) => {
        const assignmentTimestamp = getOrderAssignmentTimestamp(order);
        return (
          assignmentTimestamp > lastAssignmentCheckAtRef.current &&
          !knownAssignedOrderIdsRef.current.has(String(order.id))
        );
      });

      const mergedOrdersMap = new Map();
      [...newOrdersById, ...newOrdersByDate].forEach((order) => {
        mergedOrdersMap.set(String(order.id), order);
      });
      const newOrders = Array.from(mergedOrdersMap.values());

      if (newOrders.length > 0) {
        showOrderPopup(newOrders);
      }
    }

    knownAssignedOrderIdsRef.current = latestAssignedIds;
    if (latestAssignmentTimestamp > 0) {
      lastAssignmentCheckAtRef.current = Math.max(
        lastAssignmentCheckAtRef.current,
        latestAssignmentTimestamp
      );
    }
  };

  const rememberAssignedOrder = (orderId) => {
    if (orderId === undefined || orderId === null) {
      return;
    }

    knownAssignedOrderIdsRef.current.add(String(orderId));

    if (!hasInitializedOrderSnapshotRef.current) {
      hasInitializedOrderSnapshotRef.current = true;
    }

    lastAssignmentCheckAtRef.current = Date.now();
  };

  const handleRealtimeOrderAssigned = (payload) => {
    const realtimeOrder = payload?.order || payload;
    const realtimeOrderId = realtimeOrder?.id;

    if (!realtimeOrderId) {
      return;
    }

    const normalizedId = String(realtimeOrderId);

    if (knownAssignedOrderIdsRef.current.has(normalizedId)) {
      return;
    }

    rememberAssignedOrder(realtimeOrderId);
    showOrderPopup([
      {
        ...realtimeOrder,
        orderNo: realtimeOrder.orderNo || `#${realtimeOrderId}`,
        assignedToMobile: true,
      },
    ]);

    fetchWorkOrders({ notifyOnNew: false }).catch((error) => {
      console.error('Error refreshing after realtime order assignment:', error);
    });
  };

  const initializeSocketConnection = async () => {
    try {
      await axios.get(`${API_BASE}/api/socket`);
    } catch (error) {
      console.error('Error initializing socket endpoint:', error);
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const socket = io(API_BASE, {
      path: '/api/socket.io/',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    socket.on('connect', () => {
      console.log('[MobileTracker] Socket connected:', socket.id);
      socket.emit('register-mobile-tracker');
    });

    socket.on('mobile-work-order-assigned', handleRealtimeOrderAssigned);

    socket.on('disconnect', (reason) => {
      console.log('[MobileTracker] Socket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('[MobileTracker] Socket connection error:', error?.message || error);
    });

    socketRef.current = socket;
  };

  const fetchWorkOrders = async ({ notifyOnNew = false } = {}) => {
    const token = await AsyncStorage.getItem('token');
    const workOrdersResponse = await axios.get(`${API_BASE}/api/mobile-work-orders`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const parsedOrders = getWorkOrdersFromResponse(workOrdersResponse.data);
    setWorkOrders(parsedOrders);
    syncNewAssignments(parsedOrders, notifyOnNew);
    return parsedOrders;
  };

  const formatVehicleTime = (timestamp) => {
    if (!timestamp) {
      return 'Zaman bilinmiyor';
    }

    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'Su an';
      if (diffMins < 60) return `${diffMins} dakika once`;

      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} saat once`;

      return date.toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' });
    } catch {
      return 'Zaman bilinmiyor';
    }
  };

  const getVehicleLocationText = (locationData) => {
    if (!locationData) {
      return 'Konum bilgisi yok';
    }

    if (locationData.address) {
      return locationData.address;
    }

    const lat = typeof locationData.latitude === 'number' ? locationData.latitude.toFixed(4) : null;
    const lng = typeof locationData.longitude === 'number' ? locationData.longitude.toFixed(4) : null;

    if (lat && lng) {
      return `${lat}, ${lng}`;
    }

    return 'Konum bilgisi yok';
  };

  const fetchAdminVehicles = async (token) => {
    if (!token) {
      setVehicles([]);
      setVehiclesError(null);
      setVehiclesLoading(false);
      return;
    }

    try {
      setVehiclesLoading(true);
      const response = await axios.get(`${API_BASE}/api/vehicles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const allVehicles = response.data?.data || [];
      const activeVehicles = allVehicles.filter(
        (vehicle) => Array.isArray(vehicle.locations) && vehicle.locations.length > 0
      );
      setVehicles(activeVehicles.slice(0, 5));
      setVehiclesError(null);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      setVehicles([]);
      setVehiclesError('Araclar yuklenirken bir hata olustu');
    } finally {
      setVehiclesLoading(false);
    }
  };

  const syncAdminVehicleVisibility = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setIsAdmin(false);
        setVehicles([]);
        setVehiclesError(null);
        setVehiclesLoading(false);
        return;
      }

      const userResponse = await axios.get(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const role = userResponse.data?.user?.role;
      const adminUser = typeof role === 'string' && role.toLowerCase() === 'admin';

      setIsAdmin(adminUser);

      if (!adminUser) {
        setVehicles([]);
        setVehiclesError(null);
        setVehiclesLoading(false);
        return;
      }

      await fetchAdminVehicles(token);
    } catch (error) {
      console.warn('Admin role check failed for mobile tracker:', error?.message || error);
      setIsAdmin(false);
      setVehicles([]);
      setVehiclesError(null);
      setVehiclesLoading(false);
    }
  };

  // Deliberately initialize subscriptions once on mount.
  useEffect(() => {
    fetchData();
    initializeSocketConnection();

    const intervalId = setInterval(() => {
      fetchWorkOrders({ notifyOnNew: true }).catch((error) => {
        console.error('Error polling work orders:', error);
      });
    }, 5000);
    const vehiclesIntervalId = setInterval(() => {
      syncAdminVehicleVisibility().catch((error) => {
        console.error('Error polling admin vehicles:', error);
      });
    }, 30000);

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        if (!socketRef.current || !socketRef.current.connected) {
          initializeSocketConnection();
        }

        fetchWorkOrders({ notifyOnNew: true }).catch((error) => {
          console.error('Error refreshing on app active:', error);
        });
        syncAdminVehicleVisibility().catch((error) => {
          console.error('Error refreshing admin vehicles on app active:', error);
        });
      }
    });

    return () => {
      clearInterval(intervalId);
      clearInterval(vehiclesIntervalId);
      appStateSubscription.remove();

      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch work orders from fabric-stock API (public endpoint for mobile)
      await fetchWorkOrders({ notifyOnNew: false });

      await syncAdminVehicleVisibility();

      // Fetch workshops (public endpoint)
      const workshopsResponse = await axios.get(`${API_BASE}/api/mobile-workshops`);
      setWorkshops(workshopsResponse.data.workshops || []);

      // Get current location
      getCurrentLocation();
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Hata', 'Veriler yÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼klenirken bir hata oluÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€¦Ã‚Â¸tu');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('UyarÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±', 'Konum izni verilmedi.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      setLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
      return;
    } catch (error) {
      console.error('Konum hatasÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±:', error);
      Alert.alert('UyarÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±', 'Konum bilgisi alÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±namadÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±.');
      return;
    }

    if (!navigator.geolocation) {
      Alert.alert('UyarÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±', 'Konum servisi desteklenmiyor.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.error('Konum hatasÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±:', error);
        Alert.alert('UyarÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±', 'Konum bilgisi alÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±namadÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±.');
      }
    );
  };

  const handleSubmit = async () => {
    if (!selectedOrder) return;

    setLoading(true);
    try {
      const trackingData = {
        workOrderId: selectedOrder.id,
        workshopId: formData.workshopId || null,
        processType: formData.processType,
        status: formData.status,
        pickupDate: formData.status === 'ALINDI' ? new Date().toISOString() : null,
        deliveryDate: formData.status === 'TESLIM_EDILDI' ? new Date().toISOString() : null,
        notes: formData.notes,
        problemNotes: formData.problemNotes,
        latitude: location?.lat,
        longitude: location?.lng,
      };

      try {
        const token = await AsyncStorage.getItem('token');
        await axios.post(`${API_BASE}/api/fason/tracking`, trackingData, {
          headers: { 
            ...(token && { Authorization: `Bearer ${token}` })
          }
        });
      } catch (storageError) {
        console.warn('Token not available:', storageError);
        // Proceed without auth if token not set
        await axios.post(`${API_BASE}/api/fason/tracking`, trackingData);
      }

      Alert.alert('BaÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€¦Ã‚Â¸arÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±lÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±', 'Takip kaydÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â± baÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€¦Ã‚Â¸arÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±yla oluÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€¦Ã‚Â¸turuldu!');
      setFormData({
        processType: 'DIKIM',
        status: 'ALINDI',
        workshopId: '',
        notes: '',
        problemNotes: ''
      });
      setSelectedOrder(null);
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error creating tracking:', error);
      Alert.alert('Hata', 'KayÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±t sÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±rasÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±nda hata oluÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€¦Ã‚Â¸tu!');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    const icons = {
      'ALINDI': Package,
      'ATÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“LYEDE': Clock,
      'HAZIR': CheckCircle,
      'TESLIM_EDILDI': Truck,
      'SORUN_VAR': AlertCircle,
    };
    return icons[status] || Clock;
  };

  const getStatusColor = (status) => {
    const colors = {
      'ALINDI': '#3B82F6',
      'ATÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“LYEDE': '#F59E0B',
      'HAZIR': '#10B981',
      'TESLIM_EDILDI': '#059669',
      'SORUN_VAR': '#EF4444',
    };
    return colors[status] || '#6B7280';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'YÃƒÆ’Ã†â€™Ãƒâ€¦Ã¢â‚¬Å“KSEK': '#EF4444',
      'ORTA': '#F59E0B',
      'DÃƒÆ’Ã†â€™Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€¦Ã¢â‚¬Å“K': '#10B981',
    };
    return colors[priority] || '#6B7280';
  };

  const filteredOrders = workOrders.filter(order =>
    order.assignedToMobile !== false &&
    ((order.orderNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (order.productCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customerName?.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (activeFilter === 'TÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼' || order.status === activeFilter)
  );

  const statusFilters = ['TÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼', 'ALINDI', 'ATÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“LYEDE', 'HAZIR', 'TESLIM_EDILDI', 'SORUN_VAR'];

  const renderWorkOrderItem = ({ item }) => {
    const StatusIcon = getStatusIcon(item.status);

    return (
      <TouchableOpacity
        style={styles.workOrderCard}
        onPress={() => setSelectedOrder(item)}
      >
        <View style={styles.workOrderHeader}>
          <View style={styles.workOrderInfo}>
            <Text style={styles.orderNo}>{item.orderNo}</Text>
            {item.priority && (
              <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) + '20', borderColor: getPriorityColor(item.priority) }]}>
                <Text style={[styles.priorityText, { color: getPriorityColor(item.priority) }]}>{item.priority}</Text>
              </View>
            )}
          </View>
          <View style={[styles.statusIcon, { backgroundColor: getStatusColor(item.status) }]}>
            <StatusIcon size={20} color="white" />
          </View>
        </View>

        <Text style={styles.productCode}>{item.productCode}</Text>
        {item.productName && <Text style={styles.productName}>{item.productName}</Text>}

        <View style={styles.workOrderFooter}>
          <View style={styles.customerInfo}>
            <User size={14} color="#6B7280" />
            <Text style={styles.customerName}>{item.customerName}</Text>
          </View>
          <View style={styles.quantityInfo}>
            <Package size={14} color="#6B7280" />
            <Text style={styles.quantity}>{item.quantity} adet</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.primary} />
        <Text style={styles.loadingText}>YÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼kleniyor...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Modal transparent visible={!!popupNotification} animationType="fade">
        <View style={styles.popupOverlay}>
          <View style={styles.popupCard}>
            <Text style={styles.popupTitle}>{popupNotification?.title}</Text>
            <Text style={styles.popupMessage}>{popupNotification?.message}</Text>
            <TouchableOpacity
              style={styles.popupButton}
              onPress={() => setPopupNotification(null)}
            >
              <Text style={styles.popupButtonText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            {selectedOrder ? (
              <TouchableOpacity onPress={() => setSelectedOrder(null)} style={styles.backButton}>
                <ArrowLeft size={24} color="white" />
              </TouchableOpacity>
            ) : (
              <View style={styles.logoContainer}>
                <Truck size={28} color="white" />
              </View>
            )}
            <View>
              <Text style={styles.headerTitle}>MIRA STOK</Text>
              <Text style={styles.headerSubtitle}>
                {selectedOrder ? 'ÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€¦Ã‚Â¸ Emri DetayÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±' : 'Dış Kaynak Üretim Takip'}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            {location && (
              <View style={styles.locationBadge}>
                <MapPin size={16} color={THEME.accent} />
                <Text style={styles.locationText}>Konum Aktif</Text>
              </View>
            )}
            <TouchableOpacity style={styles.notificationButton}>
              <Bell size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Statistics */}
        {!selectedOrder && (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{workOrders.length}</Text>
              <Text style={styles.statLabel}>Toplam SipariÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€¦Ã‚Â¸</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {workOrders.filter(o => o.status === 'ATÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“LYEDE').length}
              </Text>
              <Text style={styles.statLabel}>Devam Eden</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {workOrders.filter(o => o.status === 'SORUN_VAR').length}
              </Text>
              <Text style={styles.statLabel}>Sorunlu</Text>
            </View>
          </View>
        )}
      </View>

      <ScrollView style={styles.content}>
        {!selectedOrder ? (
          <>
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Search size={20} color="#9CA3AF" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="SipariÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€¦Ã‚Â¸ no, ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼n kodu veya mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€¦Ã‚Â¸teri ara..."
                value={searchTerm}
                onChangeText={setSearchTerm}
              />
            </View>

            {/* Filters */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
              {statusFilters.map((filter) => (
                <TouchableOpacity
                  key={filter}
                  style={[
                    styles.filterButton,
                    activeFilter === filter && styles.activeFilterButton
                  ]}
                  onPress={() => setActiveFilter(filter)}
                >
                  <Text style={[
                    styles.filterText,
                    activeFilter === filter && styles.activeFilterText
                  ]}>
                    {filter}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Active Vehicles (Admin only) */}
            {isAdmin && (
              <View style={styles.vehiclesWidget}>
                <Text style={styles.vehiclesTitle}>ÄŸÅ¸Å¡â€” Aktif AraÃƒÂ§lar</Text>

                {vehiclesLoading ? (
                  <View style={styles.vehiclesStateContainer}>
                    <ActivityIndicator size="small" color={THEME.primary} />
                    <Text style={styles.vehiclesStateText}>Araclar yukleniyor...</Text>
                  </View>
                ) : vehiclesError ? (
                  <View style={styles.vehiclesStateContainer}>
                    <AlertCircle size={24} color="#EF4444" />
                    <Text style={styles.vehiclesStateText}>{vehiclesError}</Text>
                  </View>
                ) : vehicles.length === 0 ? (
                  <View style={styles.vehiclesStateContainer}>
                    <Truck size={24} color={THEME.textMuted} />
                    <Text style={styles.vehiclesStateText}>Konum bilgisi olan aktif araÃƒÂ§ bulunamadÃ„Â±</Text>
                  </View>
                ) : (
                  <View style={styles.vehicleList}>
                    {vehicles.map((vehicle, index) => {
                      const lastLocation = vehicle.locations?.[0];
                      const driverName = vehicle.assignedUser?.name || null;

                      return (
                        <View
                          key={vehicle.id || `${vehicle.licensePlate}-${index}`}
                          style={[
                            styles.vehicleCard,
                            index > 0 && styles.vehicleCardBorder,
                          ]}
                        >
                          <View style={styles.vehicleHeader}>
                            <Text style={styles.vehiclePlate}>{vehicle.licensePlate}</Text>
                            {vehicle.model ? (
                              <Text style={styles.vehicleModel}>{vehicle.model}</Text>
                            ) : null}
                          </View>

                          {driverName ? (
                            <View style={styles.vehicleRow}>
                              <User size={14} color={THEME.textMuted} />
                              <Text style={styles.vehicleRowText}>{driverName}</Text>
                            </View>
                          ) : null}

                          <View style={styles.vehicleRow}>
                            <MapPin size={14} color="#DC2626" />
                            <Text style={styles.vehicleRowText} numberOfLines={1}>
                              {getVehicleLocationText(lastLocation)}
                            </Text>
                          </View>

                          <View style={styles.vehicleRow}>
                            <Clock size={14} color={THEME.textMuted} />
                            <Text style={styles.vehicleTimeText}>
                              {formatVehicleTime(lastLocation?.timestamp)}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}


            {/* Work Orders List */}
            <Text style={styles.sectionTitle}>ÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€¦Ã‚Â¸ Emirleri ({filteredOrders.length})</Text>
            <FlatList
              data={filteredOrders}
              renderItem={renderWorkOrderItem}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Search size={48} color="#D1D5DB" />
                  <Text style={styles.emptyTitle}>SonuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ bulunamadÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±</Text>
                  <Text style={styles.emptySubtitle}>
                    Arama kriterlerinize uygun iÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€¦Ã‚Â¸ emri bulunamadÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±.
                  </Text>
                </View>
              }
            />
          </>
        ) : (
          <View style={styles.detailContainer}>
            {/* Selected Order Info */}
            <View style={styles.selectedOrderCard}>
              <View style={styles.selectedOrderHeader}>
                <Text style={styles.selectedOrderTitle}>{selectedOrder.orderNo}</Text>
                <Text style={styles.selectedOrderStatus}>{selectedOrder.status.replace('_', ' ')}</Text>
              </View>
              <Text style={styles.selectedOrderProduct}>{selectedOrder.productCode}</Text>
              {selectedOrder.productName && (
                <Text style={styles.selectedOrderProductName}>{selectedOrder.productName}</Text>
              )}
              <View style={styles.selectedOrderFooter}>
                <View style={styles.selectedOrderInfo}>
                  <User size={16} color="#E2E8F0" />
                  <Text style={styles.selectedOrderCustomer}>{selectedOrder.customerName}</Text>
                </View>
                <View style={styles.selectedOrderInfo}>
                  <Package size={16} color="#E2E8F0" />
                  <Text style={styles.selectedOrderQuantity}>{selectedOrder.quantity} adet</Text>
                </View>
              </View>
            </View>

            {/* Tracking Form */}
            <View style={styles.formContainer}>
              {/* Process Type */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>SÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼reÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ Tipi</Text>
                <View style={styles.selectContainer}>
                  <Text style={styles.selectText}>
                    {formData.processType === 'DIKIM' && 'Dikim'}
                    {formData.processType === 'BASKI_NAKIS' && 'BaskÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±/NakÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€¦Ã‚Â¸'}
                    {formData.processType === 'UTU' && 'ÃƒÆ’Ã†â€™Ãƒâ€¦Ã¢â‚¬Å“tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼'}
                  </Text>
                </View>
              </View>

              {/* Status */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Durum</Text>
                <View style={styles.statusGrid}>
                  {[
                    { value: 'ALINDI', label: 'AlÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±ndÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±', icon: Package },
                    { value: 'ATÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“LYEDE', label: 'AtÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¶lyede', icon: Clock },
                    { value: 'HAZIR', label: 'HazÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±r', icon: CheckCircle },
                    { value: 'TESLIM_EDILDI', label: 'Teslim Edildi', icon: Truck },
                    { value: 'SORUN_VAR', label: 'Sorun Var', icon: AlertCircle },
                  ].map((status) => {
                    const StatusIcon = status.icon;
                    return (
                      <TouchableOpacity
                        key={status.value}
                        style={[
                          styles.statusButton,
                          formData.status === status.value && styles.activeStatusButton
                        ]}
                        onPress={() => setFormData({ ...formData, status: status.value })}
                      >
                        <StatusIcon size={20} color={formData.status === status.value ? "white" : "#6B7280"} />
                        <Text style={[
                          styles.statusButtonText,
                          formData.status === status.value && styles.activeStatusButtonText
                        ]}>
                          {status.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Workshop */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>AtÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¶lye (Opsiyonel)</Text>
                <View style={styles.selectContainer}>
                  <Text style={styles.selectText}>
                    {formData.workshopId
                      ? workshops.find(w => w.id === parseInt(formData.workshopId))?.name || 'AtÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¶lye seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§in'
                      : 'AtÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¶lye seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§in'
                    }
                  </Text>
                </View>
              </View>

              {/* Notes */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Notlar</Text>
                <TextInput
                  style={styles.textArea}
                  multiline
                  numberOfLines={3}
                  placeholder="Genel notlarÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±nÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±zÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â± buraya yazÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±n..."
                  value={formData.notes}
                  onChangeText={(text) => setFormData({ ...formData, notes: text })}
                />
              </View>

              {/* Problem Notes */}
              {formData.status === 'SORUN_VAR' && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Sorun AÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±klamasÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±</Text>
                  <TextInput
                    style={styles.textArea}
                    multiline
                    numberOfLines={3}
                    placeholder="YaÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€¦Ã‚Â¸anan sorunu detaylandÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±rÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±n..."
                    value={formData.problemNotes}
                    onChangeText={(text) => setFormData({ ...formData, problemNotes: text })}
                  />
                </View>
              )}

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Save size={20} color="white" />
                    <Text style={styles.submitButtonText}>Takip KaydÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±nÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â± Kaydet</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      {!selectedOrder && (
        <View style={styles.bottomNav}>
          <TouchableOpacity style={[styles.navItem, styles.activeNavItem]}>
            <Home size={24} color={THEME.primary} />
            <Text style={[styles.navText, styles.activeNavText]}>Ana Sayfa</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem}>
            <BarChart3 size={24} color={THEME.textMuted} />
            <Text style={styles.navText}>ÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â°statistik</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem}>
            <Bell size={24} color={THEME.textMuted} />
            <Text style={styles.navText}>Bildirim</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem}>
            <Settings size={24} color={THEME.textMuted} />
            <Text style={styles.navText}>Ayarlar</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: THEME.textMuted,
  },
  header: {
    backgroundColor: THEME.primary,
    padding: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#0B3458',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  logoContainer: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 23,
    fontWeight: '700',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14, 165, 164, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
  },
  locationText: {
    color: '#7DE4DB',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  notificationButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.17)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.88)',
  },
  content: {
    flex: 1,
    padding: 16,
    marginTop: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: THEME.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: THEME.text,
  },
  vehiclesWidget: {
    backgroundColor: THEME.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  vehiclesTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.text,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    backgroundColor: '#F8FBFF',
  },
  vehiclesStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 22,
    paddingHorizontal: 16,
  },
  vehiclesStateText: {
    marginTop: 8,
    fontSize: 14,
    color: THEME.textMuted,
    textAlign: 'center',
  },
  vehicleList: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  vehicleCard: {
    paddingVertical: 10,
  },
  vehicleCardBorder: {
    borderTopWidth: 1,
    borderTopColor: THEME.border,
  },
  vehicleHeader: {
    marginBottom: 6,
  },
  vehiclePlate: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.primary,
  },
  vehicleModel: {
    fontSize: 13,
    color: THEME.textMuted,
    marginTop: 2,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    gap: 6,
  },
  vehicleRowText: {
    fontSize: 13,
    color: THEME.text,
    flex: 1,
  },
  vehicleTimeText: {
    fontSize: 12,
    color: THEME.textMuted,
  },
  filtersContainer: {
    marginBottom: 16,
  },
  filterButton: {
    backgroundColor: THEME.primarySoft,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
  },
  activeFilterButton: {
    backgroundColor: THEME.primary,
  },
  filterText: {
    color: THEME.primaryDark,
    fontSize: 14,
    fontWeight: '500',
  },
  activeFilterText: {
    color: 'white',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.text,
    marginBottom: 16,
  },
  workOrderCard: {
    backgroundColor: THEME.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  workOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  workOrderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  orderNo: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.text,
    marginRight: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  productName: {
    fontSize: 14,
    color: THEME.textMuted,
    marginBottom: 8,
  },
  workOrderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerName: {
    fontSize: 14,
    color: THEME.textMuted,
    marginLeft: 4,
  },
  quantityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantity: {
    fontSize: 14,
    color: THEME.textMuted,
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: THEME.textMuted,
    textAlign: 'center',
  },
  detailContainer: {
    paddingBottom: 100,
  },
  selectedOrderCard: {
    backgroundColor: THEME.primaryDark,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1D5B8A',
  },
  selectedOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectedOrderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  selectedOrderStatus: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  selectedOrderProduct: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 4,
  },
  selectedOrderProductName: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 12,
  },
  selectedOrderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  selectedOrderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedOrderCustomer: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 8,
  },
  selectedOrderQuantity: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 8,
  },
  formContainer: {
    backgroundColor: THEME.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.text,
    marginBottom: 8,
  },
  selectContainer: {
    backgroundColor: '#F8FBFF',
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 12,
    padding: 16,
  },
  selectText: {
    fontSize: 16,
    color: THEME.text,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: THEME.primarySoft,
    flex: 1,
    minWidth: '48%',
  },
  activeStatusButton: {
    backgroundColor: THEME.primary,
  },
  statusButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: THEME.textMuted,
  },
  activeStatusButtonText: {
    color: 'white',
  },
  textArea: {
    backgroundColor: '#F8FBFF',
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: THEME.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    shadowColor: '#0B3458',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: THEME.surface,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  activeNavItem: {
    // Active state styling
  },
  navText: {
    fontSize: 12,
    color: THEME.textMuted,
    marginTop: 4,
  },
  activeNavText: {
    color: THEME.primary,
  },
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 16,
  },
  popupCard: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  popupTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.primaryDark,
    marginBottom: 6,
  },
  popupMessage: {
    fontSize: 14,
    color: THEME.text,
    lineHeight: 20,
    marginBottom: 12,
  },
  popupButton: {
    alignSelf: 'flex-end',
    backgroundColor: THEME.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  popupButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default MobileTracker;



