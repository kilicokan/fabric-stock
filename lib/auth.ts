import jwt from 'jsonwebtoken';
import { getJwtSecret } from './runtime-config';

// ============================================
// NEW: Robust token verification (case-insensitive)
// ============================================
export interface TokenPayload {
  id: number;
  email: string;
  role: string;
}

/**
 * Extract and verify JWT token from Authorization header
 * Handles: "Bearer TOKEN", "bearer TOKEN" (case-insensitive)
 * Returns decoded token or null if invalid
 */
export function verifyToken(
  authHeader: string | null | undefined
): TokenPayload | null {
  const headerToken = extractBearerToken(authHeader);
  if (headerToken) {
    return verifyRawToken(headerToken);
  }
  return null;
}

export function verifyTokenFromCookie(
  cookieHeader: string | null | undefined
): TokenPayload | null {
  if (!cookieHeader) return null;
  const raw = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('token='));
  if (!raw) return null;
  const token = raw.slice('token='.length);
  if (!token) return null;
  return verifyRawToken(token);
}

function verifyRawToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(
      token,
      getJwtSecret()
    ) as TokenPayload;
    return decoded;
  } catch (error) {
    console.error('🔐 Token verification failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      token: token.substring(0, 20) + '...',
    });
    return null;
  }
}

function extractBearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}
