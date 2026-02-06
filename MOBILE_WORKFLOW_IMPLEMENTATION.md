# Mobil Uygulama İş Emirleri - Workflow Implementation

## 📋 Özet

Mobil uygulamada "Benim İşlerim" sekmesinde atanan iş emirlerine tıklayıp atölye yönetimini sağlamayan workflow uygulaması.

## 🏗️ Mimari

### Backend (Fabric-Stock)

**Yeni Endpoint**: `POST /api/fason/work-orders/mobile-workflow`
- Token doğrulaması gerekir
- Workflow akışını kontrol eder

**Detay Endpoint**: `GET /api/fason/work-orders/mobile-detail?id={orderId}`
- Token gerektirmez (PUBLIC)
- İş emri detaylarını ve tüm workflow geçmişini döner

### Mobil (MiraStokMobile)

**Yeni Ekran**: `OrderDetail.tsx`
- Sipariş detaylarını gösterir
- Workflow modals'larını yönetir
- 3 modal: Workshop seç, Teslim al formu, Atölye ata

**Güncellenmiş**: `MobileTracker.js`
- OrderDetail'e navigation eklendi

**App.js**
- OrderDetail route'u eklendi

## 🔄 Workflow Akışı

```
1. BAŞLAT
   - Atölye seçim modal'ı açılır
   - "Başla" butonuna tıklanır
   - Action: startWorkshop
   - Status: ATÖLYEDE
   ↓
2. TESLİM AL
   - "Teslim Al" butonuna tıklanır
   - Form modal: adet, defo, fire, tamir
   - Action: receiveFromWorkshop
   - Status: HAZIR
   ↓
3. İKİ SEÇENEĞİ YOK
   ├─ A) ATÖLYE ATA (Varsa sonraki atölye)
   │   - "Atölye Ata" butonuna tıklanır
   │   - Workshop seçim modal'ı
   │   - Action: assignNextWorkshop
   │   - Yeni workflow BEKLIYOR status'unda oluşturulur
   │   - Step 2'ye geri dön
   │
   └─ B) BİTİR (Son atölye ise)
       - "Bitir" butonuna tıklanır
       - Onay dialog
       - Action: finalReceive
       - WorkOrder Status: TESLIM_EDILDI
       - Tüm workflow'lar: TESLIM_EDILDI
       - Üretim tamamlandı ✓
```

## 📊 Database Schema

### WorkOrder
- `id`: primary key
- `orderNo`: sipariş numarası
- `productName`: ürün adı
- `customerName`: müşteri
- `quantity`: adet
- `status`: OrderStatus (BEKLIYOR, ALINDI, ATÖLYEDE, HAZIR, TESLIM_EDILDI, SORUN_VAR)
- `deliveryDate`: teslim tarihi

### FasonTracking
- `id`: primary key
- `workOrderId`: FK
- `workshopId`: FK
- `userId`: FK
- `processType`: ProcessType (DIKIM, UTU, BASKI_NAKIS)
- `status`: ProcessStatus (BEKLIYOR, ALINDI, ATÖLYEDE, HAZIR, TESLIM_EDILDI)
- `assignedQuantity`: teslim alınan/atanan adet
- `problemNotes`: defo/fire/tamir not'ları
- `startDate`, `endDate`: işlem tarihleri

### FasonWorkshop
- `id`: primary key
- `name`: atölye adı
- `specialization`: WorkshopType (DIKIM, UTU, BASKI_NAKIS)
- `isActive`: aktif mi

## 🔌 API Endpoints

### POST /api/fason/work-orders/mobile-workflow
```json
// Request
{
  "action": "startWorkshop" | "receiveFromWorkshop" | "assignNextWorkshop" | "finalReceive",
  "workOrderId": number,
  "workshopId": number,
  "quantity": number,          // receiveFromWorkshop için
  "defective": number,         // receiveFromWorkshop için
  "damaged": number,           // receiveFromWorkshop için
  "repaired": number           // receiveFromWorkshop için
}

// Response
{
  "success": true,
  "message": string,
  "tracking": FasonTracking,   // startWorkshop ve assignNextWorkshop
  "workOrder": WorkOrder       // finalReceive
}
```

### GET /api/fason/work-orders/mobile-detail?id={orderId}
```json
// Response
{
  "workOrder": {
    "id": number,
    "orderNo": string,
    "productName": string,
    "customerName": string,
    "quantity": number,
    "deliveryDate": string,
    "status": string
  },
  "workflows": [
    {
      "id": number,
      "workshopId": number,
      "workshopName": string,
      "processType": string,
      "status": string,
      "assignedQuantity": number,
      "notes": string
    }
  ]
}
```

## 🎯 UI Butonları

### Durum: ATÖLYEDE
- **Teslim Al** (yeşil) → receiveFromWorkshop modal aç

### Durum: HAZIR
- **Atölye Ata** (sarı) → workshop seçim modal'ı aç
- **Bitir** (yeşil) → finalReceive (son atölye ise)

### İlk Durumu (workflow yok)
- **Başlat** (mavi) → workshop seçim modal'ı aç

## 📱 Modal'lar

### 1. Workshop Seç (Başla / Atölye Ata)
- Tüm aktif atölyelerin listesi
- Radio button seçim
- "Başlat" veya "Ata" butonları

### 2. Teslim Al Formu
- Teslim Alınan Adet (zorunlu)
- Defo (opsiyonel)
- Fire (opsiyonel)
- Tamir (opsiyonel)
- "Teslim Al" butonu

### 3. Sonraki Atölyeyi Seç
- Workshop seçim modal'ı (aynı)
- "Ata" butonu

## ✅ Implementasyon Checklist

- [x] Backend workflow endpoint (`mobile-workflow.ts`)
- [x] Backend detay endpoint (`mobile-detail.ts`)
- [x] Mobil OrderDetail ekranı
- [x] MobileTracker navigation güncellemesi
- [x] App.js routing
- [x] ProcessType dinamik belirleme
- [x] Modal'lar (3 adet)
- [x] Form validasyonları
- [x] CORS ayarları

## 🚀 Test Edilecekler

1. Atölye seçip başlat → ATÖLYEDE status'u
2. Teslim al formu → HAZIR status'u
3. Sonraki atölye ata → Yeni workflow BEKLIYOR
4. Tekrar başlat → Yeni workflow ATÖLYEDE
5. Tekrar teslim al → HAZIR
6. Bitir → TESLIM_EDILDI (tüm workflow'lar)

## 📝 Notlar

- Token'ı global.token'dan al
- API_BASE URL'si localhost:3000 (yapılandırılabilir)
- Türkçe dil desteği
- Dark/Light tema desteği
- Loading ve error handling

## 🔐 Güvenlik

- JWT token doğrulaması (`Bearer {token}`)
- Sadece authorized kullanıcılar işlem yapabilir
- Public endpoints: mobile-workshops, mobile-work-orders, mobile-detail
