import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const {
        modelNo,
        orderNo,
        customerId,
        layerCount,
        productWeightKg,
        weightKg,
        lengthMeter,
        cuttingTableId,
        fabricEntryId
      } = req.body;

      const newExit = await prisma.fabricExit.create({
        data: {
          modelNo,
          orderNo,
          customerId,
          layerCount,
          productWeightKg,
          weightKg,
          lengthMeter,
          cuttingTableId,
          fabricEntryId
        }
      });

      return res.status(201).json(newExit);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Kayıt eklenirken hata oluştu" });
    }
  }

  if (req.method === "GET") {
    try {
      const exits = await prisma.fabricExit.findMany({
        include: {
          cuttingTable: true,
          fabricEntry: {
            include: { fabricType: true, color: true }
          }
        }
      });
      return res.status(200).json(exits);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Veriler alınırken hata oluştu" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
