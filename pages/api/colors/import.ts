import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import * as XLSX from 'xlsx';

interface ImportColor {
  name: string;
}

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
    const successfulImports: any[] = [];
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
      };

      try {
        const newColor = await prisma.color.create({
          data: importColor,
        });
        successfulImports.push(newColor);
      } catch (err: any) {
        errors.push(`Satır ${rowNumber}: Renk eklenirken hata: ${err.message}`);
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
