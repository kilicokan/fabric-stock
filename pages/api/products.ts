import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Product {
  id: number;
  modelNo: string;
  name: string;
  materialTypeId?: number;
  groupId?: number;
  taxRateId?: number;
  description?: string;
  image?: string;
  createdAt: Date;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'POST') {
      const { modelNo, name, materialTypeId, groupId, taxRateId, description, image } = req.body;

      // Validasyon
      if (!modelNo || !name) {
        return res.status(400).json({ message: 'Model No ve Ürün Adı zorunludur.' });
      }

      // Benzersizlik kontrolü
      const existingProduct = await prisma.product.findUnique({ where: { modelNo } });
      if (existingProduct) {
        return res.status(400).json({ message: 'Bu Model No zaten mevcut.' });
      }

      const newProduct = await prisma.product.create({
        data: {
          modelNo,
          name,
          materialTypeId: materialTypeId ? parseInt(materialTypeId) : null,
          groupId: groupId ? parseInt(groupId) : null,
          taxRateId: taxRateId ? parseInt(taxRateId) : null,
          description,
          image,
        },
      });

      console.log('New product added:', newProduct);
      return res.status(201).json({ message: 'Ürün başarıyla eklendi', product: newProduct });
    }

    if (req.method === 'GET') {
      if (req.query.checkCode) {
        const code = req.query.checkCode as string;
        const existingProduct = await prisma.product.findUnique({ where: { modelNo: code } });
        return res.status(200).json({ isAvailable: !existingProduct });
      }

      const products = await prisma.product.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          materialType: true,
          group: true,
          taxRate: true,
        },
      });
      return res.status(200).json(products);
    }

    if (req.method === 'PUT') {
      const { id, modelNo, name, materialTypeId, groupId, taxRateId, description, image } = req.body;
      const productId = parseInt(id);

      if (!productId || !modelNo || !name) {
        return res.status(400).json({ message: 'ID, Model No ve Ürün Adı zorunludur.' });
      }

      const existingProduct = await prisma.product.findUnique({ where: { id: productId } });
      if (!existingProduct) {
        return res.status(404).json({ message: 'Ürün bulunamadı.' });
      }

      // Model No benzersizlik kontrolü
      const modelNoConflict = await prisma.product.findFirst({
        where: { modelNo, id: { not: productId } },
      });
      if (modelNoConflict) {
        return res.status(400).json({ message: 'Bu Model No başka bir ürün tarafından kullanılıyor.' });
      }

      const updatedProduct = await prisma.product.update({
        where: { id: productId },
        data: {
          modelNo,
          name,
          materialTypeId: materialTypeId ? parseInt(materialTypeId) : null,
          groupId: groupId ? parseInt(groupId) : null,
          taxRateId: taxRateId ? parseInt(taxRateId) : null,
          description,
          image,
        },
      });

      console.log('Product updated:', updatedProduct);
      return res.status(200).json({ message: 'Ürün başarıyla güncellendi', product: updatedProduct });
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id as string);

      if (!id) {
        return res.status(400).json({ message: 'Ürün ID zorunludur.' });
      }

      const existingProduct = await prisma.product.findUnique({ where: { id } });
      if (!existingProduct) {
        return res.status(404).json({ message: 'Ürün bulunamadı.' });
      }

      await prisma.product.delete({ where: { id } });
      console.log('Product deleted:', id);
      return res.status(200).json({ message: 'Ürün başarıyla silindi' });
    }

    return res.status(405).json({ message: 'Yalnızca GET, POST, PUT ve DELETE metodları destekleniyor.' });
  } catch (err: any) {
    console.error('API Error:', err);
    return res.status(500).json({ message: 'Sunucu hatası', error: err.message });
  } finally {
    await prisma.$disconnect();
  }
}