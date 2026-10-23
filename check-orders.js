const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.workOrder.findMany({
    take: 5,
    include: {
      fasonTrackings: {
        take: 3
      }
    }
  });
  console.log("Total work orders (first 5):", orders.length);
  orders.forEach((o) => console.log(`- ${o.id}: ${o.orderNo} (${o.productName})`));

  if (orders.length > 0) {
    const firstOrder = orders[0];
    console.log("\nFirst order details:", firstOrder.id);
    console.log("Dış Kaynak Üretim takip kayitlari:", firstOrder.fasonTrackings.length);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
