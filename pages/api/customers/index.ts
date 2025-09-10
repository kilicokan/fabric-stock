// pages/api/customers/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import pool from "../../../utils/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    try {
      const customers = await pool.customer.findMany({
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
        },
        orderBy: {
          id: "desc",
        },
      });
      res.status(200).json(customers);
    } catch (error: any) {
      console.error("PostgreSQL GET error:", error);
      res.status(500).json({ message: "Müşteriler alınamadı", error: error.message });
    }
  }

  else if (req.method === "POST") {
    const { name, contact, address } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Müşteri adı zorunludur" });
    }

    try {
      const customer = await pool.customer.create({
        data: {
          name,
          // Replace 'contact' with the correct field name as defined in your Prisma schema, e.g. 'phone'
          phone: contact || null,
          address: address || null,
        },
        select: {
          id: true,
          name: true,
          contact: true,
          address: true,
        },
      });

      res.status(201).json(customer);
    } catch (error: any) {
      console.error("PostgreSQL POST error:", error);
      res.status(500).json({ message: "Müşteri eklenemedi", error: error.message });
    }
  }

  else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).json({ message: "Method not allowed" });
  }
}
