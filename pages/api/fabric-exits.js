export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const formData = req.body;
      console.log('Alınan veri:', formData); // Test için log
      // Burada veritabanına kayıt işlemi yapılacak
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Kayıt başarısız oldu' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}