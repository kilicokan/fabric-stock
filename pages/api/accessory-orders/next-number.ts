import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import prisma from "@/utils/db";

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error";

const isMissingAccessoryOrderTable = (error: unknown): boolean => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021") {
      return true;
    }

    if (error.code === "P2010") {
      const meta =
        typeof error.meta === "object" && error.meta !== null
          ? (error.meta as { code?: unknown; message?: unknown })
          : undefined;

      const metaCode = String(meta?.code || "").toUpperCase();
      const metaMessage = String(meta?.message || "").toLowerCase();
      if (metaCode === "42P01" && metaMessage.includes("accessoryorder")) {
        return true;
      }
    }
  }

  if (!(error instanceof Error)) return false;

  const lowerMessage = error.message.toLowerCase();
  return (
    lowerMessage.includes("42p01") &&
    lowerMessage.includes("does not exist") &&
    lowerMessage.includes("accessoryorder")
  );
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ nextOrderNumber: number }>>(Prisma.sql`
      SELECT COALESCE(MAX("orderNumber"), 0) + 1 AS "nextOrderNumber"
      FROM "AccessoryOrder"
    `);

    return res.status(200).json({ nextOrderNumber: Number(rows[0]?.nextOrderNumber || 1) });
  } catch (error: unknown) {
    if (isMissingAccessoryOrderTable(error)) {
      console.warn("AccessoryOrder table is missing, returning default nextOrderNumber=1.");
      return res.status(200).json({ nextOrderNumber: 1 });
    }

    console.error("Fabric order next number error:", error);
    return res
      .status(500)
      .json({ message: "Sonraki siparis numarasi alinamadi", error: getErrorMessage(error) });
  }
}

