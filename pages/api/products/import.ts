import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from "@/lib/prisma";
import * as XLSX from 'xlsx';


interface ImportProduct {
  modelNo: string;
  name: string;
  materialTypeId?: number;
  fabricId?: number;
  groupId?: number;
  taxRateId?: number;
  description?: string;
  image?: string;
}

const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  return String(err);
};

const toTrimmedString = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return '';
};

const toOptionalPositiveInt = (value: unknown): number | null => {
  const text = toTrimmedString(value);
  if (!text) return null;
  const parsed = Number(text);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Yalnizca POST metodu destekleniyor.' });
    }

    const { products } = req.body as { products?: unknown[] };

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: 'Gecerli urun listesi gerekli.' });
    }

    const errors: string[] = [];
    const successfulImports: unknown[] = [];
    const duplicateModelNos: string[] = [];

    for (let i = 0; i < products.length; i++) {
      const rowNumber = i + 1;
      const row = (products[i] ?? {}) as Record<string, unknown>;

      try {
        const modelNo = toTrimmedString(row.modelNo);
        const name = toTrimmedString(row.name);

        if (!modelNo) {
          errors.push(`Satir ${rowNumber}: Model No zorunludur.`);
          continue;
        }

        if (!name) {
          errors.push(`Satir ${rowNumber}: Urun adi zorunludur.`);
          continue;
        }

        const existingProduct = await prisma.product.findUnique({
          where: { modelNo },
        });

        if (existingProduct) {
          duplicateModelNos.push(modelNo);
          continue;
        }

        const importProduct: ImportProduct = {
          modelNo,
          name,
        };

        const description = toTrimmedString(row.description);
        const image = toTrimmedString(row.image);

        if (description) importProduct.description = description;
        if (image) importProduct.image = image;

        const materialTypeRaw = toTrimmedString(row.materialTypeId);
        if (materialTypeRaw) {
          const materialTypeId = toOptionalPositiveInt(row.materialTypeId);
          if (!materialTypeId) {
            errors.push(`Satir ${rowNumber}: Gecersiz malzeme turu ID: ${materialTypeRaw}`);
            continue;
          }

          const materialType = await prisma.materialType.findUnique({
            where: { id: materialTypeId },
          });

          if (!materialType) {
            errors.push(`Satir ${rowNumber}: Gecersiz malzeme turu ID: ${materialTypeRaw}`);
            continue;
          }

          importProduct.materialTypeId = materialTypeId;
        }

        const fabricRaw = toTrimmedString(row.fabricId);
        if (fabricRaw) {
          const fabricId = toOptionalPositiveInt(row.fabricId);
          if (!fabricId) {
            errors.push(`Satir ${rowNumber}: Gecersiz kumas ID: ${fabricRaw}`);
            continue;
          }

          const fabric = await prisma.fabric.findUnique({
            where: { id: fabricId },
          });

          if (!fabric) {
            errors.push(`Satir ${rowNumber}: Gecersiz kumas ID: ${fabricRaw}`);
            continue;
          }

          importProduct.fabricId = fabricId;
        }

        const groupRaw = toTrimmedString(row.groupId);
        if (groupRaw) {
          const groupId = toOptionalPositiveInt(row.groupId);
          if (!groupId) {
            errors.push(`Satir ${rowNumber}: Gecersiz grup ID: ${groupRaw}`);
            continue;
          }

          const group = await prisma.group.findUnique({
            where: { id: groupId },
          });

          if (!group) {
            errors.push(`Satir ${rowNumber}: Gecersiz grup ID: ${groupRaw}`);
            continue;
          }

          importProduct.groupId = groupId;
        }

        const taxRateRaw = toTrimmedString(row.taxRateId);
        if (taxRateRaw) {
          const taxRateId = toOptionalPositiveInt(row.taxRateId);
          if (!taxRateId) {
            errors.push(`Satir ${rowNumber}: Gecersiz vergi orani ID: ${taxRateRaw}`);
            continue;
          }

          const taxRate = await prisma.taxRate.findUnique({
            where: { id: taxRateId },
          });

          if (!taxRate) {
            errors.push(`Satir ${rowNumber}: Gecersiz vergi orani ID: ${taxRateRaw}`);
            continue;
          }

          importProduct.taxRateId = taxRateId;
        }

        try {
          const newProduct = await prisma.product.create({
            data: importProduct,
            include: {
              materialType: true,
              group: true,
              taxRate: true,
            },
          });
          successfulImports.push(newProduct);
        } catch (err: unknown) {
          errors.push(`Satir ${rowNumber}: Urun eklenirken hata: ${getErrorMessage(err)}`);
        }
      } catch (err: unknown) {
        errors.push(`Satir ${rowNumber}: Isleme hatasi: ${getErrorMessage(err)}`);
      }
    }

    const result = {
      success: successfulImports.length,
      errorCount: errors.length,
      duplicates: duplicateModelNos.length,
      message: `${successfulImports.length} urun basariyla ice aktarildi. ${errors.length} hata, ${duplicateModelNos.length} tekrar eden model no.`,
      importedProducts: successfulImports,
      importErrors: errors,
      duplicateModelNos,
    };

    return res.status(200).json(result);
  } catch (err: unknown) {
    console.error('Import API Error:', err);
    return res.status(500).json({ message: 'Sunucu hatasi', error: getErrorMessage(err) });
  }
}

export function parseCSV(csvContent: string): Record<string, string>[] {
  const lines = csvContent.split('\n').filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
  const rows = lines.slice(1);

  return rows.map((row) => {
    const values = row.split(',').map((v) => v.trim().replace(/"/g, ''));
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    return obj;
  });
}

export function parseExcel(buffer: ArrayBuffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];
}


