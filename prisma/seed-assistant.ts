import { Prisma, OrderStatus, WorkshopType } from "@prisma/client";
import prisma from "../lib/prisma";

const FABRICS = [
  { name: "Pamuk", code: "FAB-001", unit: "kg", stockQuantity: 120, width: 150, length: 100, depot: "Ana Depo" },
  { name: "Polyester", code: "FAB-002", unit: "kg", stockQuantity: 85, width: 160, length: 120, depot: "Ana Depo" },
  { name: "Keten", code: "FAB-003", unit: "m", stockQuantity: 200, width: 140, length: 300, depot: "Depo B" },
];

const COLORS = [
  { name: "Beyaz", code: "WHT" },
  { name: "Siyah", code: "BLK" },
  { name: "Lacivert", code: "NAV" },
  { name: "Kirmizi", code: "RED" },
];

const CUSTOMERS = [
  { name: "ABC Tekstil", phone: "555-000-0001", email: "abc@example.com" },
  { name: "XYZ Giyim", phone: "555-000-0002", email: "xyz@example.com" },
  { name: "MNO Fashion", phone: "555-000-0003", email: "mno@example.com" },
];

const SUPPLIERS = [
  { name: "Anadolu Kumas", phone: "555-100-0001", email: "ana@example.com" },
  { name: "Marmara Tekstil", phone: "555-100-0002", email: "marmara@example.com" },
];

const WORKSHOPS = [
  { name: "Atolye 1", contactPerson: "Ali", phone: "555-200-0001", specialization: "DIKIM", maxCapacity: 500000, capacity: 10000, capacityType: "TL" },
  { name: "Atolye 2", contactPerson: "Mehmet", phone: "555-200-0002", specialization: "KESIM", maxCapacity: 300000, capacity: 5000, capacityType: "TL" },
];

const VEHICLES = [
  { licensePlate: "34 ABC 123", model: "Mercedes Sprinter", color: "Beyaz", capacity: 1500 },
  { licensePlate: "34 XYZ 456", model: "Volvo FH", color: "Mavi", capacity: 5000 },
];

async function main() {
  const colors = await Promise.all(
    COLORS.map((c) =>
      prisma.color.upsert({
        where: { name: c.name },
        update: {},
        create: { name: c.name, code: c.code },
      })
    )
  );

  const colorMap = new Map(colors.map((c) => [c.name, c.id]));

  const fabrics = await Promise.all(
    FABRICS.map((f) =>
      prisma.fabric.upsert({
        where: { code: f.code },
        update: {},
        create: { ...f, stockQuantity: f.stockQuantity },
      })
    )
  );

  const fabricMap = new Map(fabrics.map((f) => [f.name, f.id]));

  const customers = await Promise.all(
    CUSTOMERS.map(async (c) => {
      const existing = await prisma.customer.findFirst({ where: { email: c.email || undefined } });
      if (existing) return existing;
      return prisma.customer.create({ data: c });
    })
  );

  const customerMap = new Map(customers.map((c) => [c.name, c.id]));

  const suppliers = await Promise.all(
    SUPPLIERS.map(async (s) => {
      const existing = await prisma.supplier.findFirst({ where: { email: s.email || undefined } });
      if (existing) return existing;
      return prisma.supplier.create({ data: s });
    })
  );

  const supplierMap = new Map(suppliers.map((s) => [s.name, s.id]));

  await prisma.fabricEntry.createMany({
    data: fabrics.map((f, idx) => ({
      fabricId: f.id,
      colorId: colors[idx % colors.length].id,
      quantityKg: f.stockQuantity * (idx === 2 ? 0.5 : 1),
      lengthMeter: idx === 2 ? f.stockQuantity : null,
      entryDate: new Date(Date.now() - idx * 86400000 * 3),
    })),
    skipDuplicates: true,
  });

  await prisma.cuttingTable.createMany({
    data: [
      { name: "Masa 1" },
      { name: "Masa 2" },
    ],
    skipDuplicates: true,
  });
  const cuttingTables = await prisma.cuttingTable.findMany();
  const cuttingTableId = cuttingTables[0]?.id || 1;

  const sampleCutting =   await prisma.fabricExit.createMany({
    data: [
      {
        modelNo: "M-100",
        modelName: "Kisa Kol Gömlek",
        orderNo: "SO-2026-001",
        customerId: String(customers[0].id),
        layerCount: 10,
        productWeightKg: 24.5,
        productLengthMeter: 0,
        grammage: 0,
        unitType: "kg",
        fabricType: fabrics[0].name,
        color: colors[0].name,
        cuttingTableId,
        reportNumber: "RPT-001",
      },
      {
        modelNo: "M-101",
        modelName: "Kot Pantolon",
        orderNo: "SO-2026-002",
        customerId: String(customers[1].id),
        layerCount: 8,
        productWeightKg: 18.2,
        productLengthMeter: 0,
        grammage: 0,
        unitType: "kg",
        fabricType: fabrics[1].name,
        color: colors[1].name,
        cuttingTableId: cuttingTables[1]?.id || 2,
        reportNumber: "RPT-002",
      },
      {
        modelNo: "M-102",
        modelName: "Elbise",
        orderNo: "SO-2026-003",
        customerId: String(customers[2].id),
        layerCount: 12,
        productWeightKg: 32,
        productLengthMeter: 0,
        grammage: 0,
        unitType: "kg",
        fabricType: fabrics[2].name,
        color: colors[2].name,
        cuttingTableId,
        reportNumber: "RPT-003",
      },
    ],
    skipDuplicates: true,
  });

  const workOrders = await Promise.all(
    [
      { orderNo: "WO-2026-001", productCode: "P-100", productName: "Kisa Kol Gömlek", quantity: 100, customerName: customers[0].name, status: "ATÖLYEDE" as const },
      { orderNo: "WO-2026-002", productCode: "P-101", productName: "Kot Pantolon", quantity: 80, customerName: customers[1].name, status: "BEKLIYOR" as const },
      { orderNo: "WO-2026-003", productCode: "P-102", productName: "Elbise", quantity: 60, customerName: customers[2].name, status: "HAZIR" as const },
    ].map((w) =>
      prisma.workOrder.upsert({
        where: { orderNo: w.orderNo },
        update: {},
        create: w,
      })
    )
  );

  const customerOrders = await Promise.all(
    [
      { orderNo: "C-2026-001", customerId: customerMap.get("ABC Tekstil") as number, documentType: "INVOICE" as const },
      { orderNo: "C-2026-002", customerId: customerMap.get("XYZ Giyim") as number, documentType: "INVOICE" as const },
      { orderNo: "C-2026-003", customerId: customerMap.get("MNO Fashion") as number, documentType: "DISPATCH" as const },
    ].map(async (o) => {
      const existing = await prisma.customerOrder.findFirst({ where: { orderNo: o.orderNo } });
      if (existing) return existing;
      return prisma.customerOrder.create({ data: o });
    })
  );

  const resolvedCustomerOrders = await Promise.all(customerOrders);
  await prisma.customerOrderItem.createMany({
    data: [
      { orderId: resolvedCustomerOrders[0].id, productCode: "P-100", color: colors[0].name, quantity: 100, unit: "adet", unitPrice: 150, totalPrice: 15000 },
      { orderId: resolvedCustomerOrders[1].id, productCode: "P-101", color: colors[1].name, quantity: 80, unit: "adet", unitPrice: 180, totalPrice: 14400 },
      { orderId: resolvedCustomerOrders[2].id, productCode: "P-102", color: colors[2].name, quantity: 60, unit: "adet", unitPrice: 250, totalPrice: 15000 },
    ],
    skipDuplicates: true,
  });

  const workshops = await Promise.all(
    WORKSHOPS.map((w) =>
      prisma.fasonWorkshop.upsert({
        where: { name: w.name },
        update: {},
        create: { ...w, specialization: w.specialization as WorkshopType },
      })
    )
  );

  await prisma.vehicle.createMany({
    data: VEHICLES.map((v) => ({
      ...v,
      isActive: true,
    })),
    skipDuplicates: true,
  });

  console.log("Seed tamamlandi.");
  console.log({ fabrics: fabrics.length, customers: customers.length, suppliers: suppliers.length, workOrders: workOrders.length, workshops: workshops.length });
}

main()
  .catch((error) => {
    console.error("Seed hatasi:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
