import type { NextApiRequest, NextApiResponse } from "next";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";
import { withCors } from "@/lib/cors";

interface ProductCriticalNoteInput {
  id?: string;
  side: "front" | "back";
  x: number;
  y: number;
  text: string;
  imageIndex?: number;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiAuth(req, res, {
    requireLicense: true,
    feature: "stock",
  });
  if (!auth) return;

  if (req.method !== "PATCH") {
    res.setHeader("Allow", ["PATCH"]);
    return res.status(405).json({ message: "Yalnızca PATCH metodu destekleniyor." });
  }

  const productId = Number(req.query.id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ message: "Geçerli ürün ID zorunludur." });
  }

  const criticalNotes: unknown = req.body?.criticalNotes;
  const validation = validateCriticalNotes(criticalNotes);
  if (validation.valid === false) {
    return res.status(400).json({ message: validation.message });
  }

  const notesForStorage: Prisma.InputJsonArray = validation.notes.map((note, index) => ({
    id: note.id || `note-${Date.now()}-${index}`,
    side: note.side,
    x: note.x,
    y: note.y,
    text: note.text,
    ...(note.imageIndex === undefined ? {} : { imageIndex: note.imageIndex }),
  }));

  try {
    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!existingProduct) {
      return res.status(404).json({ message: "Ürün bulunamadı." });
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: { criticalNotes: notesForStorage },
      select: {
        id: true,
        criticalNotes: true,
      },
    });
    return res.status(200).json({ product });
  } catch (error) {
    console.error("Product critical note update failed:", error);
    return res.status(500).json({ message: "Ürün notları kaydedilemedi." });
  }
}

export default withCors(handler);

function validateCriticalNotes(
  value: unknown
): { valid: true; notes: ProductCriticalNoteInput[] } | { valid: false; message: string } {
  if (!Array.isArray(value)) return { valid: false, message: "Kritik notlar bir liste olmalıdır." };
  if (value.length > 50) {
    return { valid: false, message: "Bir ürüne en fazla 50 kritik not eklenebilir." };
  }

  for (const [index, note] of value.entries()) {
    if (!note || typeof note !== "object") {
      return { valid: false, message: `${index + 1}. kritik not geçersiz.` };
    }

    const item = note as Record<string, unknown>;
    if (
      item.id !== undefined &&
      (typeof item.id !== "string" || item.id.length === 0 || item.id.length > 100)
    ) {
      return { valid: false, message: `${index + 1}. kritik notun kimliği geçersiz.` };
    }
    if (item.side !== "front" && item.side !== "back") {
      return { valid: false, message: `${index + 1}. kritik notun ön/arka bilgisi geçersiz.` };
    }
    if (typeof item.text !== "string" || item.text.trim().length === 0 || item.text.length > 500) {
      return { valid: false, message: `${index + 1}. kritik notun metni boş veya 500 karakterden uzun.` };
    }
    if (
      typeof item.x !== "number" ||
      !Number.isFinite(item.x) ||
      item.x < 0 ||
      item.x > 100
    ) {
      return { valid: false, message: `${index + 1}. kritik notun yatay konumu geçersiz.` };
    }
    if (
      typeof item.y !== "number" ||
      !Number.isFinite(item.y) ||
      item.y < 0 ||
      item.y > 100
    ) {
      return { valid: false, message: `${index + 1}. kritik notun dikey konumu geçersiz.` };
    }
    if (
      item.imageIndex !== undefined &&
      (!Number.isInteger(item.imageIndex) || Number(item.imageIndex) < 0 || Number(item.imageIndex) >= 5)
    ) {
      return { valid: false, message: `${index + 1}. kritik notun fotoğraf numarası geçersiz.` };
    }
  }

  return { valid: true, notes: value as ProductCriticalNoteInput[] };
}
