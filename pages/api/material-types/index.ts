import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";

function isTransientDbError(err: unknown): boolean {
  const code =
    typeof err === "object" && err && "code" in err
      ? String((err as { code?: unknown }).code)
      : "";
  const message = err instanceof Error ? err.message : String(err);
  return code === "P2037" || message.toLowerCase().includes("too many clients");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      const materialTypes = await prisma.materialType.findMany({ orderBy: { name: "asc" } });
      return res.status(200).json(materialTypes);
    }

    if (req.method === "POST") {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: "name zorunlu" });

      const created = await prisma.materialType.create({ data: { name } });
      return res.status(201).json(created);
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  } catch (err: unknown) {
    console.error("MATERIAL-TYPES API ERROR:", err);
    if (
      typeof err === "object" &&
      err &&
      "code" in err &&
      String((err as { code?: unknown }).code) === "P2002"
    ) {
      return res.status(409).json({ error: "Bu malzeme turu zaten kayitli" });
    }
    if (req.method === "GET" && isTransientDbError(err)) {
      return res.status(200).json([]);
    }
    return res.status(500).json({
      error: "Internal Server Error",
      details: err instanceof Error ? err.message : String(err),
    });
  }
}
