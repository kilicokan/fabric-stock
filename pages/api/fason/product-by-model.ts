import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";

interface ProductByModelResponse {
  id: number;
  modelNo: string;
  name: string;
  fabric: { width: number | null; name: string; unit: string; stockQuantity: number | null } | null;
  sewingNotes: string | null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiAuth(req, res, {
    requireLicense: true,
    feature: "stock",
  });
  if (!auth) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Yalnızca GET metodu desteklenir.' });
  }

  const { modelNo } = req.query;

  if (!modelNo || typeof modelNo !== 'string') {
    return res.status(400).json({ message: 'modelNo parametresi gereklidir.' });
  }

  try {
    const product = await prisma.product.findUnique({
      where: { modelNo },
      select: {
        id: true,
        modelNo: true,
        name: true,
        fabric: {
          select: {
            id: true,
            width: true,
            name: true,
            unit: true,
            stockQuantity: true,
          },
        },
        sewingNotes: true,
      },
    });

    if (!product) {
      return res.status(404).json({ message: 'Ürün bulunamadı.' });
    }

    const response: ProductByModelResponse = {
      id: product.id,
      modelNo: product.modelNo,
      name: product.name,
      fabric: product.fabric
        ? { width: product.fabric.width, name: product.fabric.name, unit: product.fabric.unit || '', stockQuantity: product.fabric.stockQuantity ?? null }
        : null,
      sewingNotes: product.sewingNotes,
    };

    return res.status(200).json(response);
  } catch (err: unknown) {
    console.error('API Error:', err);
    return res.status(500).json({
      message: 'Sunucu hatası',
      error: err instanceof Error ? err.message : 'Bilinmeyen hata',
    });
  }
}
