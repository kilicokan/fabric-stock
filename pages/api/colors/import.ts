import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import * as XLSX from 'xlsx';
import type { Color } from '@prisma/client';

interface ImportColor {
  name: string;
  code?: string;
  description?: string;
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown error';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Yalnızca POST metodu destekleniyor.' });
    }

    const { colors } = req.body;

    if (!Array.isArray(colors) || colors.length === 0) {
      return res.status(400).json({ message: 'Geçerli renk listesi gerekli.' });
    }

    const errors: string[] = [];
    const successfulImports: Color[] = [];
    const duplicateNames: string[] = [];

    // Validate and prepare colors for import
    for (let i = 0; i < colors.length; i++) {
      const color = colors[i];
      const rowNumber = i + 1;

      // Required field validation
      if (!color.name || typeof color.name !== 'string') {
        errors.push(`Satır ${rowNumber}: Renk adı zorunludur.`);
        continue;
      }

      // Check for duplicate name in existing database
      const existingColor = await prisma.color.findFirst({
        where: { name: color.name.trim() }
      });

      if (existingColor) {
        duplicateNames.push(color.name.trim());
        continue;
      }

      const importColor: ImportColor = {
        name: color.name.trim(),
        code: color.code?.trim() || undefined,
        description: color.description?.trim() || undefined,
      };

      try {
        const newColor = await prisma.color.create({
          data: importColor,
        });
        successfulImports.push(newColor);
      } catch (err: unknown) {
        errors.push(`Satır ${rowNumber}: Renk eklenirken hata: ${getErrorMessage(err)}`);
      }
    }

    const result = {
      success: successfulImports.length,
      errorCount: errors.length,
      duplicates: duplicateNames.length,
      message: `${successfulImports.length} renk başarıyla içe aktarıldı. ${errors.length} hata, ${duplicateNames.length} tekrar eden renk adı.`,
      importedColors: successfulImports,
      importErrors: errors,
      duplicateNames: duplicateNames,
    };

    return res.status(200).json(result);

  } catch (err: unknown) {
    console.error('Import API Error:', err);
    return res.status(500).json({ message: 'Sunucu hatası', error: getErrorMessage(err) });
  }
}

// Helper function to parse CSV content
export function parseCSV(csvContent: string): Array<Record<string, string>> {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows = lines.slice(1);

  return rows.map(row => {
    const values = row.split(',').map(v => v.trim().replace(/"/g, ''));
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    return obj;
  });
}

// Helper function to parse Excel file
export function parseExcel(buffer: ArrayBuffer): Array<Record<string, unknown>> {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
}

