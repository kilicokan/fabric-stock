import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const path = req.url?.split('/').pop();
    if (path === 'material-types') {
      return res.status(200).json(['Kumaş', 'Deri']);
    }
    if (path === 'groups') {
      return res.status(200).json(['Dokuma Kumaş', 'Örme Kumaş']);
    }
    if (path === 'tax-rates') {
      return res.status(200).json(['%0', '%1', '%8', '%20']);
    }
    return res.status(404).json({ message: 'Endpoint bulunamadı' });
  }
  return res.status(405).json({ message: 'Yalnızca GET metodları destekleniyor.' });
}