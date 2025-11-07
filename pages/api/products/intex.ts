import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      const products = await prisma.product.findMany();
      return res.status(200).json(products);
    }

    if (req.method === "POST") {
      const { modelNo, name, description, image } = req.body;
      if (!modelNo || !name)
        return res.status(400).json({ error: "Model No ve Ürün adı gerekli" });

      const newProduct = await prisma.product.create({
        data: { modelNo, name, description, image },
      });

      return res.status(201).json(newProduct);
    }

    if (req.method === "PUT") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "ID gerekli" });

      const { modelNo, name, description, image } = req.body;
      if (!modelNo || !name)
        return res.status(400).json({ error: "Model No ve Ürün adı gerekli" });

      const updatedProduct = await prisma.product.update({
        where: { id: parseInt(id as string) },
        data: { modelNo, name, description, image },
      });

      return res.status(200).json(updatedProduct);
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "ID gerekli" });

      await prisma.product.delete({
        where: { id: parseInt(id as string) },
      });

      return res.status(200).json({ message: "Ürün silindi" });
    }

    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error("PRODUCTS API ERROR:", error);
    return res.status(500).json({ error: error.message });
  }
}
