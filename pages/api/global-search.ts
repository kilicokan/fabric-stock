import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

type SearchResult = {
  type: string;
  label: string;
  name: string;
  description?: string;
  path: string;
  id: number | string;
};

const normalizeForSearch = (value: string): string =>
  value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0131/g, "i")
    .replace(/\u011f/g, "g")
    .replace(/\u00fc/g, "u")
    .replace(/\u015f/g, "s")
    .replace(/\u00f6/g, "o")
    .replace(/\u00e7/g, "c")
    .trim();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!verifyToken(req.headers.authorization)) {
    return res.status(401).json({ error: "Giris gerekli" });
  }

  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!query) {
    return res.json({ results: [] });
  }

  const normalizedQuery = normalizeForSearch(query);
  const results: SearchResult[] = [];

  const [products, fabrics, customers, suppliers, workOrders, workshops, vehicles] =
    await Promise.all([
      prisma.product.findMany({
        where: {
          OR: [
            { modelNo: { contains: normalizedQuery, mode: "insensitive" as const } },
            { name: { contains: normalizedQuery, mode: "insensitive" as const } },
          ],
        },
        take: 5,
        select: { id: true, modelNo: true, name: true, materialType: { select: { name: true } } },
      }),
      prisma.fabric.findMany({
        where: {
          OR: [
            { name: { contains: normalizedQuery, mode: "insensitive" as const } },
            { code: { contains: normalizedQuery, mode: "insensitive" as const } },
          ],
        },
        take: 5,
        select: { id: true, name: true, code: true, warehouse: { select: { name: true } } },
      }),
      prisma.customer.findMany({
        where: {
          OR: [
            { name: { contains: normalizedQuery, mode: "insensitive" as const } },
            { phone: { contains: normalizedQuery, mode: "insensitive" as const } },
            { email: { contains: normalizedQuery, mode: "insensitive" as const } },
          ],
        },
        take: 5,
        select: { id: true, name: true, phone: true, email: true },
      }),
      prisma.supplier.findMany({
        where: {
          OR: [
            { name: { contains: normalizedQuery, mode: "insensitive" as const } },
            { phone: { contains: normalizedQuery, mode: "insensitive" as const } },
            { email: { contains: normalizedQuery, mode: "insensitive" as const } },
          ],
        },
        take: 5,
        select: { id: true, name: true, phone: true, email: true },
      }),
      prisma.workOrder.findMany({
        where: {
          OR: [
            { orderNo: { contains: normalizedQuery, mode: "insensitive" as const } },
            { productCode: { contains: normalizedQuery, mode: "insensitive" as const } },
            { productName: { contains: normalizedQuery, mode: "insensitive" as const } },
            { customerName: { contains: normalizedQuery, mode: "insensitive" as const } },
          ],
        },
        take: 5,
        select: { id: true, orderNo: true, productCode: true, productName: true, customerName: true },
      }),
      prisma.fasonWorkshop.findMany({
        where: {
          OR: [
            { name: { contains: normalizedQuery, mode: "insensitive" as const } },
            { contactPerson: { contains: normalizedQuery, mode: "insensitive" as const } },
          ],
        },
        take: 5,
        select: { id: true, name: true, contactPerson: true },
      }),
      prisma.vehicle.findMany({
        where: {
          OR: [
            { licensePlate: { contains: normalizedQuery, mode: "insensitive" as const } },
            { model: { contains: normalizedQuery, mode: "insensitive" as const } },
          ],
        },
        take: 5,
        select: { id: true, licensePlate: true, model: true },
      }),
    ]);

  products.forEach((p) => {
    results.push({
      type: "Urun",
      label: "Urun",
      name: `${p.modelNo} - ${p.name}`,
      description: p.materialType?.name,
      path: "/products",
      id: p.id,
    });
  });

  fabrics.forEach((f) => {
    results.push({
      type: "Kumas",
      label: "Kumas",
      name: `${f.name}${f.code ? ` (${f.code})` : ""}`,
      description: f.warehouse?.name,
      path: "/fabrics",
      id: f.id,
    });
  });

  customers.forEach((c) => {
    results.push({
      type: "Musteri",
      label: "Musteri",
      name: c.name,
      description: [c.phone, c.email].filter(Boolean).join(" | ") || undefined,
      path: "/customers/list",
      id: c.id,
    });
  });

  suppliers.forEach((s) => {
    results.push({
      type: "Tedarikci",
      label: "Tedarikci",
      name: s.name,
      description: [s.phone, s.email].filter(Boolean).join(" | ") || undefined,
      path: "/suppliers",
      id: s.id,
    });
  });

  workOrders.forEach((wo) => {
    results.push({
      type: "Is Emri",
      label: "Is Emri",
      name: `${wo.orderNo} - ${wo.productCode}`,
      description: [wo.productName, wo.customerName].filter(Boolean).join(" | ") || undefined,
      path: "/fason/trackers",
      id: wo.id,
    });
  });

  workshops.forEach((w) => {
    results.push({
      type: "Atolye",
      label: "Atolye",
      name: w.name,
      description: w.contactPerson || undefined,
      path: "/fason/workshops",
      id: w.id,
    });
  });

  vehicles.forEach((v) => {
    results.push({
      type: "Arac",
      label: "Arac",
      name: v.licensePlate,
      description: v.model || undefined,
      path: "/vehicles",
      id: v.id,
    });
  });

  res.json({ results });
}
