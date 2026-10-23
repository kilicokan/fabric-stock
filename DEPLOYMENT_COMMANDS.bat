@echo off
REM ============================================================================
REM DIS KAYNAK URETIM İŞ TAKIP SİSTEMİ - BAŞLATMA KOMUTLARI (Windows)
REM ============================================================================
REM Bu script yeni dis kaynak uretim özelliklerini kurmanız ve başlatmanız için gereken
REM tüm komutları içerir.
REM
REM Kullanım:
REM   DEPLOYMENT_COMMANDS.bat
REM
REM veya çift-tıkla dosyaya
REM ============================================================================

setlocal enabledelayedexpansion
color 0A
title DIS KAYNAK URETIM İŞ TAKIP SİSTEMİ - BAŞLATMA

echo.
echo ============================================================================
echo.
echo   🚀 DIS KAYNAK URETIM İŞ TAKIP SİSTEMİ - BAŞLATMA
echo.
echo ============================================================================
echo.

REM ADIM 1: Klasöre git
echo 📍 ADIM 1: Klasöre geçiliyor...
cd /d "%~dp0"
echo ✅ Klasör: %cd%
echo.

REM ADIM 2: Node modules kontrol
echo 📍 ADIM 2: Node modules kontrol ediliyor...
if not exist "node_modules" (
    echo ℹ️  node_modules bulunamadı, kurulum yapılıyor...
    call npm install
    echo ✅ npm install tamamlandı
) else (
    echo ✅ node_modules zaten kurulu
)
echo.

REM ADIM 3: .env kontrol
echo 📍 ADIM 3: .env dosyası kontrol ediliyor...
if not exist ".env" (
    echo ⚠️  .env dosyası bulunamadı!
    echo    .env.example'dan kopyala: copy .env.example .env
    echo    Sonra DATABASE_URL'yi doldur
    pause
) else (
    echo ✅ .env dosyası bulundu
)
echo.

REM ADIM 4: Veritabanı Migration
echo 📍 ADIM 4: Veritabanı migration yapılıyor...
echo    Komut: npx prisma migrate dev --name add_max_capacity_to_workshop
call npx prisma migrate dev --name add_max_capacity_to_workshop
if errorlevel 1 (
    echo ❌ Migration hatası!
    echo    Lütfen çalıştır: npx prisma migrate reset
    pause
    exit /b 1
)
echo ✅ Migration tamamlandı
echo.

REM ADIM 5: TypeScript Check (Opsiyonel)
echo 📍 ADIM 5: TypeScript syntax kontrol ediliyor...
echo    Komut: npx tsc --noEmit
call npx tsc --noEmit >nul 2>&1
if errorlevel 1 (
    echo ⚠️  TypeScript hataları var (devam ediliyor...)
) else (
    echo ✅ TypeScript kontrol tamam
)
echo.

REM ADIM 6: Banner
echo.
echo ============================================================================
echo.
echo   🎉 TÜM HAZIRLIKLAR TAMAMLANDI!
echo.
echo ============================================================================
echo.
echo   ✅ Veritabanı migration yapıldı
echo   ✅ Node modules kurulu
echo   ✅ Kod kontrol edildi
echo.
echo   📍 Sunucu başlatılıyor...
echo      Adres: http://localhost:3000
echo      Mobil: http://192.168.1.X:3000  (ağ IP'sini kullan)
echo.
echo   ⏸️  Bu pencereyi kapatma!
echo      Kapatırsan sunucu durur.
echo.
echo   🔗 Test için endpoint'ler:
echo      - GET /api/fason/workshops-capacity
echo      - GET /api/fason/tracking
echo      - GET /api/fason/tracking?forDashboard=true
echo.
echo   📚 Dokümantasyon:
echo      - START_HERE.md
echo      - QUICK_START.md
echo      - STARTUP_GUIDE.md
echo.
echo ============================================================================
echo.

REM ADIM 7: Backend'i Başlat
call npm run dev

REM Eğer sunucu kapanırsa
echo.
echo ============================================================================
echo Sunucu durduruldu. Bu pencereyi kapatmak için bir tuşa bas...
echo ============================================================================
pause
