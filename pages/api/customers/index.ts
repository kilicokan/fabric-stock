// pages/api/customers/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import pool from "@/utils/db";
import { requireApiAuth } from "@/lib/api-auth";

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiAuth(req, res, {
    requireLicense: true,
    feature: "stock",
  });
  if (!auth) return;

  if (req.method === "GET") {
    try {
      const customers = await pool.customer.findMany({
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
        orderBy: {
          id: "desc",
        },
      });
      res.status(200).json(customers);
    } catch (error: unknown) {
      console.error("PostgreSQL GET error:", error);
      res.status(500).json({ message: "Müşteriler alınamadı", error: getErrorMessage(error) });
    }
  } else if (req.method === "POST") {
    const { name, contact, address } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Müşteri adı zorunludur" });
    }

    try {
      const customer = await pool.customer.create({
        data: {
          name,
          phone: contact || null,
          email: address || null,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
      });

      res.status(201).json(customer);
    } catch (error: unknown) {
      console.error("PostgreSQL POST error:", error);
      res.status(500).json({ message: "Müşteri eklenemedi", error: getErrorMessage(error) });
    }
  } else if (req.method === "PUT") {
    const { id, name, contact, address } = req.body;

    if (!id || !name) {
      return res.status(400).json({ message: "ID ve müşteri adı zorunludur" });
    }

    try {
      const customer = await pool.customer.update({
        where: { id: parseInt(id, 10) },
        data: {
          name,
          phone: contact || null,
          email: address || null,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
      });

      res.status(200).json(customer);
    } catch (error: unknown) {
      console.error("PostgreSQL PUT error:", error);
      res.status(500).json({ message: "Müşteri güncellenemedi", error: getErrorMessage(error) });
    }
  } else if (req.method === "DELETE") {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ message: "ID zorunludur" });
    }

    try {
      await pool.customer.delete({
        where: { id: parseInt(id, 10) },
      });

      res.status(200).json({ message: "Müşteri başarıyla silindi" });
    } catch (error: unknown) {
      console.error("PostgreSQL DELETE error:", error);
      res.status(500).json({ message: "Müşteri silinemedi", error: getErrorMessage(error) });
    }
  } else {
    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    res.status(405).json({ message: "Method not allowed" });
  }
}
