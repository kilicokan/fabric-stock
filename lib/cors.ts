import { NextApiRequest, NextApiResponse } from 'next';
import { withRateLimit, authRateLimit, defaultRateLimit } from './rate-limit';

type Handler = (req: NextApiRequest, res: NextApiResponse) => unknown | Promise<unknown>;

const ALLOWED_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8000',
  'http://127.0.0.1:8081',
];

if (process.env.CORS_ALLOWED_ORIGIN) {
  ALLOWED_ORIGINS.push(process.env.CORS_ALLOWED_ORIGIN);
}

function applyCorsHeaders(req: NextApiRequest, res: NextApiResponse) {
  const origin = req.headers.origin;

  if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (ALLOWED_ORIGINS.includes(origin) || isLocalDevelopmentOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'null');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-API-Key'
  );
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, X-RateLimit-Limit, X-RateLimit-Remaining');
}

function isLocalDevelopmentOrigin(origin: string): boolean {
  if (process.env.NODE_ENV === 'production') return false;

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  if (url.protocol !== 'http:' || !['8081', '8082', '19006'].includes(url.port)) {
    return false;
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname === '::1') return true;

  const octets = hostname.split('.').map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }

  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

export function withCors(handler: Handler): Handler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    applyCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    return handler(req, res);
  };
}

export function withCorsAndRateLimit(handler: Handler, limiter = defaultRateLimit): Handler {
  return withCors(withRateLimit(handler, limiter));
}

export function withAuthRateLimit(handler: Handler): Handler {
  return withCors(withRateLimit(handler, authRateLimit));
}
