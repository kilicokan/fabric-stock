import pool from '@/utils/db';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const { rows } = await pool.query(`
        SELECT id, name, code 
        FROM customers
        WHERE is_active = true
        ORDER BY name
      `);
      res.status(200).json(rows);
    } catch (error) {
      console.error('PostgreSQL error:', error);
      res.status(500).json({ 
        message: 'Müşteriler alınamadı',
        error: error.message 
      });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ message: 'Method not allowed' });
  }
}