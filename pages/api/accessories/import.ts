import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "../../../lib/prisma";

type ImportAccessory = {
  code?: string;
  name: string;
  unit?: string;
  stockQuantity?: number | string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Yalnizca POST metodu destekleniyor." });
    }

    const incoming =
      Array.isArray(req.body?.accessories) && req.body.accessories.length > 0
        ? req.body.accessories
        : Array.isArray(req.body?.fabrics) && req.body.fabrics.length > 0
          ? req.body.fabrics
          : req.body?.supplies;

    if (!Array.isArray(incoming) || incoming.length === 0) {
      return res.status(400).json({ message: "Gecerli aksesuar listesi gerekli." });
    }

    const errors: string[] = [];
    const successfulImports: Array<{ id: number; code: string | null; name: string; unit: string; stockQuantity: number }> = [];
    const duplicateNames: string[] = [];

    for (let i = 0; i < incoming.length; i += 1) {
      const row = incoming[i] as ImportAccessory;
      const rowNumber = i + 1;

      if (!row?.name || typeof row.name !== "string") {
        errors.push(`Satir ${rowNumber}: Aksesuar adi zorunludur.`);
        continue;
      }

      const normalizedName = row.name.trim();
      if (!normalizedName) {
        errors.push(`Satir ${rowNumber}: Aksesuar adi zorunludur.`);
        continue;
      }

      const existingAccessory = await prisma.accessory.findFirst({
        where: { name: normalizedName },
      });

      if (existingAccessory) {
        duplicateNames.push(normalizedName);
        continue;
      }

      try {
        const created = await prisma.accessory.create({
          data: {
            code: row.code?.trim() || null,
            name: normalizedName,
            unit: (row.unit && String(row.unit).trim()) || "adet",
            stockQuantity: Number(row.stockQuantity) || 0,
          },
          select: {
            id: true,
            code: true,
            name: true,
            unit: true,
            stockQuantity: true,
          },
        });

        successfulImports.push(created);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Bilinmeyen hata";
        errors.push(`Satir ${rowNumber}: Aksesuar eklenirken hata: ${message}`);
      }
    }

    const message = `${successfulImports.length} aksesuar basariyla ice aktarildi. ${errors.length} hata, ${duplicateNames.length} tekrar eden aksesuar adi.`;

    return res.status(200).json({
      success: successfulImports.length,
      errorCount: errors.length,
      duplicates: duplicateNames.length,
      message,
      importedAccessories: successfulImports,
      importedFabrics: successfulImports,
      importErrors: errors,
      duplicateNames,
    });
  } catch (error: unknown) {
    console.error("Accessory import API error:", error);
    return res.status(500).json({
      message: "Sunucu hatasi",
      error: error instanceof Error ? error.message : "Bilinmeyen hata",
    });
  }
}
