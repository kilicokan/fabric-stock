import pool from '@/utils/db'; // Eğer tsconfig.json’da baseUrl ayarlıysa

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { startDate, endDate, fabricType, color } = req.query;
    
    let query = `
      SELECT 
        fe.entry_date,
        ft.name AS fabric_type,
        c.name AS color,
        fe.quantity_kg
      FROM fabric_entries fe
      JOIN fabric_types ft ON fe.fabric_type_id = ft.id
      JOIN colors c ON fe.color_id = c.id
      WHERE 1=1
    `;

    const params = [];

    if (startDate) {
      query += ` AND fe.entry_date >= $${params.length + 1}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND fe.entry_date <= $${params.length + 1}`;
      params.push(endDate);
    }

    if (fabricType) {
      query += ` AND ft.name = $${params.length + 1}`;
      params.push(fabricType);
    }

    if (color) {
      query += ` AND c.name = $${params.length + 1}`;
      params.push(color);
    }

    query += ' ORDER BY fe.entry_date DESC';

    const { rows } = await pool.query(query, params);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ 
      error: 'Report generation failed',
      details: error.message 
    });
  }
}