import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method === "GET") {
    const products = await prisma.product.findMany({ orderBy: { modelNo: 'asc' } });
    return res.json(products);
  }

  if (req.method === "POST") {
    const { modelNo, name, description } = req.body;
    const product = await prisma.product.create({
      data: { modelNo, name, description }
    });
    return res.json(product);
  }
}
