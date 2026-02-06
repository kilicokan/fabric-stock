# Fason İş Takip Özellikleri - Implementasyon Planı

## ✅ Tamamlanan Görevler

### 1. Veritabanı Güncellemeleri
- [x] `FasonWorkshop` modeline `maxCapacity` alanı eklendi (default: 500.000 ₺)
  - Atölyenin maksimum kapasite limitini belirtir
  - Ayarlardan güncellenebilir

### 2. Backend API Endpoints

#### `POST /api/fason/workshops-capacity`
**Amaç**: Atölyelerin kapasite bilgilerini sağlamak
- **GET** (isteğe bağlı `workshopId` parametresi):
  - Tüm atölyelerin kapasite bilgisi
  - Her atölyenin:
    - `assignedOrderCount`: Atanan iş sayısı (BEKLIYOR + ATÖLYEDE)
    - `totalAssignedAmount`: Toplam atanan iş tutarı (₺)
    - `totalCompletedAmount`: Tamamlanan iş tutarı
    - `totalUsedCapacity`: Kullanılan kapasite (assigned + completed)
    - `maxCapacity`: Maksimum kapasite
    - `capacityPercentage`: Kapasite kullanım yüzdesi
    - `remainingCapacity`: Kalan kapasite
    - `orderStatuses`: Durum bazında iş sayıları

- **PUT** (kapasite güncelleme):
  - Atölyenin `maxCapacity`'sini günceller
  - Ayarlar ekranından çağrılır

#### `/api/fason/tracking`
**Güncellemeler**:
- `?forDashboard=true` parametresi eklendi
- Dashboard'da benzersiz iş emirlerini göstermek için her workOrder'ın en son tracking kaydını döndürür
- MobileTracker ve Dashboard aynı endpoint'i kullanabilir

### 3. Mobil Uygulama Güncellemeleri

#### `Workshops.js`
- **Kapasite verisi**: API'den gerçek kapasite bilgisi çekiliyor
- **Yeni gösterim**:
  - Kapasite çubuğu (visual progress bar)
  - Atanan tutarı: ₺{amount}
  - Kapasite limiti: ₺{maxCapacity}
  - Kalan kapasite: ₺{remaining}
- **Duruma göre renkler**:
  - 90%+: Çok Dolu (Kırmızı #EF4444)
  - 70-89%: Dolu (Sarı #F59E0B)
  - 50-69%: Orta (Mavi #3B82F6)
  - 0-49%: Boş (Yeşil #10B981)
- **İş durumları**: BEKLIYOR, İŞLENİYOR, TAMAMLANDI sayıları

#### `Dashboard.js` (Atanan İş Emirleri)
- **Tracking endpoint'den veri çekiliyor**: `/api/fason/tracking?forDashboard=true`
- **Gösterilen veriler**:
  - Emir No, Müşteri, Ürün Adı
  - İş durumu ve ilerleme yüzdesi
  - Son teslim tarihi
  - Atanan kişi
- **Durum dönüşümü**:
  - BEKLIYOR/ALINDI → pending (0%)
  - ATÖLYEDE/HAZIR → in-progress (50%)
  - TESLIM_EDILDI → completed (100%)

#### `MobileTracker.js` (Benim İşlerim)
- **Tracking endpoint'den veri çekiliyor**: `/api/fason/tracking`
- **Token ile kimlik doğrulama**: Authorization header'da Bearer token gönderiliyor
- **Aynı veriler gösteriliyor**: Dashboard'daki bilgiler + atölyenin ismi
- **Fallback mekanizması**: localhost'a otomatik yönlendirme

### 4. Veri Dönüşümleri

**Process Status → Görüntüleme Durumu**:
```
BEKLIYOR       → pending (0%)
ALINDI         → pending (25%)
ATÖLYEDE       → in-progress (50%)
HAZIR          → in-progress (75%)
TESLIM_EDILDI  → completed (100%)
SORUN_VAR      → pending (50%)
IPTAL_EDILDI   → pending (0%)
```

**Priority Dönüşümü**:
```
HIGH   → high
MEDIUM → medium
LOW    → normal
```

## 📋 İmplementasyon Detayları

### Kapasite Hesaplama Algoritması
1. Atölyeye atanan tüm tracking kayıtlarını bul (IPTAL_EDILDI hariç)
2. Duruma göre grupla (BEKLIYOR, ATÖLYEDE, HAZIR, TESLIM_EDILDI, SORUN_VAR)
3. Atanan tutarı hesapla: BEKLIYOR + ATÖLYEDE statusundaki `totalPrice` toplamı
4. Tamamlanan tutarı hesapla: HAZIR + TESLIM_EDILDI statusundaki `totalPrice` toplamı
5. Kullanılan kapasite: atanan + tamamlanan
6. Yüzde: (kullanılan / maxCapacity) * 100
7. Kalan: maxCapacity - kullanılan

### Token Yönetimi (Mobil)
- localStorage'da saklanan JWT token
- API isteklerinde `Authorization: Bearer {token}` header'ında gönderiliyor
- Fallback: localhost'a otomatik yönlendirme ağ hatası durumunda

## 🔄 Veri Akışı

```
WorkOrder ↓
FasonTracking ← userId, workshopId, totalPrice, status
     ↓
/api/fason/tracking → (for dashboard/mobile)
     ↓
forDashboard=true → Benzersiz workOrder'lar
     ↓
Dashboard + MobileTracker'da gösterim

FasonWorkshop
     ↓
/api/fason/workshops-capacity → Kapasite hesaplaması
     ↓
FasonTracking (assigned + completed) tutarları topla
     ↓
Workshops.js → Kapasite gösterimi
```

## 🚀 Sonraki Adımlar

1. **Prisma Migration**:
   ```bash
   npx prisma migrate dev --name add_max_capacity_to_workshop
   ```
   - `FasonWorkshop.maxCapacity` alanını veritabanına ekler

2. **Test Etme**:
   - `npm run dev` ile backend başlat
   - Mobil app'te API endpoints'in çalışıp çalışmadığını test et
   - Network sekmesinde istekleri kontrol et

3. **Ayarlar Ekranı** (Optional):
   - Workshop maxCapacity'sini güncellemek için UI oluştur
   - PUT `/api/fason/workshops-capacity` endpoint'i kullan

4. **Analytics** (İsteğe Bağlı):
   - Workshop'ların tarihsel kapasite kullanımını track et
   - Grafik gösterimler ekle

## 📝 API Örneği Responses

### GET `/api/fason/workshops-capacity`
```json
{
  "workshops": [
    {
      "id": 1,
      "name": "Kesim Atölyesi",
      "maxCapacity": 500000,
      "assignedOrderCount": 5,
      "totalAssignedAmount": 150000,
      "totalCompletedAmount": 50000,
      "totalUsedCapacity": 200000,
      "capacityPercentage": 40,
      "remainingCapacity": 300000,
      "orderStatuses": {
        "pending": 2,
        "inProgress": 3,
        "completed": 5,
        "problems": 0
      },
      "totalOrders": 10
    }
  ]
}
```

### GET `/api/fason/tracking?forDashboard=true`
```json
[
  {
    "id": 1,
    "workOrderId": 123,
    "status": "ATÖLYEDE",
    "totalPrice": 50000,
    "workOrder": {
      "id": 123,
      "orderNo": "E-001",
      "customerName": "Müşteri A",
      "productName": "Ürün 1",
      "quantity": 100,
      "deliveryDate": "2025-02-15",
      "priority": "HIGH"
    },
    "workshop": {
      "id": 1,
      "name": "Kesim Atölyesi"
    },
    "user": {
      "name": "Tracker 1"
    }
  }
]
```
