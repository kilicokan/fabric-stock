import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Admin user oluştur
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@mira.com' },
    update: {},
    create: {
      email: 'admin@mira.com',
      password: hashedPassword,
      role: 'ADMIN',
      name: 'Admin User',
      stockAccess: true,
      fasonAccess: true,
    },
  });

  console.log('✅ Admin user created:', adminUser.email);

  // Test operator user
  const operatorPassword = await bcrypt.hash('operator123', 10);

  const operatorUser = await prisma.user.upsert({
    where: { email: 'operator@mira.com' },
    update: {},
    create: {
      email: 'operator@mira.com',
      password: operatorPassword,
      role: 'OPERATOR',
      name: 'Operator User',
      stockAccess: true,
      fasonAccess: false,
    },
  });

  console.log('✅ Operator user created:', operatorUser.email);

  // Test fason tracker user
  const fasonPassword = await bcrypt.hash('fason123', 10);

  const fasonUser = await prisma.user.upsert({
    where: { email: 'fason@mira.com' },
    update: {},
    create: {
      email: 'fason@mira.com',
      password: fasonPassword,
      role: 'FASON_TRACKER',
      name: 'Fason Tracker',
      stockAccess: false,
      fasonAccess: true,
    },
  });

  console.log('✅ Fason tracker user created:', fasonUser.email);

  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
