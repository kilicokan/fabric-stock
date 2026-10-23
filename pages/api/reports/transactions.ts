import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

const toText = (value: string | null | undefined, fallback: string): string => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 ? normalized : fallback;
};

const normalizeUnit = (value: string | null | undefined): "kg" | "metre" => {
  const normalized = toText(value, "kg").toLocaleLowerCase("tr-TR");
  return normalized.startsWith("m") ? "metre" : "kg";
};

const formatIncomingLabel = (value: string | null | undefined, fallback: string): string => {
  const normalized = toText(value, fallback).toLocaleLowerCase("tr-TR");
  if (normalized.includes("fatur")) return "Fatura (+)";
  if (normalized.includes("irsali")) return "İrsaliye (+)";
  return `${toText(value, fallback)} (+)`;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Only GET method is supported" });
  }

  try {
    const [entries, exits, documents] = await Promise.all([
      prisma.fabricEntry.findMany({
        include: {
          fabric: true,
          color: true,
        },
        orderBy: { entryDate: "desc" },
      }),
      prisma.fabricExit.findMany({
        include: {
          cuttingTable: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.$queryRaw<
        Array<{
          id: number;
          type: string | null;
          number: string | null;
          date: Date;
          supplierName: string | null;
          supplierCode: string | null;
          quantity: number | null;
          unitType: string | null;
          fabricName: string | null;
          colorName: string | null;
        }>
      >(Prisma.sql`
        SELECT
          fd."id",
          fd."type",
          fd."number",
          fd."date",
          fd."supplierName",
          fd."supplierCode",
          fd."quantity",
          fd."unitType",
          f."name" AS "fabricName",
          c."name" AS "colorName"
        FROM "FabricDocument" fd
        LEFT JOIN "Fabric" f ON f."id" = fd."fabricId"
        LEFT JOIN "Color" c ON c."id" = fd."colorId"
        ORDER BY fd."date" DESC
      `),
    ]);

    const entryTransactions = entries.map((entry) => ({
      id: `entry-${entry.id}`,
      type: "in" as const,
      displayType: "Kumaş Girişi (+)",
      fabricName: entry.fabric.name,
      quantity: Number(entry.quantityKg) || 0,
      signedQuantity: Number(entry.quantityKg) || 0,
      unit: "kg",
      color: entry.color.name,
      supplier: "Tedarikci",
      transactionDate: entry.entryDate.toISOString().split("T")[0],
      category: entry.fabric.name,
      notes: entry.lengthMeter ? `${entry.lengthMeter} metre` : undefined,
    }));

    const documentTransactions = documents
      .map((document) => {
        const unit = normalizeUnit(document.unitType);
        const quantity = Number(document.quantity) || 0;

        return {
          id: `document-${document.id}`,
          type: "in" as const,
          displayType: formatIncomingLabel(document.type, "İrsaliye"),
          fabricName: toText(document.fabricName, "Bilinmeyen Kumas"),
          quantity,
          signedQuantity: quantity,
          unit,
          color: toText(document.colorName, "Belirtilmedi"),
          supplier: toText(document.supplierName, toText(document.supplierCode, "Tedarikci")),
          transactionDate: document.date.toISOString().split("T")[0],
          category: toText(document.fabricName, "Bilinmeyen"),
          notes: `Belge: ${toText(document.number, "-")} (${toText(document.type, "irsaliye")})`,
        };
      })
      .filter((transaction) => transaction.quantity > 0);

    const exitTransactions = exits.map((exit) => ({
      id: `exit-${exit.id}`,
      type: "out" as const,
      displayType: "Kesim (-)",
      fabricName: toText(exit.fabricType, "Bilinmeyen"),
      quantity: normalizeUnit(exit.unitType) === "kg" ? Number(exit.productWeightKg) || 0 : Number(exit.productLengthMeter) || 0,
      signedQuantity:
        -(
          normalizeUnit(exit.unitType) === "kg"
            ? Number(exit.productWeightKg) || 0
            : Number(exit.productLengthMeter) || 0
        ),
      unit: normalizeUnit(exit.unitType),
      color: toText(exit.color, "Bilinmeyen"),
      customer: exit.customerId,
      transactionDate: exit.createdAt.toISOString().split("T")[0],
      category: toText(exit.fabricType, "Bilinmeyen"),
      notes: `Model: ${exit.modelNo}, Siparis: ${exit.orderNo}`,
    }));

    const allTransactions = [...entryTransactions, ...documentTransactions, ...exitTransactions].sort(
      (a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
    );

    return res.status(200).json(allTransactions);
  } catch (error) {
    console.error("Transaction report error:", error);
    return res.status(500).json({ error: "Transaction report could not be generated" });
  }
}
