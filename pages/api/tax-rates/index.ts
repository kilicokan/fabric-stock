import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error";

const getErrorCode = (error: unknown): string | undefined =>
  typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : undefined;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      const taxRates = await prisma.taxRate.findMany({ orderBy: { name: "asc" } });
      return res.status(200).json(taxRates);
    }

    if (req.method === "POST") {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: "name zorunlu" });

      const created = await prisma.taxRate.create({ data: { name } });
      return res.status(201).json(created);
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  } catch (err: unknown) {
    console.error("TAX-RATES API ERROR:", err);
    if (getErrorCode(err) === "P2002") return res.status(409).json({ error: "Bu vergi oranı zaten kayıtlı" });
    return res.status(500).json({ error: "Internal Server Error", details: getErrorMessage(err) });
  }
}
