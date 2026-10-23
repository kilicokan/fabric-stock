import { NextApiRequest, NextApiResponse } from 'next';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) store.delete(key);
  }
}, 60_000);

cleanupInterval.unref?.();

interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  keyFn?: (req: NextApiRequest) => string;
}

function getIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

export function rateLimit(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 60;
  const keyFn = options.keyFn ?? ((req) => getIp(req));

  return function checkRateLimit(
    req: NextApiRequest,
    res: NextApiResponse
  ): boolean {
    const key = keyFn(req);
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || entry.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(max - 1));
      return true;
    }

    entry.count += 1;
    const remaining = Math.max(0, max - entry.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      res.status(429).json({ error: 'Çok fazla istek. Lütfen bir süre bekleyin.', code: 'RATE_LIMITED' });
      return false;
    }

    return true;
  };
}

export const defaultRateLimit = rateLimit({ windowMs: 60_000, max: 60 });
export const authRateLimit = rateLimit({ windowMs: 15 * 60_000, max: 10 });
export const strictRateLimit = rateLimit({ windowMs: 60_000, max: 20 });

export function withRateLimit(
  handler: (req: NextApiRequest, res: NextApiResponse) => unknown | Promise<unknown>,
  limiter = defaultRateLimit
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method === 'OPTIONS') return handler(req, res);
    const allowed = limiter(req, res);
    if (!allowed) return;
    return handler(req, res);
  };
}
