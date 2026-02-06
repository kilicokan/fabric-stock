# 🚀 Hızlı Başlangıç Rehberi

## 30 Saniyede Kurulum

### 1. Veritabanı Güncellemesi
```bash
cd fabric-stock
npx prisma migrate dev --name add_max_capacity_to_workshop
```
✅ `FasonWorkshop.maxCapacity` alanı otomatik oluşturulacak (default: 500.000 ₺)

### 2. Backend Başlat
```bash
npm run dev
# Başarı: Server http://localhost:3000 üzerinde çalışıyor
```

### 3. Mobil App Test Et
Herhangi bir HTTP client ile test edin:
```bash
# 1. Login ile token al
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Response'dan token kopyala: "token": "eyJhbG..."

# 2. Workshop kapasite bilgisi al
curl -X GET http://localhost:3000/api/fason/workshops-capacity \
  -H "Authorization: Bearer {TOKEN_BURAYA}"

# 3. Tracking verilerini al
curl -X GET http://localhost:3000/api/fason/tracking \
  -H "Authorization: Bearer {TOKEN_BURAYA}"

# 4. Dashboard için tracking'leri al
curl -X GET "http://localhost:3000/api/fason/tracking?forDashboard=true" \
  -H "Authorization: Bearer {TOKEN_BURAYA}"
```

---

## 📱 Mobil App Ekranları

### Workshops (Atölyeler Sekmesi)
📸 **Gösterilen Veriler**:
- Atölyenin ismi ve kapasitesi
- Kapasite durumu: Boş (🟢) → Dolu (🟡) → Çok Dolu (🔴)
- Atanan iş tutarı: **₺150.000**
- Kapasite limiti: **₺500.000**
- Kalan kapasite: **₺350.000**
- İş durumları: Beklemede (2), İşleniyor (3), Tamamlandı (5)

🔄 **Yenileme**:
- Screen açıldığında otomatik yükle
- Pull-to-refresh kullanılabilir (eklenebilir)

### Dashboard (Atanan İş Emirleri)
📸 **Gösterilen Veriler**:
- Emir No, Müşteri, Ürün Adı
- İş durumu ve ilerleme çubuğu
- Son teslim tarihi
- Atanan kişi
- İstatistik cards

🔄 **Veri Kaynağı**:
- `/api/fason/tracking?forDashboard=true`
- Her workOrder'ın en son tracking kaydı

### MobileTracker (Benim İşlerim)
📸 **Gösterilen Veriler**:
- Emir No, Müşteri, Ürün Adı
- Atölyenin ismi
- İş durumu ve ilerleme çubuğu
- Öncelik bilgisi
- Son teslim tarihi

🔄 **Veri Kaynağı**:
- `/api/fason/tracking`
- Kullanıcı'nın tracking kayıtları (userId filtrelemesi)

---

## 🔧 API Endpoint'leri

### 1. Workshop Kapasite
```
GET  /api/fason/workshops-capacity
     Returns: { workshops: [...] }
     
GET  /api/fason/workshops-capacity?workshopId=1
     Returns: { workshop: {...}, assignedOrderCount: 3, ... }
     
PUT  /api/fason/workshops-capacity
     Body: { workshopId: 1, maxCapacity: 750000 }
     Returns: { success: true, workshop: {...} }
```

### 2. Tracking Bilgisi
```
GET  /api/fason/tracking
     Returns: [...] Tüm tracking kayıtları
     
GET  /api/fason/tracking?forDashboard=true
     Returns: [...] Her workOrder'ın en son tracking'i
     
GET  /api/fason/tracking?userId=5
     Returns: [...] Belirli kullanıcının tracking'leri
     
POST /api/fason/tracking
     Body: { workOrderId, workshopId, processType, status, ... }
     Returns: { id, ... } Yeni tracking
     
PUT  /api/fason/tracking
     Body: { id, status, notes, ... }
     Returns: { id, ... } Güncellenen tracking
```

---

## 🐛 Sık Sorulan Sorular

### Q: "API'ye erişemiyorum"
**A**: 
1. ✅ Backend'in çalışıyor mu? `npm run dev`
2. ✅ Token geçerli mi? Önce login yap
3. ✅ Authorization header var mı? `Authorization: Bearer {token}`
4. ✅ Port 3000 açık mı? Firewall kontrol et

### Q: "Workshop kapasitesi gösterilmiyor"
**A**:
1. ✅ FasonTracking tablosunda totalPrice doldurulmuş mu?
2. ✅ FasonWorkshop'ın maxCapacity değeri var mı?
3. ✅ API response'inde `totalAssignedAmount` > 0 mi?

### Q: "Dashboard işleri gösterilmiyor"
**A**:
1. ✅ FasonTracking'lerin workOrder ilişkisi var mı?
2. ✅ `forDashboard=true` parametresi kullanıyor musun?
3. ✅ Kullanıcının tracking kayıtları var mı?

### Q: "Token süresi doldu"
**A**:
1. Yeni login yap
2. localStorage'ı temizle
3. localStorage'dan yeni token al

---

## 📊 Kapasite Hesaplama Örneği

```
Workshop: Kesim Atölyesi
maxCapacity: 500.000 ₺

FasonTracking Kayıtları:
1. Emir-001, BEKLIYOR,    50.000 ₺  ← Atanan
2. Emir-002, ATÖLYEDE,    75.000 ₺  ← Atanan
3. Emir-003, HAZIR,       25.000 ₺  ← Tamamlanan
4. Emir-004, TESLIM_EDILDI, 50.000 ₺ ← Tamamlanan

Sonuç:
- Atanan: 50.000 + 75.000 = 125.000 ₺
- Tamamlanan: 25.000 + 50.000 = 75.000 ₺
- Kullanılan: 125.000 + 75.000 = 200.000 ₺
- Yüzde: (200.000 / 500.000) * 100 = 40%
- Kalan: 500.000 - 200.000 = 300.000 ₺
- Durum: ORTA (40%)
```

---

## ✅ Kontrol Listesi

Production'a geçmeden kontrol et:

### Backend
- [ ] Migration başarıyla çalıştı
- [ ] `npx prisma migrate deploy` production database'de çalıştırıldı
- [ ] API endpoints Bearer token ile protected
- [ ] Error handling iyi çalışıyor

### Mobil App
- [ ] Token doğru şekilde alınıyor ve gönderiliyor
- [ ] Network hatası fallback (localhost) çalışıyor
- [ ] Workshop kapasitesi doğru hesaplanıyor
- [ ] Dashboard işleri gösteriliyor
- [ ] MobileTracker kişisel işleri gösteriliyor

### Veri
- [ ] FasonTracking'lerde totalPrice doldurulmuş
- [ ] WorkOrder ilişkileri kurulu
- [ ] Workshop kapasite ayarları yapılmış

---

## 🔄 Günlük İş Akışı

1. **Operatör**: İş emri (WorkOrder) oluşturur
2. **Fason Tracker**: Tracking kaydı açar (status: BEKLIYOR)
3. **Dashboard**: Atanan işi gösterir
4. **Atölye**: İşi alır (status: ALINDI)
5. **Atölye**: İşe başlar (status: ATÖLYEDE)
6. **Atölye**: İş tamamlanır (status: HAZIR)
7. **Fason Tracker**: İşi teslim eder (status: TESLIM_EDILDI)
8. **MobileTracker**: Tamamlanan işi görür

---

## 📞 Destek

Sorun yaşıyorsanız:
1. Logları kontrol et: `console.error()`
2. Network tab'ını açık tut: Browser Dev Tools
3. Veritabanını kontrol et: `SELECT * FROM "FasonTracking"`
4. API endpoint'lerini test et: Postman/cURL

---

## 🎉 Başarılı Kurulum!

Tebrikler! Sistem şu anda çalışıyor:

```
✅ Workshop kapasitesi real-time hesaplanıyor
✅ Dashboard atanan işleri gösteriyor
✅ MobileTracker kişisel işleri gösteriyor
✅ Tüm veriler token ile korunuyor
✅ Hata yönetimi ve fallback aktif
```

Şimdi production'a geçebilirsin! 🚀
