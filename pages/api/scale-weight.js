let latestWeight = null;

export default function handler(req, res) {
  if (req.method === 'POST') {
    latestWeight = req.body.weight;
    return res.status(200).json({ message: 'Ağırlık kaydedildi', weight: latestWeight });
  }

  if (req.method === 'GET') {
    if (latestWeight === null) {
      return res.status(404).json({ message: 'Ağırlık bilgisi yok' });
    }
    return res.status(200).json({ weight: latestWeight });
  }

  res.status(405).json({ message: 'Method not allowed' });
}
