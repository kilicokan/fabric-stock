import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error";

const getErrorCode = (error: unknown): string | null => {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      const colors = await prisma.color.findMany({ orderBy: { name: "asc" } });
      return res.status(200).json(colors);
    }

    if (req.method === "POST") {
      const { name, code, description } = req.body;
      if (!name) return res.status(400).json({ error: "name zorunlu" });

      const created = await prisma.color.create({ data: { name, code, description } });
      return res.status(201).json(created);
    }

    if (req.method === "PUT") {
      const { id } = req.query;
      const { name, code, description } = req.body;

      if (!id || !name) return res.status(400).json({ error: "id ve name zorunlu" });

      const updated = await prisma.color.update({
        where: { id: parseInt(id as string) },
        data: { name, code, description }
      });
      return res.status(200).json(updated);
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "id zorunlu" });

      await prisma.color.delete({ where: { id: parseInt(id as string) } });
      return res.status(204).end();
    }

    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  } catch (err: unknown) {
    console.error("COLORS API ERROR:", err);
    if (getErrorCode(err) === "P2002") return res.status(409).json({ error: "Bu renk kodu veya adı zaten kayıtlı" });
    return res.status(500).json({ error: "Internal Server Error", details: getErrorMessage(err) });
  }
}

