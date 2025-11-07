import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      const materialTypes = await prisma.materialType.findMany({ orderBy: { name: "asc" } });
      return res.status(200).json(materialTypes);
    }

    if (req.method === "POST") {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: "name zorunlu" });

      const created = await prisma.materialType.create({ data: { name } });
      return res.status(201).json(created);
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  } catch (err: any) {
    console.error("MATERIAL-TYPES API ERROR:", err);
    if (err?.code === "P2002") return res.status(409).json({ error: "Bu malzeme türü zaten kayıtlı" });
    return res.status(500).json({ error: "Internal Server Error", details: err?.message });
  }
}
