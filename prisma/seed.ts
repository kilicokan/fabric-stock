import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seedUsers() {
  const hashedPassword = await bcrypt.hash("admin123", 10);
  const operatorPassword = await bcrypt.hash("operator123", 10);
  const fasonPassword = await bcrypt.hash("fason123", 10);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@mira.com" },
    update: {},
    create: {
      email: "admin@mira.com",
      password: hashedPassword,
      role: "ADMIN",
      name: "Admin User",
      stockAccess: true,
      fasonAccess: true,
      mobileAccess: true,
      isActive: true,
    },
  });

  const operatorUser = await prisma.user.upsert({
    where: { email: "operator@mira.com" },
    update: {},
    create: {
      email: "operator@mira.com",
      password: operatorPassword,
      role: "OPERATOR",
      name: "Operator User",
      stockAccess: true,
      fasonAccess: false,
      mobileAccess: false,
      isActive: true,
    },
  });

  const fasonUser = await prisma.user.upsert({
    where: { email: "fason@mira.com" },
    update: {},
    create: {
      email: "fason@mira.com",
      password: fasonPassword,
      role: "FASON_TRACKER",
      name: "Dış Kaynak Üretim Takipçi",
      stockAccess: false,
      fasonAccess: true,
      mobileAccess: true,
      isActive: true,
    },
  });

  console.log("Admin user:", adminUser.email);
  console.log("Operator user:", operatorUser.email);
  console.log("Dış Kaynak Üretim takipçi user:", fasonUser.email);
}

async function seedWorkshops() {
  await prisma.fasonWorkshop.upsert({
    where: { name: "Dikim Atolyesi A" },
    update: {},
    create: {
      name: "Dikim Atolyesi A",
      contactPerson: "Ahmet Yilmaz",
      phone: "0555 123 4567",
      address: "Istanbul",
      specialization: "DIKIM",
      isActive: true,
    },
  });

  await prisma.fasonWorkshop.upsert({
    where: { name: "Baski Atolyesi B" },
    update: {},
    create: {
      name: "Baski Atolyesi B",
      contactPerson: "Mehmet Kaya",
      phone: "0555 987 6543",
      address: "Istanbul",
      specialization: "BASKI_NAKIS",
      isActive: true,
    },
  });

  console.log("Workshops seeded");
}

async function seedWorkOrders() {
  // Örnek (mock) iş emirleri artık tohumlanmıyor; iş emirleri gerçek siparişlerden oluşturulur.
  console.log("Work orders seed skipped");
}

async function seedLicense() {
  const licenseModel = (prisma as any).license;
  if (!licenseModel || typeof licenseModel.upsert !== "function") {
    console.log("License model not available in client, skipping license seed.");
    return;
  }

  const seedLicenseKey = process.env.SEED_LICENSE_KEY || "DEV-TRIAL-LICENSE";
  const seedPlan = process.env.SEED_LICENSE_PLAN || "PRO";
  const rawStatus = (process.env.SEED_LICENSE_STATUS || "TRIAL").toUpperCase();
  const allowedStatuses = ["TRIAL", "ACTIVE", "GRACE", "EXPIRED", "SUSPENDED", "REVOKED"];
  const status = allowedStatuses.includes(rawStatus) ? rawStatus : "TRIAL";

  const expiresInDays = Number(process.env.SEED_LICENSE_EXPIRES_DAYS || "30");
  const graceInDays = Number(process.env.SEED_LICENSE_GRACE_DAYS || "7");
  const now = Date.now();

  const expiresAt =
    Number.isFinite(expiresInDays) && expiresInDays > 0
      ? new Date(now + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

  const graceUntil =
    Number.isFinite(graceInDays) && graceInDays > 0
      ? new Date(now + graceInDays * 24 * 60 * 60 * 1000)
      : null;

  await licenseModel.upsert({
    where: { key: seedLicenseKey },
    update: {
      plan: seedPlan,
      status,
      expiresAt,
      graceUntil,
      maxUsers: 25,
      features: {
        stock: true,
        fason: true,
        mobile: true,
        moduleAccess: {
          stock: true,
          fason: true,
          mobile: true,
        },
      },
      lastValidatedAt: new Date(),
    },
    create: {
      key: seedLicenseKey,
      plan: seedPlan,
      status,
      expiresAt,
      graceUntil,
      maxUsers: 25,
      features: {
        stock: true,
        fason: true,
        mobile: true,
        moduleAccess: {
          stock: true,
          fason: true,
          mobile: true,
        },
      },
      lastValidatedAt: new Date(),
    },
  });

  console.log("License seeded:", seedLicenseKey);
}

async function main() {
  console.log("Seeding database...");
  await seedUsers();
  await seedWorkshops();
  await seedWorkOrders();
  await seedLicense();
  console.log("Database seeded successfully.");
}

main()
  .catch((error) => {
    console.error("Seed error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
