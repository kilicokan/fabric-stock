import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "../../../lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    try {
      const supplies = await prisma.fabricEntry.findMany({
        include: {
          fabric: true,
          color: true,
        },
        orderBy: { entryDate: "desc" },
      });

      const formattedSupplies = supplies.map((entry) => ({
        id: entry.id.toString(),
        supplierName: "Tedarikçi", // Placeholder, as supplier is not in FabricEntry
        fabricType: entry.fabric?.name || "Unknown",
        color: entry.color?.name || "Unknown",
        arrivalDate: entry.entryDate ? entry.entryDate.toISOString() : new Date().toISOString(),
        quantityKg: entry.quantityKg || 0,
        quantityMeter: entry.lengthMeter ?? 0,
      }));

      return res.status(200).json(formattedSupplies);
    } catch (error: any) {
      console.error("Tedarik listeleme hatası:", error);
      return res.status(500).json({ message: "Tedarikler alınamadı", error: error.message });
    }
  }

  res.setHeader("Allow", ["GET"]);
  return res.status(405).json({ message: `Method ${req.method} not allowed` });
}
