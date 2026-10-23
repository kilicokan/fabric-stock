import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import prisma from "../../../lib/prisma";

type SupplyRow = {
  id: number;
  supplierName: string | null;
  accessoryName: string | null;
  colorName: string | null;
  date: Date | null;
  quantity: number | null;
  unitType: string | null;
};

const isMeter = (value: string | null | undefined): boolean =>
  String(value || "").toLowerCase().startsWith("m");

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ message: `Method ${req.method} not allowed` });
  }

  try {
    const rows = await prisma.$queryRaw<SupplyRow[]>(Prisma.sql`
      SELECT
        ad."id",
        ad."supplierName",
        a."name" AS "accessoryName",
        c."name" AS "colorName",
        ad."date",
        ad."quantity",
        ad."unitType"
      FROM "AccessoryDocument" ad
      LEFT JOIN "Accessory" a ON a."id" = ad."accessoryId"
      LEFT JOIN "Color" c ON c."id" = ad."colorId"
      ORDER BY ad."date" DESC, ad."id" DESC
    `);

    const supplies = rows.map((row) => {
      const quantity = Number(row.quantity || 0);
      const meter = isMeter(row.unitType);
      return {
        id: String(row.id),
        supplierName: row.supplierName || "-",
        fabricType: row.accessoryName || "Bilinmeyen Aksesuar",
        color: row.colorName || "-",
        arrivalDate: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
        quantityKg: meter ? 0 : quantity,
        quantityMeter: meter ? quantity : 0,
      };
    });

    return res.status(200).json(supplies);
  } catch (error: unknown) {
    console.error("Accessory supply list error:", error);
    return res.status(500).json({
      message: "Aksesuar tedarik verileri alinamadi",
      error: error instanceof Error ? error.message : "Bilinmeyen hata",
    });
  }
}
