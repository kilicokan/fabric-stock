import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Örnek kullanıcı veritabanı (gerçek uygulamada veritabanı kullanın)
const users = [
  {
    id: 1,
    username: 'admin',
    password: '$2a$10$N9qo8uLOickgx2ZMRZoMy.MrUv9gH1tYr6dD6H3J0Vx7zU1qQJQ/W', // "admin123" şifresinin hashlenmiş hali
    role: 'admin'
  }
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, password } = req.body;

  const user = users.find(u => u.username === username);
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  
  if (!isPasswordValid) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // JWT token oluştur
  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '1h' }
  );

  res.status(200).json({ token });
}