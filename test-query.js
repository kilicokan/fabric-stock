const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    // 1. Check warehouseId column existence
    const columns = await prisma.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'Product' AND column_name = 'warehouseId'
    `);
    console.log('warehouseId column check:', JSON.stringify(columns));
    const hasWarehouse = columns.length > 0;

    // 2. Check if ProductRecipe table exists
    const recipeTable = await prisma.$queryRawUnsafe(`
      SELECT table_name FROM information_schema.tables WHERE table_name = 'ProductRecipe'
    `);
    console.log('ProductRecipe table:', JSON.stringify(recipeTable));

    // 3. Try the actual findMany with recipes
    const select = hasWarehouse
      ? {
          id: true, modelNo: true, name: true, materialTypeId: true, fabricId: true,
          groupId: true, taxRateId: true, description: true, image: true,
          createdAt: true,
          warehouse: { select: { id: true, code: true, name: true, isActive: true } },
          materialType: { select: { id: true, name: true } },
          fabric: { select: { id: true, code: true, name: true, property: true, width: true, length: true, depot: true, unit: true,           stockQuantity: true, createdAt: true } },
          group: { select: { id: true, name: true } },
          taxRate: { select: { id: true, name: true, rate: true } },
          recipes: { select: {
            id: true, resourceType: true, fabricId: true, accessoryId: true,
            quantityPerUnit: true, unit: true,
            fabric: { select: { id: true, code: true, name: true, property: true, width: true, length: true, depot: true, unit: true, stockQuantity: true, createdAt: true } },
            accessory: { select: { id: true, code: true, name: true, unit: true, stockQuantity: true, createdAt: true, updatedAt: true } },
          }},
        }
      : {
          id: true, modelNo: true, name: true, materialTypeId: true, fabricId: true,
          groupId: true, taxRateId: true, description: true, image: true,
          createdAt: true,
          materialType: { select: { id: true, name: true } },
          fabric: { select: { id: true, code: true, name: true, property: true, width: true, length: true, depot: true, unit: true,           stockQuantity: true, createdAt: true } },
          group: { select: { id: true, name: true } },
          taxRate: { select: { id: true, name: true, rate: true } },
          recipes: { select: {
            id: true, resourceType: true, fabricId: true, accessoryId: true,
            quantityPerUnit: true, unit: true,
            fabric: { select: { id: true, code: true, name: true, property: true, width: true, length: true, depot: true, unit: true, stockQuantity: true, createdAt: true } },
            accessory: { select: { id: true, code: true, name: true, unit: true, stockQuantity: true, createdAt: true, updatedAt: true } },
          }},
        };

    console.log('hasWarehouse:', hasWarehouse);
    console.log('Attempting findMany...');
    const result = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      select: select,
    });
    console.log('findMany SUCCESS, count:', result.length);
  } catch (error) {
    console.error('ERROR:', error.message);
    console.error('Error code:', error.code);
    console.error('Full error:', JSON.stringify(error, null, 2).substring(0, 2000));
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

run();
