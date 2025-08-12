import axios from 'axios';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      // Gerçek API URL'nizi buraya yazın
      const response = await axios.get('https://external-api.com/products');
      res.status(200).json(response.data);
    } catch (error) {
      res.status(500).json({ error: 'Dış sistemden ürünler alınamadı' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}