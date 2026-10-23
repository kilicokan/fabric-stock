require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const [f, e, w, o, ws, v] = await Promise.all([
    prisma.fabric.count(),
    prisma.fabricExit.count(),
    prisma.workOrder.count(),
    prisma.customerOrder.count(),
    prisma.fasonWorkshop.count(),
    prisma.vehicle.count(),
  ]);
  console.log({ fabrics: f, exits: e, workOrders: w, customerOrders: o, workshops: ws, vehicles: v });
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
