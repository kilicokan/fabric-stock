import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

const toText = (value: string | null | undefined, fallback: string): string => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 ? normalized : fallback;
};

const normalizeUnit = (value: string | null | undefined): string => {
  const normalized = toText(value, "adet").toLocaleLowerCase("tr-TR");
  if (normalized.startsWith("m")) return "metre";
  if (normalized.startsWith("kg")) return "kg";
  return "adet";
};

const formatIncomingLabel = (value: string | null | undefined, fallback: string): string => {
  const normalized = toText(value, fallback).toLocaleLowerCase("tr-TR");
  if (normalized.includes("fatur")) return "Fatura (+)";
  if (normalized.includes("irsali")) return "İrsaliye (+)";
  return `${toText(value, fallback)} (+)`;
};

const formatOutgoingLabel = (value: string | null | undefined, fallback: string): string => {
  const normalized = toText(value, fallback).toLocaleLowerCase("tr-TR");
  if (normalized.includes("irsali")) return "İrsaliye (-)";
  return `${toText(value, fallback)} (-)`;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Only GET method is supported" });
  }

  try {
    const [documents, orders] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          id: number;
          type: string | null;
          number: string | null;
          date: Date;
          customer: string | null;
          warehouse: string | null;
          quantity: number | null;
          unitType: string | null;
          accessoryName: string | null;
          colorName: string | null;
          supplierName: string | null;
          orderNo: string | null;
        }>
      >(Prisma.sql`
        SELECT
          ad."id",
          ad."type",
          ad."number",
          ad."date",
          ad."customer",
          ad."warehouse",
          ad."quantity",
          ad."unitType",
          a."name" AS "accessoryName",
          c."name" AS "colorName",
          ad."supplierName",
          ad."orderNo"
        FROM "AccessoryDocument" ad
        LEFT JOIN "Accessory" a ON a."id" = ad."accessoryId"
        LEFT JOIN "Color" c ON c."id" = ad."colorId"
        ORDER BY ad."date" DESC
      `),
      prisma.$queryRaw<
        Array<{
          id: number;
          orderNumber: number;
          orderDate: Date;
          quantity: number | null;
          unitType: string | null;
          accessoryName: string | null;
          colorName: string | null;
          supplierName: string | null;
          status: string | null;
          arrivalDate: Date | null;
        }>
      >(Prisma.sql`
        SELECT
          ao."id",
          ao."orderNumber",
          ao."orderDate",
          ao."quantity",
          ao."unitType",
          a."name" AS "accessoryName",
          c."name" AS "colorName",
          s."name" AS "supplierName",
          ao."status",
          ao."arrivalDate"
        FROM "AccessoryOrder" ao
        LEFT JOIN "Accessory" a ON a."id" = ao."accessoryId"
        LEFT JOIN "Color" c ON c."id" = ao."colorId"
        LEFT JOIN "Supplier" s ON s."id" = ao."supplierId"
        ORDER BY ao."orderDate" DESC
      `),
    ]);

    // Process document transactions (entries and exits)
    const documentTransactions = documents
      .map((document) => {
        const unit = normalizeUnit(document.unitType);
        const quantity = Number(document.quantity) || 0;
        const isEntry = document.type?.toLowerCase().includes("giriş") || 
                      document.type?.toLowerCase().includes("irsaliye") ||
                      document.type?.toLowerCase().includes("fatura") ||
                      document.customer?.toLowerCase().includes("tedarik");

        return {
          id: `doc-${document.id}`,
          type: isEntry ? ("in" as const) : ("out" as const),
          displayType: isEntry 
            ? formatIncomingLabel(document.type, "İrsaliye")
            : formatOutgoingLabel(document.type, "Çıkış"),
          accessoryName: toText(document.accessoryName, "Bilinmeyen Aksesuar"),
          quantity,
          signedQuantity: isEntry ? quantity : -quantity,
          unit,
          color: toText(document.colorName, "Belirtilmedi"),
          supplier: toText(document.supplierName, "Tedarikci"),
          customer: toText(document.customer, ""),
          transactionDate: document.date.toISOString().split("T")[0],
          category: toText(document.accessoryName, "Bilinmeyen"),
          notes: `Belge: ${toText(document.number, "-")} (${toText(document.type, "Belge")})`,
        };
      })
      .filter((transaction) => transaction.quantity > 0);

    // Process order transactions (pending orders as future entries)
    const orderTransactions = orders
      .filter((order) => order.status === "Tamamlandı" || order.status === "Teslim Alındı")
      .map((order) => {
        const unit = normalizeUnit(order.unitType);
        const quantity = Number(order.quantity) || 0;

        return {
          id: `order-${order.id}`,
          type: "in" as const,
          displayType: "Sipariş (+) - " + toText(order.status, "Tamamlandı"),
          accessoryName: toText(order.accessoryName, "Bilinmeyen Aksesuar"),
          quantity,
          signedQuantity: quantity,
          unit,
          color: toText(order.colorName, "Belirtilmedi"),
          supplier: toText(order.supplierName, "Tedarikci"),
          transactionDate: order.arrivalDate 
            ? order.arrivalDate.toISOString().split("T")[0]
            : order.orderDate.toISOString().split("T")[0],
          category: toText(order.accessoryName, "Bilinmeyen"),
          notes: `Sipariş No: ${order.orderNumber} (${toText(order.status, "Beklemede")})`,
        };
      })
      .filter((transaction) => transaction.quantity > 0);

    const allTransactions = [...orderTransactions, ...documentTransactions].sort(
      (a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
    );

    return res.status(200).json(allTransactions);
  } catch (error) {
    console.error("Accessory transaction report error:", error);
    return res.status(500).json({ error: "Accessory transaction report could not be generated" });
  }
}
