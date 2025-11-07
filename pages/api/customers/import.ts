import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

interface ImportCustomer {
  name: string;
  phone?: string;
  email?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Yalnızca POST metodu destekleniyor.' });
    }

    const { customers } = req.body;

    if (!Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({ message: 'Geçerli müşteri listesi gerekli.' });
    }

    const errors: string[] = [];
    const successfulImports: any[] = [];
    const duplicateNames: string[] = [];

    // Validate and prepare customers for import
    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i];
      const rowNumber = i + 1;

      // Required field validation
      if (!customer.name || typeof customer.name !== 'string') {
        errors.push(`Satır ${rowNumber}: Müşteri adı zorunludur.`);
        continue;
      }

      // Check for duplicate name in existing database
      const existingCustomer = await prisma.customer.findFirst({
        where: { name: customer.name.trim() }
      });

      if (existingCustomer) {
        duplicateNames.push(customer.name.trim());
        continue;
      }

      const importCustomer: ImportCustomer = {
        name: customer.name.trim(),
        phone: customer.phone ? customer.phone.trim() : null,
        email: customer.email ? customer.email.trim() : null,
      };

      try {
        const newCustomer = await prisma.customer.create({
          data: importCustomer,
        });
        successfulImports.push(newCustomer);
      } catch (err: any) {
        errors.push(`Satır ${rowNumber}: Müşteri eklenirken hata: ${err.message}`);
      }
    }

    const result = {
      success: successfulImports.length,
      errorCount: errors.length,
      duplicates: duplicateNames.length,
      message: `${successfulImports.length} müşteri başarıyla içe aktarıldı. ${errors.length} hata, ${duplicateNames.length} tekrar eden müşteri adı.`,
      importedCustomers: successfulImports,
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
