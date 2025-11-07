import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import axios from 'axios';
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

const MobileTracker = ({ navigation }) => {
  const [workOrders, setWorkOrders] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('Tümü');

  const [formData, setFormData] = useState({
    processType: 'DIKIM',
    status: 'ALINDI',
    workshopId: '',
    notes: '',
    problemNotes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch work orders from fabric-stock API
      const workOrdersResponse = await axios.get('http://localhost:3000/api/fason/work-orders', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      // Filter only mobile assigned orders
      const mobileAssignedOrders = (workOrdersResponse.data.workOrders || []).filter(
        (order) => order.assignedToMobile === true
      );
      setWorkOrders(mobileAssignedOrders);

      // Fetch workshops
      const workshopsResponse = await axios.get('http://localhost:3000/api/fason/workshops', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setWorkshops(workshopsResponse.data || []);

      // Get current location
      getCurrentLocation();
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Hata', 'Veriler yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      Alert.alert('Uyarı', 'Konum servisi desteklenmiyor.');
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
        console.error('Konum hatası:', error);
        Alert.alert('Uyarı', 'Konum bilgisi alınamadı.');
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

      await axios.post('http://localhost:3000/api/fason/tracking', trackingData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      Alert.alert('Başarılı', 'Takip kaydı başarıyla oluşturuldu!');
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
      Alert.alert('Hata', 'Kayıt sırasında hata oluştu!');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    const icons = {
      'ALINDI': Package,
      'ATÖLYEDE': Clock,
      'HAZIR': CheckCircle,
      'TESLIM_EDILDI': Truck,
      'SORUN_VAR': AlertCircle,
    };
    return icons[status] || Clock;
  };

  const getStatusColor = (status) => {
    const colors = {
      'ALINDI': '#3B82F6',
      'ATÖLYEDE': '#F59E0B',
      'HAZIR': '#10B981',
      'TESLIM_EDILDI': '#059669',
      'SORUN_VAR': '#EF4444',
    };
    return colors[status] || '#6B7280';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'YÜKSEK': '#EF4444',
      'ORTA': '#F59E0B',
      'DÜŞÜK': '#10B981',
    };
    return colors[priority] || '#6B7280';
  };

  const filteredOrders = workOrders.filter(order =>
    order.assignedToMobile &&
    (order.orderNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customerName?.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (activeFilter === 'Tümü' || order.status === activeFilter)
  );

  const statusFilters = ['Tümü', 'ALINDI', 'ATÖLYEDE', 'HAZIR', 'TESLIM_EDILDI', 'SORUN_VAR'];

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
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
                {selectedOrder ? 'İş Emri Detayı' : 'Fason Takip'}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            {location && (
              <View style={styles.locationBadge}>
                <MapPin size={16} color="#10B981" />
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
              <Text style={styles.statLabel}>Toplam Sipariş</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {workOrders.filter(o => o.status === 'ATÖLYEDE').length}
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
                placeholder="Sipariş no, ürün kodu veya müşteri ara..."
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

            {/* Work Orders List */}
            <Text style={styles.sectionTitle}>İş Emirleri ({filteredOrders.length})</Text>
            <FlatList
              data={filteredOrders}
              renderItem={renderWorkOrderItem}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Search size={48} color="#D1D5DB" />
                  <Text style={styles.emptyTitle}>Sonuç bulunamadı</Text>
                  <Text style={styles.emptySubtitle}>
                    Arama kriterlerinize uygun iş emri bulunamadı.
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
                  <User size={16} color="#6B7280" />
                  <Text style={styles.selectedOrderCustomer}>{selectedOrder.customerName}</Text>
                </View>
                <View style={styles.selectedOrderInfo}>
                  <Package size={16} color="#6B7280" />
                  <Text style={styles.selectedOrderQuantity}>{selectedOrder.quantity} adet</Text>
                </View>
              </View>
            </View>

            {/* Tracking Form */}
            <View style={styles.formContainer}>
              {/* Process Type */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Süreç Tipi</Text>
                <View style={styles.selectContainer}>
                  <Text style={styles.selectText}>
                    {formData.processType === 'DIKIM' && 'Dikim'}
                    {formData.processType === 'BASKI_NAKIS' && 'Baskı/Nakış'}
                    {formData.processType === 'UTU' && 'Ütü'}
                  </Text>
                </View>
              </View>

              {/* Status */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Durum</Text>
                <View style={styles.statusGrid}>
                  {[
                    { value: 'ALINDI', label: 'Alındı', icon: Package },
                    { value: 'ATÖLYEDE', label: 'Atölyede', icon: Clock },
                    { value: 'HAZIR', label: 'Hazır', icon: CheckCircle },
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
                <Text style={styles.formLabel}>Atölye (Opsiyonel)</Text>
                <View style={styles.selectContainer}>
                  <Text style={styles.selectText}>
                    {formData.workshopId
                      ? workshops.find(w => w.id === parseInt(formData.workshopId))?.name || 'Atölye seçin'
                      : 'Atölye seçin'
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
                  placeholder="Genel notlarınızı buraya yazın..."
                  value={formData.notes}
                  onChangeText={(text) => setFormData({ ...formData, notes: text })}
                />
              </View>

              {/* Problem Notes */}
              {formData.status === 'SORUN_VAR' && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Sorun Açıklaması</Text>
                  <TextInput
                    style={styles.textArea}
                    multiline
                    numberOfLines={3}
                    placeholder="Yaşanan sorunu detaylandırın..."
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
                    <Text style={styles.submitButtonText}>Takip Kaydını Kaydet</Text>
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
            <Home size={24} color="#8B5CF6" />
            <Text style={[styles.navText, styles.activeNavText]}>Ana Sayfa</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem}>
            <BarChart3 size={24} color="#9CA3AF" />
            <Text style={styles.navText}>İstatistik</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem}>
            <Bell size={24} color="#9CA3AF" />
            <Text style={styles.navText}>Bildirim</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem}>
            <Settings size={24} color="#9CA3AF" />
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
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    backgroundColor: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
    padding: 16,
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
  },
  locationText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '500',
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 12,
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
    color: 'rgba(255, 255, 255, 0.9)',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  filtersContainer: {
    marginBottom: 16,
  },
  filterButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
  },
  activeFilterButton: {
    backgroundColor: '#8B5CF6',
  },
  filterText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
  activeFilterText: {
    color: 'white',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  workOrderCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
    fontWeight: 'bold',
    color: '#111827',
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
    color: '#374151',
    marginBottom: 4,
  },
  productName: {
    fontSize: 14,
    color: '#6B7280',
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
    color: '#6B7280',
    marginLeft: 4,
  },
  quantityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantity: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  detailContainer: {
    paddingBottom: 100,
  },
  selectedOrderCard: {
    backgroundColor: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
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
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  selectContainer: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
  },
  selectText: {
    fontSize: 16,
    color: '#111827',
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
    backgroundColor: '#F3F4F6',
    flex: 1,
    minWidth: '48%',
  },
  activeStatusButton: {
    backgroundColor: '#8B5CF6',
  },
  statusButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeStatusButtonText: {
    color: 'white',
  },
  textArea: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
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
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingVertical: 12,
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
    color: '#9CA3AF',
    marginTop: 4,
  },
  activeNavText: {
    color: '#8B5CF6',
  },
});

export default MobileTracker;
