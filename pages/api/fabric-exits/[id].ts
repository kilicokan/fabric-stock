import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const parseId = (raw: string | string[] | undefined): number | null => {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const parseFiniteNumber = (value: unknown, fieldName: string): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} geçerli bir sayı olmalıdır`);
  }
  return parsed;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = parseId(req.query.id);
  if (!id) {
    return res.status(400).json({ error: "Gecerli bir ID zorunludur" });
  }

  try {
    if (req.method === "GET") {
      const exit = await prisma.fabricExit.findUnique({
        where: { id },
        include: {
          fabricEntry: { include: { fabric: true } },
          cuttingTable: true,
        },
      });

      if (!exit) {
        return res.status(404).json({ error: "Kayit bulunamadi" });
      }

      return res.status(200).json(exit);
    }

    if (req.method === "PUT") {
      const {
        modelNo,
        orderNo,
        customerId,
        layerCount,
        grammage,
        externalProductId,
        productionKg,
        productionMeters,
        unitType,
        cuttingTable,
        color,
        fabricType,
        reportNumber,
        plannedLayers,
        actualLayers,
        createdAt,
      } = req.body || {};

      const updateData: Prisma.FabricExitUpdateInput = {};

      if (typeof modelNo === "string") updateData.modelNo = modelNo;
      if (typeof orderNo === "string") updateData.orderNo = orderNo;
      if (typeof customerId === "string") updateData.customerId = customerId;
      if (typeof layerCount !== "undefined") {
        const value = parseFiniteNumber(layerCount, "Kat sayısı");
        if (!Number.isInteger(value) || value < 1) {
          return res.status(400).json({ error: "Kat sayısı 1 veya daha büyük bir tam sayı olmalıdır" });
        }
        updateData.layerCount = value;
      }
      if (typeof grammage !== "undefined") {
        const value = parseFiniteNumber(grammage, "Gramaj");
        if (value < 0) {
          return res.status(400).json({ error: "Gramaj negatif olamaz" });
        }
        updateData.grammage = value;
      }
      if (typeof externalProductId !== "undefined") {
        const value = String(externalProductId || "").trim();
        updateData.externalProductId = value || null;
      }
      if (typeof productionKg !== "undefined") {
        const value = parseFiniteNumber(productionKg, "Üretim miktarı (kg)");
        if (value < 0) {
          return res.status(400).json({ error: "Üretim miktarı (kg) negatif olamaz" });
        }
        updateData.productWeightKg = value;
      }
      if (typeof productionMeters !== "undefined") {
        const value = parseFiniteNumber(productionMeters, "Üretim miktarı (metre)");
        if (value < 0) {
          return res.status(400).json({ error: "Üretim miktarı (metre) negatif olamaz" });
        }
        updateData.productLengthMeter = value;
      }
      if (typeof unitType === "string") {
        if (unitType !== "kg" && unitType !== "m") {
          return res.status(400).json({ error: "Birim kg veya m olmalıdır" });
        }
        updateData.unitType = unitType;
      }
      if (typeof color !== "undefined") updateData.color = color ? String(color) : null;
      if (typeof fabricType !== "undefined") updateData.fabricType = fabricType ? String(fabricType) : null;
      if (typeof reportNumber !== "undefined") updateData.reportNumber = reportNumber ? String(reportNumber) : null;
      if (typeof plannedLayers !== "undefined") updateData.plannedLayers = plannedLayers ? String(plannedLayers) : null;
      if (typeof actualLayers !== "undefined") updateData.actualLayers = actualLayers ? String(actualLayers) : null;
      if (typeof createdAt === "string" && createdAt.trim()) updateData.createdAt = new Date(createdAt);
      if (typeof cuttingTable !== "undefined") {
        const cuttingTableId = parseFiniteNumber(cuttingTable, "Kesim masası");
        if (!Number.isInteger(cuttingTableId) || cuttingTableId < 1) {
          return res.status(400).json({ error: "Geçerli bir kesim masası zorunludur" });
        }
        updateData.cuttingTable = { connect: { id: cuttingTableId } };
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "Güncellenecek alan bulunamadı" });
      }

      const existing = await prisma.fabricExit.findUnique({ where: { id }, select: { id: true } });
      if (!existing) {
        return res.status(404).json({ error: "Kayıt bulunamadı" });
      }

      const updated = await prisma.fabricExit.update({
        where: { id },
        data: updateData,
      });

      return res.status(200).json(updated);
    }

    if (req.method === "DELETE") {
      await prisma.fabricExit.delete({ where: { id } });
      return res.status(200).json({ success: true });
    }

    res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (error) {
    if (error instanceof Error && error.message.endsWith("geçerli bir sayı olmalıdır")) {
      return res.status(400).json({ error: error.message });
    }
    console.error("FabricExit by ID API Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
