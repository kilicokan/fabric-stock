import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const { name, contact, address } = req.body;
    try {
      const customer = await prisma.customer.create({
        data: { name, contact, address }
      });
      return res.status(200).json(customer);
    } catch (error) {
      return res.status(500).json({ error: "Müşteri eklenemedi" });
    }
  } else if (req.method === "GET") {
    const customers = await prisma.customer.findMany();
    return res.status(200).json(customers);
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}
