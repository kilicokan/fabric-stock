import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "../../../lib/prisma"; // prisma client buradan import edilmeli

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    try {
      const { code, name, property, width, length, depot, unit, stockQuantity } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Kumaş adı gerekli." });
      }

      const fabric = await prisma.fabric.create({
        data: {
          code,
          name,
          property,
          width: width ? parseFloat(width) : null,
          length: length ? parseFloat(length) : null,
          depot,
          unit,
          stockQuantity: stockQuantity ? parseFloat(stockQuantity) : 0,
        },
      });

      return res.status(201).json({ fabric });
    } catch (error: any) {
      console.error("Kumaş ekleme hatası:", error);
      return res.status(500).json({ message: "Kumaş eklenemedi", error: error.message });
    }
  }

  if (req.method === "GET") {
    try {
      const fabrics = await prisma.fabric.findMany({
        orderBy: { createdAt: "desc" },
      });

      // Calculate dynamic stockQuantity for each fabric
      const fabricsWithStock = await Promise.all(
        fabrics.map(async (fabric) => {
          // Sum of entries (quantityKg)
          const totalIn = await prisma.fabricEntry.aggregate({
            _sum: { quantityKg: true },
            where: { fabricId: fabric.id },
          }).then(res => res._sum.quantityKg || 0);

          // Sum of exits (productWeightKg) where fabricType matches fabric name
          const totalOut = await prisma.fabricExit.aggregate({
            _sum: { productWeightKg: true },
            where: { fabricType: fabric.name },
          }).then(res => res._sum.productWeightKg || 0);

          // Calculate stockQuantity: entries - exits
          const stockQuantity = totalIn - totalOut;

          return {
            ...fabric,
            stockQuantity,
            totalIn,
            totalOut,
          };
        })
      );

      return res.status(200).json(fabricsWithStock);
    } catch (error: any) {
      console.error("Kumaş listeleme hatası:", error);
      return res.status(500).json({ message: "Kumaşlar alınamadı", error: error.message });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ message: `Method ${req.method} not allowed` });
}
