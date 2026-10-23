import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiAuth(req, res, {
    requiredAccess: "stock",
  });
  if (!auth) return;

  try {
    if (req.method === "GET") {
      const { fabricId } = req.query;
      if (!fabricId || typeof fabricId !== "string") {
        return res.status(400).json({ message: "fabricId zorunludur." });
      }

      const returns = await prisma.fabricReturn.findMany({
        where: { fabricId: Number(fabricId) },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          quantityKg: true,
          reason: true,
          createdAt: true,
          createdBy: true,
        },
      });

      return res.status(200).json(returns);
    }

    if (req.method === "POST") {
    const { fabricId, fabricName, quantityKg, reason, createdBy } = req.body;

    const resolvedFabricId = fabricId != null ? Number(fabricId) : null;
    const resolvedFabricName = typeof fabricName === "string" ? fabricName.trim() : null;

    if (!resolvedFabricId && !resolvedFabricName) {
      return res.status(400).json({ message: "fabricId veya fabricName zorunludur." });
    }

    if (quantityKg == null || Number(quantityKg) <= 0) {
      return res.status(400).json({ message: "Geçersiz iade miktarı." });
    }

    let fabric = null;
    if (resolvedFabricId) {
      fabric = await prisma.fabric.findUnique({
        where: { id: resolvedFabricId },
        select: { id: true, defectiveQuantity: true },
      });
    } else if (resolvedFabricName) {
      fabric = await prisma.fabric.findFirst({
        where: { name: { equals: resolvedFabricName, mode: "insensitive" } },
        select: { id: true, defectiveQuantity: true },
      });
    }

    if (!fabric) {
      return res.status(404).json({ message: "Kumaş bulunamadı." });
    }

    const updated = await prisma.fabric.update({
      where: { id: fabric.id },
      data: {
        defectiveQuantity: {
          increment: Number(quantityKg),
        },
      },
    });

    const record = await prisma.fabricReturn.create({
      data: {
        fabricId: fabric.id,
        quantityKg: Number(quantityKg),
        reason: typeof reason === "string" ? reason.trim() : null,
        createdBy: createdBy ? Number(createdBy) : null,
      },
    });

    return res.status(201).json({ fabric: updated, return: record });
  }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ message: `Method ${req.method} not allowed` });
  } catch (error) {
    console.error("Fabric return error:", error);
    return res.status(500).json({
      message: "İade işlemi başarısız",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
