import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import { requireApiAuth } from '@/lib/api-auth';
import { withErrorHandler } from '@/lib/middleware/withErrorHandler';

interface ImportFabric {
  code?: string;
  name: string;
  property?: string;
  width?: number;
  length?: number;
  depot?: string;
  warehouseId?: number | null;
  unit?: string;
  stockQuantity: number;
}

const getErrorCode = (error: unknown): string => {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code?: unknown }).code || '');
  }
  return '';
};

const isWarehouseCompatibilityError = (error: unknown): boolean => {
  const code = getErrorCode(error);
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    code === 'P2022' ||
    code === 'P2021' ||
    message.includes('unknown argument `warehouseid`') ||
    message.includes('cannot read properties of undefined') ||
    message.includes('does not exist')
  );
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiAuth(req, res, {
    requireLicense: true,
    feature: 'stock',
  });
  if (!auth) return;

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Yalnizca POST metodu destekleniyor.' });
    }

    const { fabrics } = req.body;

    if (!Array.isArray(fabrics) || fabrics.length === 0) {
      return res.status(400).json({ message: 'Gecerli kumas listesi gerekli.' });
    }

    const errors: string[] = [];
    const successfulImports: Array<Record<string, unknown>> = [];
    const duplicateNames: string[] = [];

    const warehouseByCode = new Map<string, { id: number; code: string }>();
    const warehouseByName = new Map<string, { id: number; code: string }>();

    try {
      const warehouseDelegate = (prisma as unknown as {
        warehouse?: {
          findMany: (args: { select: { id: true; code: true; name: true } }) => Promise<
            Array<{ id: number; code: string; name: string }>
          >;
        };
      }).warehouse;

      if (warehouseDelegate && typeof warehouseDelegate === 'object') {
        const warehouses = await warehouseDelegate.findMany({
          select: { id: true, code: true, name: true },
        });

        warehouses.forEach((warehouse) => {
          warehouseByCode.set(warehouse.code.trim().toUpperCase(), {
            id: warehouse.id,
            code: warehouse.code,
          });
          warehouseByName.set(warehouse.name.trim().toLocaleLowerCase('tr-TR'), {
            id: warehouse.id,
            code: warehouse.code,
          });
        });
      }
    } catch {
      // Legacy mode: warehouse model not available
    }

    for (let i = 0; i < fabrics.length; i++) {
      const fabric = fabrics[i] as {
        code?: string;
        name?: string;
        property?: string;
        width?: string | number;
        length?: string | number;
        depot?: string;
        unit?: string;
        stockQuantity?: string | number;
      };
      const rowNumber = i + 1;

      if (!fabric.name || typeof fabric.name !== 'string') {
        errors.push(`Satir ${rowNumber}: Kumas adi zorunludur.`);
        continue;
      }

      const normalizedName = fabric.name.trim();

      let existingFabric: { id: number } | null = null;
      try {
        existingFabric = await prisma.fabric.findFirst({
          where: { name: normalizedName },
          select: { id: true },
        });
      } catch (findError) {
        if (!isWarehouseCompatibilityError(findError)) {
          throw findError;
        }
        existingFabric = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
          `
            SELECT "id"
            FROM "public"."Fabric"
            WHERE "name" = $1
            LIMIT 1
          `,
          normalizedName
        ).then((rows) => rows[0] || null);
      }

      if (existingFabric) {
        duplicateNames.push(normalizedName);
        continue;
      }

      const normalizedDepot = fabric.depot ? String(fabric.depot).trim() : '';
      const matchedWarehouse =
        (normalizedDepot ? warehouseByCode.get(normalizedDepot.toUpperCase()) : undefined) ||
        (normalizedDepot ? warehouseByName.get(normalizedDepot.toLocaleLowerCase('tr-TR')) : undefined);

      const importFabric: ImportFabric = {
        code: fabric.code ? String(fabric.code).trim() : null,
        name: normalizedName,
        property: fabric.property ? String(fabric.property).trim() : null,
        width: fabric.width ? parseFloat(String(fabric.width)) : null,
        length: fabric.length ? parseFloat(String(fabric.length)) : null,
        depot: matchedWarehouse ? matchedWarehouse.code : normalizedDepot || null,
        warehouseId: matchedWarehouse ? matchedWarehouse.id : null,
        unit: fabric.unit ? String(fabric.unit).trim() : null,
        stockQuantity: fabric.stockQuantity ? parseFloat(String(fabric.stockQuantity)) : 0,
      };

      try {
        let newFabric;
        const safeSelect = {
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
        try {
          newFabric = await prisma.fabric.create({
            data:
              importFabric.warehouseId === null
                ? {
                    code: importFabric.code,
                    name: importFabric.name,
                    property: importFabric.property,
                    width: importFabric.width,
                    length: importFabric.length,
                    depot: importFabric.depot,
                    unit: importFabric.unit,
                    stockQuantity: importFabric.stockQuantity,
                  }
                : importFabric,
            select: safeSelect,
          });
        } catch (createError) {
          if (!isWarehouseCompatibilityError(createError)) {
            throw createError;
          }
          newFabric = await prisma.fabric.create({
            data: {
              code: importFabric.code,
              name: importFabric.name,
              property: importFabric.property,
              width: importFabric.width,
              length: importFabric.length,
              depot: importFabric.depot,
              unit: importFabric.unit,
              stockQuantity: importFabric.stockQuantity,
            },
            select: safeSelect,
          });
        }
        successfulImports.push(newFabric as unknown as Record<string, unknown>);
      } catch (err: unknown) {
        errors.push(
          `Satir ${rowNumber}: Kumas eklenirken hata: ${
            err instanceof Error ? err.message : 'Bilinmeyen hata'
          }`
        );
      }
    }

    return res.status(200).json({
      success: successfulImports.length,
      errorCount: errors.length,
      duplicates: duplicateNames.length,
      message: `${successfulImports.length} kumas basariyla ice aktarildi. ${errors.length} hata, ${duplicateNames.length} tekrar eden kumas adi.`,
      importedFabrics: successfulImports,
      importErrors: errors,
      duplicateNames,
    });
  } catch (err: unknown) {
    console.error('Import API Error:', err);
    return res.status(500).json({
      message: 'Sunucu hatasi',
      error: err instanceof Error ? err.message : 'Bilinmeyen hata',
    });
  }
}

export default withErrorHandler(handler);
