const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateUsers() {
  try {
    console.log('Kullanıcı verilerini güncelleniyor...');

    // İlk admin kullanıcısını oluştur (yoksa)
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@mira.com' },
      update: {},
      create: {
        email: 'admin@mira.com',
        password: '$2b$12$svuMVTpJGJs9p069rrqP8O.H37Ohkikx2EZRuN7XZo8.65JSbBaau', // password: admin123
        name: 'Admin Kullanıcı',
        role: 'ADMIN',
        stockAccess: true,
        fasonAccess: true
      }
    });

    console.log('Admin kullanıcı oluşturuldu/güncellendi:', adminUser.email);

    // Test fason takipçi kullanıcısı oluştur
    const trackerUser = await prisma.user.upsert({
      where: { email: 'tracker@mira.com' },
      update: {},
      create: {
        email: 'tracker@mira.com',
        password: '$2b$12$svuMVTpJGJs9p069rrqP8O.H37Ohkikx2EZRuN7XZo8.65JSbBaau', // password: admin123
        name: 'Fason Takipçi',
        role: 'FASON_TRACKER',
        phone: '+90 555 123 45 67',
        stockAccess: false,
        fasonAccess: true
      }
    });

    console.log('Fason takipçi oluşturuldu/güncellendi:', trackerUser.email);

    // Örnek atölyeler oluştur
    const workshops = [
      {
        name: 'Ahmet Dikim Atölyesi',
        contactPerson: 'Ahmet Yılmaz',
        phone: '+90 555 111 22 33',
        address: 'Merkez Mahallesi, İstanbul',
        specialization: 'DIKIM'
      },
      {
        name: 'Güzel Baskı Merkezi',
        contactPerson: 'Mehmet Demir',
        phone: '+90 555 444 55 66',
        address: 'Sanayi Sitesi, İstanbul',
        specialization: 'BASKI_NAKIS'
      },
      {
        name: 'Profesyonel Ütü Evi',
        contactPerson: 'Ayşe Kaya',
        phone: '+90 555 777 88 99',
        address: 'Tekstil Çarşısı, İstanbul',
        specialization: 'UTU'
      }
    ];

    for (const workshop of workshops) {
      await prisma.fasonWorkshop.upsert({
        where: { name: workshop.name },
        update: workshop,
        create: workshop
      });
    }

    console.log('Örnek atölyeler oluşturuldu');

    // Örnek iş emri oluştur
    const sampleOrder = await prisma.workOrder.upsert({
      where: { orderNo: '2025-0001' },
      update: {},
      create: {
        orderNo: '2025-0001',
        productCode: '1399',
        productName: 'Pamuk T-Shirt',
        quantity: 100,
        customerName: 'ABC Tekstil',
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 gün sonra
        notes: 'Örnek iş emri - Test için oluşturuldu',
        externalErpId: 'ERP-2025-0001'
      }
    });

    console.log('Örnek iş emri oluşturuldu:', sampleOrder.orderNo);

    console.log('\n✅ Veritabanı başarıyla güncellendi!');
    console.log('\nTest kullanıcıları:');
    console.log('Admin: admin@mira.com / admin123');
    console.log('Fason Takipçi: tracker@mira.com / admin123');

  } catch (error) {
    console.error('Hata:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateUsers();
