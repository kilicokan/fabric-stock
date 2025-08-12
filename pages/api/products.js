export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      // Örnek veri (gerçekte veritabanından çekilecek)
      const products = [
        { id: 1, modelNo: 'M001', name: 'Kumaş Model 1' },
        { id: 2, modelNo: 'M002', name: 'Kumaş Model 2' },
      ];
      res.status(200).json(products);
    } catch (error) {
      res.status(500).json({ error: 'Ürünler yüklenemedi' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}