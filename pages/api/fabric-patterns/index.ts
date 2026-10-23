import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import prisma from "@/utils/db";

type PatternRow = {
  id: number;
  name: string;
  createdAt: Date;
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error";

const mapPattern = (row: PatternRow) => ({
  id: Number(row.id),
  name: String(row.name || ""),
  createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date(row.createdAt).toISOString(),
});

const isNameConstraintError = (error: unknown): boolean => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  const metaMessage =
    typeof error.meta === "object" && error.meta && "message" in error.meta
      ? String((error.meta as { message?: unknown }).message || "")
      : "";

  return error.code === "P2002" || metaMessage.includes("FabricPattern_name_key");
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    try {
      const rows = await prisma.$queryRaw<PatternRow[]>(Prisma.sql`
        SELECT "id", "name", "createdAt"
        FROM "FabricPattern"
        ORDER BY "name" ASC
      `);

      return res.status(200).json(rows.map(mapPattern));
    } catch (error: unknown) {
      console.error("Fabric patterns GET error:", error);
      return res
        .status(500)
        .json({ message: "Desenler alinamadi", error: getErrorMessage(error) });
    }
  }

  if (req.method === "POST") {
    const name = String(req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({ message: "Desen adi zorunludur" });
    }

    try {
      const rows = await prisma.$queryRaw<PatternRow[]>(Prisma.sql`
        INSERT INTO "FabricPattern" ("name", "createdAt")
        VALUES (${name}, NOW())
        RETURNING "id", "name", "createdAt"
      `);

      return res.status(201).json(mapPattern(rows[0]));
    } catch (error: unknown) {
      console.error("Fabric patterns POST error:", error);
      if (isNameConstraintError(error)) {
        return res.status(409).json({ message: "Bu desen zaten tanimli" });
      }
      return res
        .status(500)
        .json({ message: "Desen eklenemedi", error: getErrorMessage(error) });
    }
  }

  if (req.method === "PUT") {
    const id = Number(req.body?.id);
    const name = String(req.body?.name || "").trim();

    if (!id || !name) {
      return res.status(400).json({ message: "ID ve desen adi zorunludur" });
    }

    try {
      const rows = await prisma.$queryRaw<PatternRow[]>(Prisma.sql`
        UPDATE "FabricPattern"
        SET "name" = ${name}
        WHERE "id" = ${id}
        RETURNING "id", "name", "createdAt"
      `);

      if (!rows.length) {
        return res.status(404).json({ message: "Desen bulunamadi" });
      }

      return res.status(200).json(mapPattern(rows[0]));
    } catch (error: unknown) {
      console.error("Fabric patterns PUT error:", error);
      if (isNameConstraintError(error)) {
        return res.status(409).json({ message: "Bu desen zaten tanimli" });
      }
      return res
        .status(500)
        .json({ message: "Desen guncellenemedi", error: getErrorMessage(error) });
    }
  }

  if (req.method === "DELETE") {
    const id = Number(req.body?.id);
    if (!id) {
      return res.status(400).json({ message: "ID zorunludur" });
    }

    try {
      const rows = await prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
        DELETE FROM "FabricPattern"
        WHERE "id" = ${id}
        RETURNING "id"
      `);

      if (!rows.length) {
        return res.status(404).json({ message: "Desen bulunamadi" });
      }

      return res.status(200).json({ message: "Desen silindi" });
    } catch (error: unknown) {
      console.error("Fabric patterns DELETE error:", error);
      return res
        .status(500)
        .json({ message: "Desen silinemedi", error: getErrorMessage(error) });
    }
  }

  res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
  return res.status(405).json({ message: "Method not allowed" });
}
