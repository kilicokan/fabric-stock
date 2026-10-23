import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import prisma from "@/utils/db";

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ nextOrderNumber: number }>>(Prisma.sql`
      SELECT COALESCE(MAX("orderNumber"), 0) + 1 AS "nextOrderNumber"
      FROM "FabricOrder"
    `);

    return res.status(200).json({ nextOrderNumber: Number(rows[0]?.nextOrderNumber || 1) });
  } catch (error: unknown) {
    console.error("Fabric order next number error:", error);
    return res
      .status(500)
      .json({ message: "Sonraki siparis numarasi alinamadi", error: getErrorMessage(error) });
  }
}
