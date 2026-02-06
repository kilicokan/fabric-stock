# 🚀 Başlatma Rehberi - Adım Adım

**Bu rehber yeni fason iş takip özelliklerini aktif hale getirmek için tüm adımları içerir.**

---

## 📋 Başlangıç Kontrol Listesi

Başlamadan önce kontrol et:

- ✅ **Node.js** kurulu mu? (`node -v`)
- ✅ **npm** kurulu mu? (`npm -v`)
- ✅ **PostgreSQL** çalışıyor mu?
- ✅ `.env` dosyası var mı? (`DATABASE_URL` tanımlı)
- ✅ Node modules kurulu mu? (`node_modules` klasörü var mı)

---

## 🔧 ADIM 1: Veritabanı Migration

**Amaç**: `FasonWorkshop.maxCapacity` alanını veritabanına ekle

### Terminal'i aç ve şu komutu çalıştır:

```bash
cd c:\Users\giyim\fabric-stock
npx prisma migrate dev --name add_max_capacity_to_workshop
```

### Beklenen Çıktı:
```
✔ Prisma schema loaded from prisma/schema.prisma
✔ Successfully generated Prisma client (X.XX.X)
✔ 1 migration created in prisma/migrations

Prisma Migrate applied the following migration:

migrations/
  └─ 20250205000000_add_max_capacity_to_workshop/
    └─ migration.sql

Your database has been successfully migrated!
```

### ✅ Kontrol:
```bash
# PostgreSQL'e bağlan ve kontrol et
psql -U your_user -d your_database

# Query çalıştır:
SELECT * FROM "FasonWorkshop" LIMIT 1;

# Sonuç: maxCapacity kolonu görülmeli (default: 500000)
```

---

## 🚀 ADIM 2: Backend Sunucusunu Başlat

**Amaç**: Next.js + Tauri development sunucusunu çalıştır

### Terminal'de şu komutu çalıştır:

```bash
npm run dev
```

### Beklenen Çıktı:
```
▲ Next.js 15.4.5
- Local:        http://localhost:3000
- Environments: .env.local

✔ Ready in 2.5s

> Ready to accept connections
> Tauri window initializing...
```

### ✅ Kontrol:
```bash
# Tarayıcıda aç
http://localhost:3000

# API endpoint'i test et:
curl http://localhost:3000/api/fason/workshops-capacity \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Not**: Terminal açık tutmalısın. Kapatırsan sunucu durur!

---

## 📱 ADIM 3: Mobil App'ı Hazırla

### 3.1 MiraStokMobile kurulumunu kontrol et

```bash
cd c:\Users\giyim\MiraStokMobile
npm install
# (Eğer kurulu ise bu adımı geç)
```

### 3.2 API Konfigürasyonu

**Dosya**: `screens/Workshops.js` (ve diğer ekranlar)

API endpoint'i şu şekilde yapılandırılmıştır:
```javascript
const API_URL = 'http://192.168.1.3:3000'; // Ağ IP'si
const FALLBACK_URL = 'http://localhost:3000'; // Fallback
```

#### Senin Ağ IP'sini Bul:

**Windows Command Prompt'ta**:
```bash
ipconfig

# Çıktıdan IPv4 Address'i bul, örnek: 192.168.1.100
```

**Mobil cihaz ile test için**:
```bash
# Eğer IP 192.168.1.100 ise:
# http://192.168.1.100:3000/api/fason/workshops-capacity
```

### ✅ Kontrol:
```bash
# Mobil cihazdan (veya emülatörden) test et:
curl http://192.168.1.100:3000/api/fason/tracking \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🧪 ADIM 4: API Endpoint'lerini Test Et

### Terminal'de yeni bir tab aç ve şu komutları çalıştır:

#### 1. Login (Token Al)
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password"
  }'

# Response: { "token": "eyJhbG..." }
# TOKEN değerini kopyala
```

#### 2. Workshop Kapasite Bilgisi
```bash
# Tüm atölyelerin kapasitesi
curl -X GET http://localhost:3000/api/fason/workshops-capacity \
  -H "Authorization: Bearer TOKEN_BURAYA"

# Response: { "workshops": [...] }
```

#### 3. Tracking Verisi (Dashboard)
```bash
# Dashboard için benzersiz işleri getir
curl -X GET "http://localhost:3000/api/fason/tracking?forDashboard=true" \
  -H "Authorization: Bearer TOKEN_BURAYA"

# Response: [ { workOrderId, status, ... }, ... ]
```

#### 4. Tracking Verisi (MobileTracker)
```bash
# Tüm tracking'leri getir
curl -X GET http://localhost:3000/api/fason/tracking \
  -H "Authorization: Bearer TOKEN_BURAYA"

# Response: [ { id, workOrderId, userId, status, ... }, ... ]
```

---

## ✅ ADIM 5: Mobil App Ekranlarını Kontrol Et

### Browser DevTools Network Sekmesini Aç (F12)

#### Workshops Sekmesi Test:
1. Mobil app'te "Atölyeler" sekmesine git
2. Network tab'ında şu isteği gör:
   ```
   GET /api/fason/workshops-capacity
   Status: 200 OK
   Response: { "workshops": [ ... ] }
   ```
3. Ekranda kapasite bilgisi gösterilmeli:
   - ✅ Atölyenin adı
   - ✅ Kapasite çubuğu
   - ✅ Atanan tutarı (₺)
   - ✅ Kalan kapasite (₺)

#### Dashboard Test:
1. Mobil app'te "Atanan İş Emirleri" git
2. Network tab'ında şu isteği gör:
   ```
   GET /api/fason/tracking?forDashboard=true
   Status: 200 OK
   Response: [ ... ]
   ```
3. Ekranda işler listelenmelidir:
   - ✅ Emir No
   - ✅ Müşteri Adı
   - ✅ İş Durumu
   - ✅ İlerleme Çubuğu

#### MobileTracker Test:
1. Mobil app'te "Benim İşlerim" git
2. Network tab'ında şu isteği gör:
   ```
   GET /api/fason/tracking
   Status: 200 OK
   Response: [ ... ]
   ```
3. Ekranda işler listelenmelidir:
   - ✅ Emir No
   - ✅ Atölyenin Adı
   - ✅ İş Durumu
   - ✅ İlerleme Çubuğu

---

## 🔍 Sorun Giderme

### ❌ Error: "Cannot find module '@/lib/prisma'"
**Çözüm**: 
```bash
npm install
# ve sonra
npm run dev
```

### ❌ Error: "401 Unauthorized"
**Çözüm**:
1. Token geçerli mi? Login yap
2. Authorization header'da "Bearer" var mı?
3. Token taşıdıktan sonra değişti mi?

### ❌ Error: "404 Not Found"
**Çözüm**:
1. API endpoint adı doğru mu? `/api/fason/workshops-capacity`
2. Sunucu çalışıyor mu? `npm run dev`
3. Port 3000 açık mı?

### ❌ Error: "Empty list" (Hiç workshop/tracking yok)
**Çözüm**:
1. Veritabanında FasonWorkshop kaydı var mı?
2. FasonTracking kaydı var mı?
3. Şu sorguyu çalıştır:
```sql
SELECT COUNT(*) FROM "FasonWorkshop";
SELECT COUNT(*) FROM "FasonTracking";
```

### ❌ Capacity 0% gösteriliyor
**Çözüm**:
1. FasonTracking'lerin `totalPrice` doldurulmuş mu?
2. Status BEKLIYOR veya ATÖLYEDE mi?
3. Şu sorguyu çalıştır:
```sql
SELECT * FROM "FasonTracking" 
WHERE "workshopId" = 1 AND "totalPrice" IS NOT NULL;
```

---

## 📊 Veritabanı Kontrol Sorguları

```sql
-- 1. Tüm atölyeler
SELECT id, name, "maxCapacity" FROM "FasonWorkshop";

-- 2. Atölyenin tracking'leri
SELECT id, "workOrderId", status, "totalPrice" 
FROM "FasonTracking" 
WHERE "workshopId" = 1;

-- 3. Toplam atanan tutarı
SELECT SUM("totalPrice") as total 
FROM "FasonTracking" 
WHERE "workshopId" = 1 
AND status IN ('BEKLIYOR', 'ATÖLYEDE');

-- 4. Status dağılımı
SELECT status, COUNT(*) as count 
FROM "FasonTracking" 
WHERE "workshopId" = 1 
GROUP BY status;

-- 5. User'ın tracking'leri
SELECT id, "workOrderId", status 
FROM "FasonTracking" 
WHERE "userId" = 5;
```

---

## ✨ Kurulum Tamam! 🎉

Tüm adımları tamamladıysan:

✅ Veritabanı migration yapıldı  
✅ Backend sunucusu çalışıyor  
✅ API endpoint'leri aktif  
✅ Mobil app özellikler çalışıyor  

### 🚀 Sonraki Adımlar:

1. **Workshop kapasite ayarla** (isteğe bağlı):
   ```bash
   curl -X PUT http://localhost:3000/api/fason/workshops-capacity \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer TOKEN" \
     -d '{"workshopId": 1, "maxCapacity": 750000}'
   ```

2. **Test verisi ekle**:
   - FasonWorkshop oluştur
   - WorkOrder oluştur
   - FasonTracking kayıtları ekle

3. **Production'a dağıt**:
   - `npm run build`
   - Tauri build'i çalıştır
   - APK/DMG oluştur

---

## 📚 Kaynaklar

- **Hızlı Başlangıç**: [QUICK_START.md](QUICK_START.md)
- **Özellik Kılavuzu**: [README_FEATURES.md](README_FEATURES.md)
- **Teknik Detaylar**: [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
- **Kontrol Listesi**: [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md)

---

## 💬 Notlar

- **Terminal açık tutmalısın**: Backend sunucusu çalışmaya devam edecek
- **Token süresi**: Gerekli olursa tekrar login yap
- **Firewall**: Port 3000'in açık olduğundan emin ol
- **IP Adresi**: Mobil test için doğru ağ IP'sini kullan

---

**Sorular? Dokumentasyonu kontrol et veya destek al!**

Happy Coding! 💻🚀
