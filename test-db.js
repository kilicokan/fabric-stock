const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const result = await prisma.$queryRawUnsafe('SELECT 1 as result');
    console.log('DB OK:', JSON.stringify(result));

    // Also try listing products
    const count = await prisma.product.count();
    console.log('Product count:', count);

    // Check if Product table exists
    const tableCheck = await prisma.$queryRawUnsafe(`
      SELECT table_name FROM information_schema.tables WHERE table_name = 'Product'
    `);
    console.log('Product table:', JSON.stringify(tableCheck));
  } catch (error) {
    console.error('DB ERROR:', error.message);
    console.error('Error code:', error.code);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
})();
