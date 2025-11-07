import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    switch (req.method) {
      case "POST": {
        const { fabricType, color, weightKg, lengthMeter, supplier } = req.body;

        if (!fabricType || !color || !weightKg) {
          return res.status(400).json({ message: "Zorunlu alanlar eksik." });
        }

        // Look up IDs by names
        const fabricRecord = await prisma.fabric.findFirst({ where: { name: fabricType } });
        const colorRecord = await prisma.color.findFirst({ where: { name: color } });

        if (!fabricRecord || !colorRecord) {
          return res.status(400).json({ message: "Geçersiz kumaş veya renk." });
        }

        const newEntry: Awaited<ReturnType<typeof prisma.fabricEntry.create>> = await prisma.fabricEntry.create({
          data: {
            fabricId: fabricRecord.id,
            colorId: colorRecord.id,
            quantityKg: Number(weightKg),
            lengthMeter: lengthMeter ? Number(lengthMeter) : null,
            entryDate: new Date()
          }
        });

        return res.status(201).json(newEntry);
      }

      case "GET": {
        const entries = await prisma.fabricEntry.findMany({
          include: {
            fabric: true,
            color: true
          },
          orderBy: { id: "desc" }
        });

        return res.status(200).json(entries);
      }

      default:
        res.setHeader("Allow", ["GET", "POST"]);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error: any) {
    console.error("❌ API Hatası:", error);
    return res.status(500).json({ message: "Sunucu hatası", error: error.message });
  }
}
