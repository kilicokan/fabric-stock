import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type FabricEntryPostBody = {
  fabricType?: string;
  fabricTypeId?: string | number;
  color?: string;
  colorId?: string | number;
  weightKg?: string | number;
  quantityKg?: string | number;
  lengthMeter?: string | number | null;
  supplier?: string;
};

const safeFabricSelect = {
  id: true,
  code: true,
  name: true,
  property: true,
  width: true,
  length: true,
  depot: true,
  unit: true,
  stockQuantity: true,
  createdAt: true,
} as const;

const safeColorSelect = {
  id: true,
  name: true,
  code: true,
  description: true,
  createdAt: true,
} as const;

const toSafeNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeText = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const parsePositiveInt = (value: unknown): number | null => {
  const parsed = toSafeNumber(value);
  if (parsed === null) return null;
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    try {
      const entries = await prisma.fabricEntry.findMany({
        select: {
          id: true,
          fabricId: true,
          colorId: true,
          quantityKg: true,
          lengthMeter: true,
          entryDate: true,
          createdAt: true,
          fabric: {
            select: safeFabricSelect,
          },
          color: {
            select: safeColorSelect,
          },
        },
        orderBy: { id: "desc" },
      });
      return res.status(200).json(entries);
    } catch (error) {
      console.error("[fabric-entry][GET] error:", error);
      return res.status(500).json({ message: "Kumas girisleri listelenemedi." });
    }
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const body = (req.body || {}) as FabricEntryPostBody;

    const quantityKg = toSafeNumber(body.weightKg ?? body.quantityKg);
    const lengthMeterRaw = toSafeNumber(body.lengthMeter);
    const lengthMeter = lengthMeterRaw === null ? null : lengthMeterRaw;

    if (quantityKg === null || quantityKg <= 0) {
      return res.status(400).json({ message: "Gecerli bir agirlik (kg) giriniz." });
    }

    const requestedFabricId = parsePositiveInt(body.fabricTypeId);
    const requestedColorId = parsePositiveInt(body.colorId);
    const fabricTypeName = normalizeText(body.fabricType);
    const colorName = normalizeText(body.color);

    const fabricRecord = requestedFabricId
      ? await prisma.fabric.findUnique({ where: { id: requestedFabricId }, select: safeFabricSelect })
      : fabricTypeName
        ? await prisma.fabric.findFirst({ where: { name: fabricTypeName }, select: safeFabricSelect })
        : null;

    const colorRecord = requestedColorId
      ? await prisma.color.findUnique({ where: { id: requestedColorId }, select: safeColorSelect })
      : colorName
        ? await prisma.color.findFirst({ where: { name: colorName }, select: safeColorSelect })
        : null;

    if (!fabricRecord) {
      return res.status(400).json({ message: "Kumas secimi gecersiz veya bulunamadi." });
    }

    if (!colorRecord) {
      return res.status(400).json({ message: "Renk secimi gecersiz veya bulunamadi." });
    }

    const newEntry = await prisma.fabricEntry.create({
      data: {
        fabricId: fabricRecord.id,
        colorId: colorRecord.id,
        quantityKg,
        lengthMeter,
        entryDate: new Date(),
      },
      select: {
        id: true,
        fabricId: true,
        colorId: true,
        quantityKg: true,
        lengthMeter: true,
        entryDate: true,
        createdAt: true,
        fabric: {
          select: safeFabricSelect,
        },
        color: {
          select: safeColorSelect,
        },
      },
    });

    return res.status(201).json({
      message: "Kumas girisi basariyla kaydedildi.",
      entry: newEntry,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003") {
        return res.status(400).json({ message: "Secilen kumas veya renkle iliski kurulamadi." });
      }
      if (error.code === "P2021") {
        return res.status(500).json({ message: "Veritabani tablosu bulunamadi. Migration kontrol edin." });
      }
    }

    console.error("[fabric-entry][POST] error:", error);
    const debugMessage = error instanceof Error ? error.message : undefined;
    return res.status(500).json({
      message: "Kumas girisi kaydedilirken sunucu hatasi olustu.",
      ...(process.env.NODE_ENV !== "production" && debugMessage ? { debug: debugMessage } : {}),
    });
  }
}

