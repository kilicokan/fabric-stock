const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function fixPassword() {
  try {
    console.log('Şifreleri düzeltiliyor...');
    
    // admin123 şifresini hash'le
    const hashedPassword = await bcrypt.hash('admin123', 12);
    console.log('Yeni hash:', hashedPassword);

    // Admin kullanıcısını güncelle
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@mira.com' },
      update: {
        password: hashedPassword,
        name: 'Admin Kullanıcı',
        role: 'ADMIN',
        stockAccess: true,
        fasonAccess: true
      },
      create: {
        email: 'admin@mira.com',
        password: hashedPassword,
        name: 'Admin Kullanıcı',
        role: 'ADMIN',
        stockAccess: true,
        fasonAccess: true
      }
    });

    console.log('Admin kullanıcı güncellendi:', adminUser.email);

    // Fason takipçi kullanıcısını güncelle
    const trackerUser = await prisma.user.upsert({
      where: { email: 'tracker@mira.com' },
      update: {
        password: hashedPassword,
        name: 'Fason Takipçi',
        role: 'FASON_TRACKER',
        phone: '+90 555 123 45 67',
        stockAccess: false,
        fasonAccess: true
      },
      create: {
        email: 'tracker@mira.com',
        password: hashedPassword,
        name: 'Fason Takipçi',
        role: 'FASON_TRACKER',
        phone: '+90 555 123 45 67',
        stockAccess: false,
        fasonAccess: true
      }
    });

    console.log('Fason takipçi güncellendi:', trackerUser.email);

    // Test - şifreyi kontrol et
    const testUser = await prisma.user.findUnique({
      where: { email: 'admin@mira.com' }
    });

    const isMatch = await bcrypt.compare('admin123', testUser.password);
    console.log('\n✅ Şifre testi:', isMatch ? 'BAŞARILI' : 'HATALI');

    console.log('\n✅ Kullanıcılar hazır!');
    console.log('Admin: admin@mira.com / admin123');
    console.log('Fason Takipçi: tracker@mira.com / admin123');

  } catch (error) {
    console.error('Hata:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixPassword();
