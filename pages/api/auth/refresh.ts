import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { withAuthRateLimit } from '@/lib/cors';
import { verifyTokenFromCookie } from '@/lib/auth';

type AuthTokenPayload = {
  id: number;
  email: string;
  role: string;
};

const isAuthTokenPayload = (value: unknown): value is AuthTokenPayload => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'number' &&
    typeof candidate.email === 'string' &&
    typeof candidate.role === 'string'
  );
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = verifyTokenFromCookie(req.headers.cookie);

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      console.error('JWT_SECRET not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    if (!isAuthTokenPayload(token)) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    const newToken = jwt.sign(
      {
        id: token.id,
        email: token.email,
        role: token.role
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const isProduction = process.env.NODE_ENV === 'production';
    res.setHeader('Set-Cookie', [
      `token=${newToken}; Path=/; HttpOnly; ${isProduction ? 'Secure;' : ''} SameSite=Strict; Max-Age=86400`,
      `authToken=${newToken}; Path=/; HttpOnly; ${isProduction ? 'Secure;' : ''} SameSite=Strict; Max-Age=86400`,
    ].join(', '));

    return res.status(200).json({
      token: newToken,
      expiresIn: 86400
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default withAuthRateLimit(handler);
