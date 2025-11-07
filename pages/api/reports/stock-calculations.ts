import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    try {
      // Get all fabric types
      const fabricTypes = await prisma.fabricType.findMany();

      // Get all colors
      const colors = await prisma.color.findMany();

      // Calculate stock for each fabric type and color combination
      const stockData: any[] = [];

      for (const fabricType of fabricTypes) {
        for (const color of colors) {
          // Get entries for this fabric type and color
          const entries = await prisma.fabricEntry.findMany({
            where: {
              fabricId: fabricType.id,
              colorId: color.id,
            },
          });

          // Get exits for this fabric type and color
          const exits = await prisma.fabricExit.findMany({
            where: {
              fabricType: fabricType.name,
              color: color.name,
            },
          });

          // Calculate totals
          const totalIn = entries.reduce((sum, entry) => sum + entry.quantityKg, 0);
          const totalOut = exits.reduce((sum, exit) =>
            sum + (exit.unitType === 'kg' ? exit.productWeightKg : exit.productLengthMeter), 0
          );
          const currentStock = totalIn - totalOut;

          // Only include if there's any activity
          if (totalIn > 0 || totalOut > 0) {
            stockData.push({
              id: `${fabricType.id}-${color.id}`,
              fabricName: fabricType.name,
              color: color.name,
              totalIn,
              totalOut,
              currentStock,
              unit: "kg",
              category: fabricType.name,
              minStockLevel: 10, // Default minimum stock level
              lastUpdated: new Date().toISOString().split('T')[0],
            });
          }
        }
      }

      return res.status(200).json(stockData);
    } catch (error) {
      console.error("Stock calculation error:", error);
      return res.status(500).json({ error: "Stock calculation failed" });
    }
  } else {
    return res.status(405).json({ error: "Only GET method is supported" });
  }
}
