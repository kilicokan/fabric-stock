import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import axios from 'axios';
import {
  ArrowLeft,
  Download,
  FileText,
  FileSpreadsheet,
  File,
  Package,
  Building,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
} from 'lucide-react-native';

// API base URL
const API_BASE = 'http://localhost:3000';
const THEME = {
  primary: '#0F4C81',
  primaryDark: '#0B3458',
  primarySoft: '#E8F1F8',
  surface: '#FFFFFF',
  background: '#F3F6FB',
  text: '#0F172A',
  textMuted: '#64748B',
  border: '#D8E2EE',
};

const WorkOrderDetails = ({ navigation }) => {
  const [trackingData, setTrackingData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchTrackingData();
  }, []);

  const fetchTrackingData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/api/fason/tracking`);
      setTrackingData(response.data.data || []);
    } catch (error) {
      console.error('Error fetching tracking data:', error);
      Alert.alert('Hata', 'Veriler yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    const icons = {
      'ALINDI': Package,
      'ATÖLYEDE': Clock,
      'HAZIR': CheckCircle,
      'TESLIM_EDILDI': CheckCircle,
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

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCompletionTime = (tracking) => {
    // Use deliveryDate if available, otherwise endDate
    return tracking.deliveryDate || tracking.endDate;
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      // Prepare data for export
      const exportData = trackingData.map(tracking => ({
        'İş Emri No': tracking.workOrder?.orderNo || '',
        'Ürün Kodu': tracking.workOrder?.productCode || '',
        'Ürün Adı': tracking.workOrder?.productName || '',
        'Müşteri': tracking.workOrder?.customerName || '',
        'Atölye': tracking.workshop?.name || 'Atanmamış',
        'Süreç Tipi': tracking.processType,
        'Aşama': tracking.status,
        'Tamamlanma Zamanı': formatDate(getCompletionTime(tracking)),
        'Oluşturulma': formatDate(tracking.createdAt),
        'Notlar': tracking.notes || '',
      }));

      // For mobile, we'll show an alert for now
      // In a real implementation, you'd use react-native-fs or similar
      Alert.alert(
        'Dışa Aktarma',
        `${format.toUpperCase()} dışa aktarma özelliği mobil uygulamada henüz desteklenmiyor. Lütfen web versiyonunu kullanın.`,
        [{ text: 'Tamam' }]
      );

      // TODO: Implement actual export for mobile
      // This would require additional libraries like:
      // - react-native-fs for file system access
      // - react-native-share for sharing files
      // - Or server-side export with download

    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Hata', 'Dışa aktarma sırasında hata oluştu');
    } finally {
      setExporting(false);
    }
  };

  const renderTrackingItem = ({ item }) => {
    const StatusIcon = getStatusIcon(item.status);
    const completionTime = getCompletionTime(item);

    return (
      <View style={styles.trackingCard}>
        <View style={styles.cardHeader}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderNo}>{item.workOrder?.orderNo}</Text>
            <Text style={styles.productCode}>{item.workOrder?.productCode}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <StatusIcon size={16} color={getStatusColor(item.status)} />
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status.replace('_', ' ')}
            </Text>
          </View>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Ürün</Text>
              <Text style={styles.value}>{item.workOrder?.productName || '-'}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Atölye</Text>
              <Text style={styles.value}>{item.workshop?.name || 'Atanmamış'}</Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Süreç Tipi</Text>
              <Text style={styles.value}>{item.processType}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Tamamlanma</Text>
              <Text style={styles.value}>{formatDate(completionTime)}</Text>
            </View>
          </View>

          {item.workOrder?.customerName && (
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Müşteri</Text>
                <Text style={styles.value}>{item.workOrder.customerName}</Text>
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Miktar</Text>
                <Text style={styles.value}>{item.workOrder?.quantity} adet</Text>
              </View>
            </View>
          )}

          {item.notes && (
            <View style={styles.notesSection}>
              <Text style={styles.label}>Notlar</Text>
              <Text style={styles.notesText}>{item.notes}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.primary} />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation?.goBack?.()}
            style={styles.backButton}
          >
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>MIRA STOK</Text>
            <Text style={styles.headerSubtitle}>İş Emri Detayları</Text>
          </View>
        </View>

        {/* Export Buttons */}
        <View style={styles.exportButtons}>
          <TouchableOpacity
            style={[styles.exportButton, exporting && styles.exportButtonDisabled]}
            onPress={() => handleExport('pdf')}
            disabled={exporting}
          >
            <FileText size={20} color="white" />
            <Text style={styles.exportButtonText}>PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.exportButton, exporting && styles.exportButtonDisabled]}
            onPress={() => handleExport('excel')}
            disabled={exporting}
          >
            <FileSpreadsheet size={20} color="white" />
            <Text style={styles.exportButtonText}>Excel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.exportButton, exporting && styles.exportButtonDisabled]}
            onPress={() => handleExport('csv')}
            disabled={exporting}
          >
            <File size={20} color="white" />
            <Text style={styles.exportButtonText}>CSV</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>İş Emri Takip Geçmişi ({trackingData.length})</Text>

        <FlatList
          data={trackingData}
          renderItem={renderTrackingItem}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Package size={64} color="#D1D5DB" />
              </View>
              <Text style={styles.emptyTitle}>Kayıt bulunamadı</Text>
              <Text style={styles.emptySubtitle}>
                Henüz iş emri takip kaydı bulunmuyor.
              </Text>
            </View>
          }
        />
      </ScrollView>
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
    backgroundColor: THEME.background,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 17,
    color: THEME.textMuted,
    fontWeight: '500',
  },
  header: {
    backgroundColor: THEME.primary,
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: THEME.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backButton: {
    padding: 10,
    marginRight: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: 'white',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
  },
  exportButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
    minWidth: 80,
  },
  exportButtonDisabled: {
    opacity: 0.5,
  },
  exportButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: THEME.text,
    marginBottom: 20,
    letterSpacing: 0.25,
  },
  trackingCard: {
    backgroundColor: THEME.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  orderInfo: {
    flex: 1,
  },
  orderNo: {
    fontSize: 19,
    fontWeight: '700',
    color: THEME.text,
    marginBottom: 6,
    letterSpacing: 0.25,
  },
  productCode: {
    fontSize: 15,
    color: THEME.textMuted,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    gap: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardContent: {
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 20,
  },
  col: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  value: {
    fontSize: 15,
    color: THEME.text,
    fontWeight: '500',
    lineHeight: 20,
  },
  notesSection: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    backgroundColor: '#F8FBFF',
    borderRadius: 12,
    padding: 12,
  },
  notesText: {
    fontSize: 14,
    color: THEME.textMuted,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    marginBottom: 24,
    opacity: 0.6,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: THEME.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '400',
  },
});

export default WorkOrderDetails;
