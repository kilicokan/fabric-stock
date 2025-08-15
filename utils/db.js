import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Bağlantı test fonksiyonu
export async function testConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Prisma PostgreSQL bağlantısı başarılı');
    return true;
  } catch (error) {
    console.error('❌ Prisma bağlantı hatası:', error);
    return false;
  }
}

// Uygulama başlangıcında test
testConnection();

export default prisma;