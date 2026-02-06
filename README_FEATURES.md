# 🎯 Fason İş Takip Özellikleri - Kılavuz

Bu dokümantasyon yeni eklenen fason iş takip özelliklerini anlatır.

---

## 📋 İçindekiler

1. **[QUICK_START.md](QUICK_START.md)** - 🚀 30 saniyede başlat
2. **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - 📝 Teknik özet  
3. **[FEATURE_IMPLEMENTATION.md](FEATURE_IMPLEMENTATION.md)** - 🔧 Detaylı teknik plan
4. **[IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md)** - ✅ Kontrol listesi
5. **[FILES_CHANGED.md](FILES_CHANGED.md)** - 📂 Değiştirilen dosyalar

---

## 🎁 Sunulan Özellikler

### 1️⃣ Tracking Senkronizasyonu
**Ne oldu?** Mobile takip benim işlerim alanında gözüken işler artık dashboard'da da gözüküyor.

✅ **Nasıl çalışıyor?**
- Aynı `/api/fason/tracking` endpoint'i kullanılıyor
- Dashboard: `?forDashboard=true` parametresi
- MobileTracker: Standart tracking veriyi çekiyor
- Her workOrder'ın en son tracking kaydı gösteriliyor

📍 **Dosyalar**: 
- Backend: `pages/api/fason/tracking.ts`
- Frontend: `screens/Dashboard.js`, `screens/MobileTracker.js`

---

### 2️⃣ Workshop Kapasite Yönetimi
**Ne oldu?** Atölyelerin kapasite kullanımı artık real-time olarak hesaplanıyor ve gösteriliyor.

✅ **Gösterilen Bilgiler**:
```
Atölyenin Adı: Kesim Atölyesi
Kapasite Durumu: ORTA (40% dolu)

Atanan İşler:        ₺150.000
Kapasite Limiti:     ₺500.000  
Kalan Kapasite:      ₺350.000
Doluluk Yüzdesi:     30%

Duruma göre renkler:
🔴 Çok Dolu (90%+)
🟠 Dolu (70-89%)
🔵 Orta (50-69%)
🟢 Boş (0-49%)
```

📍 **Dosyalar**:
- Backend: `pages/api/fason/workshops-capacity.ts` (YENİ)
- Database: `prisma/schema.prisma` (maxCapacity alanı)
- Frontend: `screens/Workshops.js`

---

## 🔧 Teknik Detaylar

### API Endpoints

#### Workshop Kapasitesi
```bash
# Tüm atölyelerin kapasite bilgisi
GET /api/fason/workshops-capacity
Authorization: Bearer {token}

# Belirli atölyenin kapasite bilgisi
GET /api/fason/workshops-capacity?workshopId=1
Authorization: Bearer {token}

# Atölyenin maksimum kapasitesini güncelle
PUT /api/fason/workshops-capacity
Authorization: Bearer {token}
Content-Type: application/json

{
  "workshopId": 1,
  "maxCapacity": 750000
}
```

#### Tracking Verisi
```bash
# Dashboard için benzersiz işleri getir
GET /api/fason/tracking?forDashboard=true
Authorization: Bearer {token}

# MobileTracker için tüm işleri getir
GET /api/fason/tracking
Authorization: Bearer {token}

# Belirli kullanıcının işleri
GET /api/fason/tracking?userId=5
Authorization: Bearer {token}
```

### Kapasite Hesaplama

Algoritma:
```
1. Atölyeye atanan tüm tracking kayıtlarını getir
2. Status'a göre grupla: pending, inProgress, completed, problems
3. Atanan tutarını hesapla: BEKLIYOR + ATÖLYEDE status'undaki totalPrice
4. Tamamlanan tutarını hesapla: HAZIR + TESLIM_EDILDI status'undaki totalPrice
5. Kullanılan kapasite: atanan + tamamlanan
6. Yüzde: (kullanılan / maxCapacity) × 100
7. Durum: Yüzdeye göre renk belirt
```

### Status Dönüşümleri

**Process Status → UI Status**:
| Process Status | UI Status | İlerleme |
|---|---|---|
| BEKLIYOR | pending | 0% |
| ALINDI | pending | 25% |
| ATÖLYEDE | in-progress | 50% |
| HAZIR | in-progress | 75% |
| TESLIM_EDILDI | completed | 100% |
| SORUN_VAR | pending | 50% |

---

## 📱 Mobil App Ekranları

### Workshops (Atölyeler)
```
┌──────────────────────────────────┐
│ Kesim Atölyesi          [Aktif]  │
├──────────────────────────────────┤
│ 📍 Ş.Ş Ticaret Merkezi, İstanbul │
│ 📱 +90 555 123 4567              │
│ 🛠️  KESİM                        │
├──────────────────────────────────┤
│ Kapasite Durumu        [ORTA]     │
│ ████░░░░░░░░░░░░░░░░  40%        │
│                                  │
│ Atanan İşler:     ₺150.000       │
│ Kapasite Limiti:  ₺500.000       │
│ Kalan Kapasite:   ₺350.000       │
├──────────────────────────────────┤
│ Beklemede: 2  İşleniyor: 3       │
│ Tamamlandı: 5                    │
├──────────────────────────────────┤
│ Toplam İşler: 10              > │
└──────────────────────────────────┘
```

### Dashboard (Atanan İş Emirleri)
```
┌──────────────────────────────────┐
│ Atanan İş Emirleri               │
├──────────────────────────────────┤
│ Toplam: 15  İşleniyor: 5         │
│ Tamamlandı: 8  Beklemede: 2      │
├──────────────────────────────────┤
│ E-001 - Müşteri A        [DEVAM] │
│ 📦 Ürün A - 100 Adet              │
│ ████░░░░░░░░░░░░░░░░  50%        │
│ 📅 15.02.2025  👤 Ahmet T.       │
│                                  │
│ E-002 - Müşteri B        [HAZIR] │
│ 📦 Ürün B - 50 Adet               │
│ ████████░░░░░░░░░░  75%          │
│ 📅 20.02.2025  👤 Fatma Y.       │
└──────────────────────────────────┘
```

### MobileTracker (Benim İşlerim)
```
┌──────────────────────────────────┐
│ Benim İşlerim                    │
├──────────────────────────────────┤
│ Toplam: 5  İşleniyor: 2          │
│ Tamamlandı: 3  Beklemede: 0      │
├──────────────────────────────────┤
│ E-001              [DEVAM] [YÜKSEK] │
│ 📦 Ürün A - 100 Adet              │
│ 🏭 Kesim Atölyesi                │
│ ████░░░░░░░░░░░░░░░░  50%        │
│ 📅 15.02.2025  ⏱️  4 gün kaldı   │
│                                  │
│ E-003              [TAMAMLANDI]   │
│ 📦 Ürün C - 75 Adet               │
│ 🏭 Dikişçi Atölyesi              │
│ ████████████████████  100%       │
│ 📅 10.02.2025  ✅ Tamamlandı     │
└──────────────────────────────────┘
```

---

## 🚀 Kurulum & Başlatma

### 1. Veritabanını Güncelle
```bash
cd fabric-stock
npx prisma migrate dev --name add_max_capacity_to_workshop
```

### 2. Backend'i Başlat
```bash
npm run dev
# Server çalışıyor: http://localhost:3000
```

### 3. Mobil App'i Test Et
```bash
# Network sekmesini aç (F12 → Network)
# Şu endpoint'leri test et:
# GET /api/fason/workshops-capacity
# GET /api/fason/tracking
# GET /api/fason/tracking?forDashboard=true
```

---

## ✅ Kontrol Listesi

### Kurulum Sonrası
- [ ] Migration başarıyla çalıştı
- [ ] Server hata vermeden başladı
- [ ] API endpoints çalışıyor (Postman ile test et)
- [ ] Mobil app login yapabiliyor
- [ ] Workshop kapasite bilgisi gösteriliyor
- [ ] Dashboard işleri gösteriliyor
- [ ] MobileTracker işleri gösteriliyor

### Veri Kontrolleri
- [ ] FasonTracking'lerde totalPrice doldurulmuş
- [ ] WorkOrder ilişkileri kurulu
- [ ] FasonWorkshop'lara maxCapacity değerleri atanmış
- [ ] En az bir atölyeye tracking kaydı var

### Production Öncesi
- [ ] Load testing yapıldı
- [ ] API response süresi ölçüldü
- [ ] Token refresh mekanizması test edildi
- [ ] Hata handling test edildi

---

## 🔍 Sorun Giderme

| Sorun | Çözüm |
|-------|-------|
| 401 Unauthorized | Token geçerli mi? Login yap, token al |
| 404 Not Found | Endpoint doğru mu? `/api/fason/workshops-capacity` kontrol et |
| Empty list | Workshop/Tracking kaydı var mı? DB kontrol et |
| Capacity 0% | totalPrice doldurulmuş mu? FasonTracking kontrol et |
| Slow response | API performance testi yap, index'leri kontrol et |

---

## 📚 Referanslar

- **API Dokumentasyonu**: `/docs/api`
- **Database Schema**: `prisma/schema.prisma`
- **Code Style**: `.github/copilot-instructions.md`
- **Prisma Setup**: `lib/prisma.ts`

---

## 🎓 Öğrenme Kaynakları

### Backend
- [Prisma Docs](https://www.prisma.io/docs/)
- [Next.js API Routes](https://nextjs.org/docs/api-routes)
- [JWT Authentication](https://jwt.io/)

### Mobil
- [React Native Docs](https://reactnative.dev/)
- [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [AsyncStorage](https://react-native-async-storage.github.io/)

---

## 💬 Sorular & Cevaplar

**S: Workshop kapasitesi nerede ayarlanır?**
A: `maxCapacity` veritabanı alanında veya PUT `/api/fason/workshops-capacity` endpoint'i ile.

**S: Kapasite otomatik güncelleniyor mu?**
A: Evet! Her tracking kaydı eklendiğinde veya güncellendiğinde otomatik hesaplanır.

**S: Birden fazla atölye olursa?**
A: Tüm atölyelerin kapasite bilgisi gösterilir. Sorting ve filtering yapılabilir.

**S: İş durumu değişirse ne oluyor?**
A: Kapasite otomatik yeniden hesaplanır ve UI güncellenir.

---

## 🎉 Tebrikler!

Fason iş takip sistemi kuruldu ve çalışıyor! 

🚀 Production'a geçebilirsin.

Sorun yaşarsan, dokumentasyonu gözden geçir veya teknik destek al.

**Happy Coding!** 💻
