import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

interface ImportProduct {
  modelNo: string;
  name: string;
  materialTypeId?: number;
  groupId?: number;
  taxRateId?: number;
  description?: string;
  image?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Yalnızca POST metodu destekleniyor.' });
    }

    const { products } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: 'Geçerli ürün listesi gerekli.' });
    }

    const errors: string[] = [];
    const successfulImports: any[] = [];
    const duplicateModelNos: string[] = [];

    // Validate and prepare products for import
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const rowNumber = i + 1;

      // Required field validation
      if (!product.modelNo || typeof product.modelNo !== 'string') {
        errors.push(`Satır ${rowNumber}: Model No zorunludur.`);
        continue;
      }

      if (!product.name || typeof product.name !== 'string') {
        errors.push(`Satır ${rowNumber}: Ürün adı zorunludur.`);
        continue;
      }

      // Check for duplicate modelNo in existing database
      const existingProduct = await prisma.product.findUnique({
        where: { modelNo: product.modelNo.trim() }
      });

      if (existingProduct) {
        duplicateModelNos.push(product.modelNo.trim());
        continue;
      }

      // Validate optional fields
      const importProduct: ImportProduct = {
        modelNo: product.modelNo.trim(),
        name: product.name.trim(),
        description: product.description?.trim(),
        image: product.image?.trim(),
      };

      // Validate and convert IDs
      if (product.materialTypeId) {
        const materialTypeId = parseInt(product.materialTypeId);
        if (!isNaN(materialTypeId)) {
          const materialType = await prisma.materialType.findUnique({
            where: { id: materialTypeId }
          });
          if (materialType) {
            importProduct.materialTypeId = materialTypeId;
          } else {
            errors.push(`Satır ${rowNumber}: Geçersiz malzeme türü ID: ${product.materialTypeId}`);
            continue;
          }
        }
      }

      if (product.groupId) {
        const groupId = parseInt(product.groupId);
        if (!isNaN(groupId)) {
          const group = await prisma.group.findUnique({
            where: { id: groupId }
          });
          if (group) {
            importProduct.groupId = groupId;
          } else {
            errors.push(`Satır ${rowNumber}: Geçersiz grup ID: ${product.groupId}`);
            continue;
          }
        }
      }

      if (product.taxRateId) {
        const taxRateId = parseInt(product.taxRateId);
        if (!isNaN(taxRateId)) {
          const taxRate = await prisma.taxRate.findUnique({
            where: { id: taxRateId }
          });
          if (taxRate) {
            importProduct.taxRateId = taxRateId;
          } else {
            errors.push(`Satır ${rowNumber}: Geçersiz vergi oranı ID: ${product.taxRateId}`);
            continue;
          }
        }
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
      } catch (err: any) {
        errors.push(`Satır ${rowNumber}: Ürün eklenirken hata: ${err.message}`);
      }
    }

    const result = {
      success: successfulImports.length,
      errorCount: errors.length,
      duplicates: duplicateModelNos.length,
      message: `${successfulImports.length} ürün başarıyla içe aktarıldı. ${errors.length} hata, ${duplicateModelNos.length} tekrar eden model no.`,
      importedProducts: successfulImports,
      importErrors: errors,
      duplicateModelNos: duplicateModelNos,
    };

    return res.status(200).json(result);

  } catch (err: any) {
    console.error('Import API Error:', err);
    return res.status(500).json({ message: 'Sunucu hatası', error: err.message });
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to parse CSV content
export function parseCSV(csvContent: string): any[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows = lines.slice(1);

  return rows.map(row => {
    const values = row.split(',').map(v => v.trim().replace(/"/g, ''));
    const obj: any = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    return obj;
  });
}

// Helper function to parse Excel file
export function parseExcel(buffer: ArrayBuffer): any[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet);
}
