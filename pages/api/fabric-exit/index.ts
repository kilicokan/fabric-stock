import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      // Tüm çıkış kayıtlarını listele
      const exits = await prisma.fabricExit.findMany({
        include: {
          fabricEntry: { include: { fabricType: true, color: true } },
          cuttingTable: true,
        },
        orderBy: { createdAt: "desc" },
      });
      return res.status(200).json(exits);
    }

    if (req.method === "POST") {
      const {
        modelNo,
        orderNo,
        customerId,
        layerCount,
        productWeight,
        cuttingTableId,
        fabricEntryId,
      } = req.body;

      if (!fabricEntryId || !cuttingTableId) {
        return res.status(400).json({ error: "FabricEntry ve CuttingTable zorunlu" });
      }

      const exit = await prisma.fabricExit.create({
        data: {
          modelNo,
          orderNo,
          customerId,
          layerCount: parseInt(layerCount),
          productWeight: parseFloat(productWeight),
          cuttingTable: { connect: { id: parseInt(cuttingTableId) } },
          fabricEntry: { connect: { id: parseInt(fabricEntryId) } },
        },
      });

      return res.status(201).json(exit);
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error("FabricExit API Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
