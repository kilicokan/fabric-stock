import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

interface ImportFabric {
  code?: string;
  name: string;
  property?: string;
  width?: number;
  length?: number;
  depot?: string;
  unit?: string;
  stockQuantity: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Yalnızca POST metodu destekleniyor.' });
    }

    const { fabrics } = req.body;

    if (!Array.isArray(fabrics) || fabrics.length === 0) {
      return res.status(400).json({ message: 'Geçerli kumaş listesi gerekli.' });
    }

    const errors: string[] = [];
    const successfulImports: any[] = [];
    const duplicateNames: string[] = [];

    // Validate and prepare fabrics for import
    for (let i = 0; i < fabrics.length; i++) {
      const fabric = fabrics[i];
      const rowNumber = i + 1;

      // Required field validation
      if (!fabric.name || typeof fabric.name !== 'string') {
        errors.push(`Satır ${rowNumber}: Kumaş adı zorunludur.`);
        continue;
      }

      // Check for duplicate name in existing database
      const existingFabric = await prisma.fabric.findFirst({
        where: { name: fabric.name.trim() }
      });

      if (existingFabric) {
        duplicateNames.push(fabric.name.trim());
        continue;
      }

      const importFabric: ImportFabric = {
        code: fabric.code ? fabric.code.trim() : null,
        name: fabric.name.trim(),
        property: fabric.property ? fabric.property.trim() : null,
        width: fabric.width ? parseFloat(fabric.width) : null,
        length: fabric.length ? parseFloat(fabric.length) : null,
        depot: fabric.depot ? fabric.depot.trim() : null,
        unit: fabric.unit ? fabric.unit.trim() : null,
        stockQuantity: fabric.stockQuantity ? parseFloat(fabric.stockQuantity) : 0,
      };

      try {
        const newFabric = await prisma.fabric.create({
          data: importFabric,
        });
        successfulImports.push(newFabric);
      } catch (err: any) {
        errors.push(`Satır ${rowNumber}: Kumaş eklenirken hata: ${err.message}`);
      }
    }

    const result = {
      success: successfulImports.length,
      errorCount: errors.length,
      duplicates: duplicateNames.length,
      message: `${successfulImports.length} kumaş başarıyla içe aktarıldı. ${errors.length} hata, ${duplicateNames.length} tekrar eden kumaş adı.`,
      importedFabrics: successfulImports,
      importErrors: errors,
      duplicateNames: duplicateNames,
    };

    return res.status(200).json(result);

  } catch (err: any) {
    console.error('Import API Error:', err);
    return res.status(500).json({ message: 'Sunucu hatası', error: err.message });
  } finally {
    await prisma.$disconnect();
  }
}
