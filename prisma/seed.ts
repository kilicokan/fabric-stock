import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.materialType.createMany({
    data: [
      { name: 'Kumaş' },
      { name: 'Deri' },
    ],
    skipDuplicates: true,
  });

  await prisma.group.createMany({
    data: [
      { name: 'Dokuma Kumaş' },
      { name: 'Örme Kumaş' },
    ],
    skipDuplicates: true,
  });

  await prisma.taxRate.createMany({
    data: [
      { name: '%0' },
      { name: '%1' },
      { name: '%10' },
      { name: '%20' },
    ],
    skipDuplicates: true,
  });

  await prisma.cuttingTable.createMany({
    data: [
      { name: 'MASA1' },
      { name: 'MASA2' },
    ],
    skipDuplicates: true,
  });

  await prisma.fabricType.createMany({
    data: [
      { name: 'Kumaş' },
      { name: 'Deri' },
    ],
    skipDuplicates: true,
  });

  await prisma.color.createMany({
    data: [
      { name: 'Beyaz' },
      { name: 'Siyah' },
    ],
    skipDuplicates: true,
  });

  await prisma.fabricEntry.createMany({
    data: [
      { fabricTypeId: 1, colorId: 1, quantityKg: 100, lengthMeter: 200 },
      { fabricTypeId: 2, colorId: 2, quantityKg: 50, lengthMeter: 100 },
    ],
    skipDuplicates: true,
  });
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());