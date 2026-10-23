#!/bin/bash

# ============================================================================
# DIS KAYNAK URETIM İŞ TAKIP SİSTEMİ - BAŞLATMA KOMUTLARI
# ============================================================================
# Bu script yeni dis kaynak uretim özelliklerini kurmanız ve başlatmanız için gereken
# tüm komutları içerir.
#
# Kullanım:
#   bash DEPLOYMENT_COMMANDS.sh
#
# Veya manuel olarak aşağıdaki komutları sırasıyla çalıştırın
# ============================================================================

set -e  # Hata durumunda scripti durdur

echo "🚀 DIS KAYNAK URETIM İŞ TAKIP SİSTEMİ - BAŞLATMA"
echo "======================================"
echo ""

# ADIM 1: Klasöre git
echo "📍 ADIM 1: Klasöre geçiliyor..."
cd "$(dirname "$0")"
echo "✅ Klasör: $(pwd)"
echo ""

# ADIM 2: Node modules kontrol
echo "📍 ADIM 2: Node modules kontrol ediliyor..."
if [ ! -d "node_modules" ]; then
    echo "ℹ️  node_modules bulunamadı, kurulum yapılıyor..."
    npm install
    echo "✅ npm install tamamlandı"
else
    echo "✅ node_modules zaten kurulu"
fi
echo ""

# ADIM 3: Veritabanı Migration
echo "📍 ADIM 3: Veritabanı migration yapılıyor..."
echo "   Komut: npx prisma migrate dev --name add_max_capacity_to_workshop"
npx prisma migrate dev --name add_max_capacity_to_workshop
echo "✅ Migration tamamlandı"
echo ""

# ADIM 4: TypeScript Check (Opsiyonel)
echo "📍 ADIM 4: TypeScript syntax kontrol ediliyor..."
echo "   Komut: npx tsc --noEmit"
if npx tsc --noEmit 2>/dev/null; then
    echo "✅ TypeScript kontrol tamam"
else
    echo "⚠️  TypeScript hataları var (devam ediliyor...)"
fi
echo ""

# ADIM 5: ESLint Check (Opsiyonel)
echo "📍 ADIM 5: Kod tarzı kontrol ediliyor..."
echo "   Komut: npm run lint"
if npm run lint 2>/dev/null; then
    echo "✅ Kod tarzı kontrol tamam"
else
    echo "⚠️  ESLint hataları var (devam ediliyor...)"
fi
echo ""

# ADIM 6: Backend Sunucusunu Başlat
echo "📍 ADIM 6: Backend sunucusu başlatılıyor..."
echo "   Komut: npm run dev"
echo ""
echo "🎉 TÜM HAZIRLIKLAR TAMAMLANDI!"
echo "======================================"
echo ""
echo "✅ Veritabanı migration yapıldı"
echo "✅ Node modules kurulu"
echo "✅ Kod formatı kontrol edildi"
echo ""
echo "📍 Sunucu başlatılıyor..."
echo "   Adres: http://localhost:3000"
echo "   Mobil: http://192.168.1.X:3000"
echo ""
echo "⏸️  Terminal açık tutmalısın!"
echo "   Kapatırsan sunucu durur."
echo ""
echo "🔗 Test için açılan endpoint'ler:"
echo "   - GET /api/fason/workshops-capacity"
echo "   - GET /api/fason/tracking"
echo "   - GET /api/fason/tracking?forDashboard=true"
echo ""

# ADIM 7: Backend'i Başlat
npm run dev
