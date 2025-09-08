// pages/api/fabric-entry/index.ts
import { PrismaClient } from "@prisma/client";
import { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const entries = await prisma.fabricEntry.findMany({
      include: { fabricType: true, color: true },
      orderBy: { id: "desc" },
    });
    return res.status(200).json(entries);
  }

  if (req.method === "POST") {
    const { fabricTypeId, colorId, quantityKg, lengthMeter } = req.body;
    const entry = await prisma.fabricEntry.create({
      data: {
        fabricTypeId: Number(fabricTypeId),
        colorId: Number(colorId),
        quantityKg: Number(quantityKg),
        lengthMeter: lengthMeter ? Number(lengthMeter) : null,
      },
    });
    return res.status(201).json(entry);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
