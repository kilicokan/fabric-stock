import type { NextApiRequest, NextApiResponse } from "next";
import pool from "@/utils/db";

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    try {
      const suppliers = await pool.supplier.findMany({
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
      res.status(200).json(suppliers);
    } catch (error: unknown) {
      console.error("PostgreSQL GET error:", error);
      res.status(500).json({ message: "Tedarikçiler alınamadı", error: getErrorMessage(error) });
    }
  } else if (req.method === "POST") {
    const { name, phone, email } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Tedarikçi adı zorunludur" });
    }

    try {
      const supplier = await pool.supplier.create({
        data: {
          name,
          phone: phone || null,
          email: email || null,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
      });

      res.status(201).json(supplier);
    } catch (error: unknown) {
      console.error("PostgreSQL POST error:", error);
      res.status(500).json({ message: "Tedarikçi eklenemedi", error: getErrorMessage(error) });
    }
  } else if (req.method === "PUT") {
    const { id, name, phone, email } = req.body;

    if (!id || !name) {
      return res.status(400).json({ message: "ID ve tedarikçi adı zorunludur" });
    }

    try {
      const supplier = await pool.supplier.update({
        where: { id: parseInt(id, 10) },
        data: {
          name,
          phone: phone || null,
          email: email || null,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
      });

      res.status(200).json(supplier);
    } catch (error: unknown) {
      console.error("PostgreSQL PUT error:", error);
      res.status(500).json({ message: "Tedarikçi güncellenemedi", error: getErrorMessage(error) });
    }
  } else if (req.method === "DELETE") {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ message: "ID zorunludur" });
    }

    try {
      await pool.supplier.delete({
        where: { id: parseInt(id, 10) },
      });

      res.status(200).json({ message: "Tedarikçi başarıyla silindi" });
    } catch (error: unknown) {
      console.error("PostgreSQL DELETE error:", error);
      res.status(500).json({ message: "Tedarikçi silinemedi", error: getErrorMessage(error) });
    }
  } else {
    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    res.status(405).json({ message: "Method not allowed" });
  }
}
