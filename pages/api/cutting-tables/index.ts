// pages/api/cutting-tables/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const cuttingTables = await prisma.cuttingTable.findMany();
      res.status(200).json({
        success: true,
        data: cuttingTables,
        message: 'Veriler başarıyla alındı.'
      });
    } catch (error: any) {
      console.error('Veritabanı hatası:', {
        query: error.query || 'Sorgu mevcut değil',
        message: error.message,
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        error: 'Sunucu hatası: Veritabanı sorgusu başarısız oldu.'
      });
    }
  } else if (req.method === 'POST') {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Geçersiz istek: name alanı zorunludur ve string olmalıdır.'
      });
    }

    try {
      const newCuttingTable = await prisma.cuttingTable.create({
        data: {
          name: name.trim()
        }
      });
      res.status(201).json({
        success: true,
        data: newCuttingTable,
        message: 'Kesim masası başarıyla eklendi.'
      });
    } catch (error: any) {
      console.error('Veritabanı hatası:', {
        query: error.query || 'Sorgu mevcut değil',
        message: error.message,
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        error: 'Sunucu hatası: Kesim masası eklenemedi.'
      });
    }
  } else {
    return res.status(405).json({ error: 'Yöntem desteklenmiyor. Sadece GET ve POST isteği kabul edilir.' });
  }
}
