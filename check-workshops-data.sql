-- Atölyeler Sayfası - Veri Kontrol Script'i
-- fabric_stock database'ini seçtikten sonra çalıştırın

-- 1. WORKSHOP SAYISI
SELECT 'Workshop Sayısı' as check_item, COUNT(*) as count
FROM "FasonWorkshop"
WHERE "isActive" = true;

-- 2. WORKSHOP DETAYLARı
SELECT '--- Aktif Atölyeler ---' as info;
SELECT 
    id,
    name,
    specialization,
    capacity,
    "capacityType",
    "contactPerson",
    phone,
    "isActive"
FROM "FasonWorkshop"
WHERE "isActive" = true
ORDER BY id
LIMIT 10;

-- 3. TRACKING KAYDINA SAHİP WORKSHOPLAR
SELECT '--- Atölyede İş Olan Workshoplar ---' as info;
SELECT 
    DISTINCT w.id,
    w.name,
    COUNT(DISTINCT ft.id) as tracking_count
FROM "FasonWorkshop" w
LEFT JOIN "FasonTracking" ft ON w.id = ft."workshopId" AND ft.status != 'IPTAL_EDILDI'
WHERE w."isActive" = true
GROUP BY w.id, w.name
HAVING COUNT(DISTINCT ft.id) > 0
ORDER BY tracking_count DESC;

-- 4. TRACKING KAYDINA SAHİP DEĞİL WORKSHOPLAR
SELECT '--- İş Olmayan Atölyeler (Yardımcı Bilgi) ---' as info;
SELECT 
    w.id,
    w.name,
    'Tracking yok' as status
FROM "FasonWorkshop" w
LEFT JOIN "FasonTracking" ft ON w.id = ft."workshopId"
WHERE w."isActive" = true AND ft.id IS NULL
ORDER BY w.id;

-- 5. TOPLAM TRACKING KAYDISI
SELECT '--- Toplam Tracking Kaydı ---' as info;
SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'BEKLIYOR' THEN 1 END) as bekliyor,
    COUNT(CASE WHEN status = 'ATÖLYEDE' THEN 1 END) as atölyede,
    COUNT(CASE WHEN status = 'HAZIR' THEN 1 END) as hazir,
    COUNT(CASE WHEN status = 'TESLIM_EDILDI' THEN 1 END) as teslim_edildi,
    COUNT(CASE WHEN status = 'SORUN_VAR' THEN 1 END) as sorun_var,
    COUNT(CASE WHEN status = 'IPTAL_EDILDI' THEN 1 END) as iptal_edildi
FROM "FasonTracking";

-- 6. WORKSHOP DETAYı (ÖRNEK: İlk Workshop)
SELECT '--- Örnek: İlk Atölye Detayı ---' as info;
WITH first_workshop AS (
    SELECT id FROM "FasonWorkshop" WHERE "isActive" = true LIMIT 1
)
SELECT 
    w.id,
    w.name,
    COUNT(DISTINCT ft.id) as total_orders,
    COUNT(CASE WHEN ft.status = 'BEKLIYOR' THEN 1 END) as pending,
    COUNT(CASE WHEN ft.status = 'ATÖLYEDE' THEN 1 END) as in_progress,
    COUNT(CASE WHEN ft.status = 'HAZIR' THEN 1 END) as completed,
    COALESCE(SUM(ft."totalPrice"), 0) as total_price
FROM "FasonWorkshop" w
JOIN first_workshop fw ON w.id = fw.id
LEFT JOIN "FasonTracking" ft ON w.id = ft."workshopId" AND ft.status != 'IPTAL_EDILDI'
GROUP BY w.id, w.name;

-- 7. WORKORDER KAYDISI
SELECT '--- WorkOrder Kaydı ---' as info;
SELECT 
    COUNT(*) as total_work_orders,
    COUNT(DISTINCT "productCode") as unique_products
FROM "WorkOrder";

-- 8. EXAMPLE DATA EKLE (İLK KERE ÇALIŞTIRILACAK)
-- Uncomment to run:
/*
-- Test Atölyesi Ekle
INSERT INTO "FasonWorkshop" (name, specialization, "contactPerson", phone, capacity, "capacityType", "isActive")
VALUES ('Test Dikim Atölyesi', 'DIKIM', 'Ahmet Yılmaz', '05551234567', 100000, 'TL', true)
ON CONFLICT (name) DO NOTHING;

-- Test Work Order Ekle
INSERT INTO "WorkOrder" (orderNo, "productCode", "productName", quantity, "customerName", status)
VALUES ('TEST-001', 'PRD-TEST-001', 'Test Ürün', 100, 'Test Müşteri', 'BEKLIYOR')
ON CONFLICT (orderNo) DO NOTHING;

-- Test Tracking Ekle
INSERT INTO "FasonTracking" ("workOrderId", "workshopId", "userId", "processType", status, "assignedQuantity", "totalPrice", notes)
SELECT 
    wo.id,
    1,  -- First workshop
    1,  -- First user
    'DIKIM',
    'ATÖLYEDE',
    50,
    25000,
    'Mavi, L Beden'
FROM "WorkOrder" wo
WHERE wo.orderNo = 'TEST-001'
AND NOT EXISTS (SELECT 1 FROM "FasonTracking" ft WHERE ft."workOrderId" = wo.id);
*/
