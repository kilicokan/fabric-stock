import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const products = await prisma.product.findMany();
      return res.status(200).json(products);
    }

    if (req.method === "POST") {
      const { modelNo, name } = req.body;
      if (!modelNo || !name)
        return res.status(400).json({ error: "Model No ve Ürün adı gerekli" });

      const newProduct = await prisma.product.create({
        data: { modelNo, name },
      });

      return res.status(201).json(newProduct);
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error("PRODUCTS API ERROR:", error);
    return res.status(500).json({ error: error.message });
  }
}
