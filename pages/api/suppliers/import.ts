import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

interface ImportSupplier {
  name: string;
  phone?: string;
  email?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Yalnızca POST metodu destekleniyor.' });
    }

    const { suppliers } = req.body;

    if (!Array.isArray(suppliers) || suppliers.length === 0) {
      return res.status(400).json({ message: 'Geçerli tedarikçi listesi gerekli.' });
    }

    const errors: string[] = [];
    const successfulImports: any[] = [];
    const duplicateNames: string[] = [];

    // Validate and prepare suppliers for import
    for (let i = 0; i < suppliers.length; i++) {
      const supplier = suppliers[i];
      const rowNumber = i + 1;

      // Required field validation
      if (!supplier.name || typeof supplier.name !== 'string') {
        errors.push(`Satır ${rowNumber}: Tedarikçi adı zorunludur.`);
        continue;
      }

      // Check for duplicate name in existing database
      const existingSupplier = await prisma.supplier.findFirst({
        where: { name: supplier.name.trim() }
      });

      if (existingSupplier) {
        duplicateNames.push(supplier.name.trim());
        continue;
      }

      const importSupplier: ImportSupplier = {
        name: supplier.name.trim(),
        phone: supplier.phone ? supplier.phone.trim() : null,
        email: supplier.email ? supplier.email.trim() : null,
      };

      try {
        const newSupplier = await prisma.supplier.create({
          data: importSupplier,
        });
        successfulImports.push(newSupplier);
      } catch (err: any) {
        errors.push(`Satır ${rowNumber}: Tedarikçi eklenirken hata: ${err.message}`);
      }
    }

    const result = {
      success: successfulImports.length,
      errorCount: errors.length,
      duplicates: duplicateNames.length,
      message: `${successfulImports.length} tedarikçi başarıyla içe aktarıldı. ${errors.length} hata, ${duplicateNames.length} tekrar eden tedarikçi adı.`,
      importedSuppliers: successfulImports,
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
