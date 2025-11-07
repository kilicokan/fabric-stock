import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    try {
      // Get fabric entries
      const entries = await prisma.fabricEntry.findMany({
        include: {
          fabric: true,
          color: true,
        },
        orderBy: { entryDate: "desc" },
      });

      // Get fabric exits
      const exits = await prisma.fabricExit.findMany({
        include: {
          cuttingTable: true,
        },
        orderBy: { createdAt: "desc" },
      });

      // Transform entries to transaction format
      const entryTransactions = entries.map((entry) => ({
        id: `entry-${entry.id}`,
        type: "in" as const,
        fabricName: entry.fabric.name,
        quantity: entry.quantityKg,
        unit: "kg",
        color: entry.color.name,
        supplier: "Tedarikçi", // This could be enhanced with supplier data if available
        transactionDate: entry.entryDate.toISOString().split('T')[0],
        category: entry.fabric.name,
        notes: entry.lengthMeter ? `${entry.lengthMeter} metre` : undefined,
      }));

      // Transform exits to transaction format
      const exitTransactions = exits.map((exit) => ({
        id: `exit-${exit.id}`,
        type: "out" as const,
        fabricName: exit.fabricType || "Bilinmeyen",
        quantity: exit.unitType === 'kg' ? exit.productWeightKg : exit.productLengthMeter,
        unit: exit.unitType === 'kg' ? "kg" : "metre",
        color: exit.color || "Bilinmeyen",
        customer: exit.customerId,
        transactionDate: exit.createdAt.toISOString().split('T')[0],
        category: exit.fabricType || "Bilinmeyen",
        notes: `Model: ${exit.modelNo}, Sipariş: ${exit.orderNo}`,
      }));

      // Combine and sort by date (newest first)
      const allTransactions = [...entryTransactions, ...exitTransactions].sort(
        (a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
      );

      return res.status(200).json(allTransactions);
    } catch (error) {
      console.error("Transaction report error:", error);
      return res.status(500).json({ error: "Transaction report could not be generated" });
    }
  } else {
    return res.status(405).json({ error: "Only GET method is supported" });
  }
}
