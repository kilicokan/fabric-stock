import type { NextApiResponse } from "next";

const DEV_FALLBACK_JWT_SECRET = "dev-insecure-secret";

export const isProduction = process.env.NODE_ENV === "production";

export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) return secret;

  if (isProduction) {
    throw new Error("JWT_SECRET is not configured");
  }

  return DEV_FALLBACK_JWT_SECRET;
};

export const ensureDebugEndpointEnabled = (res: NextApiResponse): boolean => {
  const debugEnabled = process.env.ENABLE_DEBUG_ENDPOINTS === "true";
  if (isProduction && !debugEnabled) {
    res.status(404).json({ message: "Not found" });
    return false;
  }

  return true;
};
