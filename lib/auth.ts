import jwt from 'jsonwebtoken';

export const authenticateToken = async (req: any, res: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token gerekli' });
    return null;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key') as any;
    return decoded;
  } catch (error) {
    console.error('Token doğrulama hatası:', error);
    res.status(401).json({ error: 'Geçersiz token' });
    return null;
  }
};
