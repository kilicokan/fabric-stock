import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Geçici veritabanı (gerçek projede veritabanı kullanın)
const adminUser = {
  username: 'admin',
  password: '$2b$12$LI3VQ.asnybESN5lHrlzZu3U.adtDfdzv5hNSBW.N05ZZZ.iQ4xFW', // "admin123"
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, password } = req.body;

  if (username !== adminUser.username) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const isPasswordValid = await bcrypt.compare(password, adminUser.password);
  
  if (!isPasswordValid) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { username: adminUser.username, role: 'admin' },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '1h' }
  );

  res.status(200).json({ success: true, token });
}