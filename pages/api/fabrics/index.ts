import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const fabrics = await prisma.fabricType.findMany();
      return res.status(200).json(fabrics);
    }
    if (req.method === "POST") {
      const { name } = req.body;
      const newFabric = await prisma.fabricType.create({ data: { name } });
      return res.status(201).json(newFabric);
    }
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
