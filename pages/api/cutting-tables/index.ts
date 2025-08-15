// pages/api/cutting-tables/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import dbPool from '@/utils/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Yöntem desteklenmiyor. Sadece GET isteği kabul edilir.' });
  }

  try {
    const { rows } = await dbPool.query('SELECT * FROM cutting_tables WHERE is_active = true');
    res.status(200).json({
      success: true,
      data: rows,
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
}