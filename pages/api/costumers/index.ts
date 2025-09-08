import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const customers = await prisma.customer.findMany();
      return res.status(200).json(customers);
    }

    if (req.method === "POST") {
      const { name, email } = req.body;
      if (!name) return res.status(400).json({ error: "Müşteri adı gerekli" });

      const newCustomer = await prisma.customer.create({
        data: { name, email },
      });

      return res.status(201).json(newCustomer);
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error("CUSTOMERS API ERROR:", error);
    return res.status(500).json({ error: error.message });
  }
}
