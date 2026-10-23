import type { NextApiRequest } from "next";

const requestsByClient = new Map<string, number[]>();

export function isAssistantRateLimited(
  req: NextApiRequest,
  bucket: string,
  limit: number
): boolean {
  const now = Date.now();
  if (requestsByClient.size > 1_000) {
    for (const [key, timestamps] of requestsByClient) {
      if (timestamps.every((timestamp) => now - timestamp >= 60_000)) {
        requestsByClient.delete(key);
      }
    }
  }

  const key = `${bucket}:${req.socket.remoteAddress || "unknown"}`;
  const recent = (requestsByClient.get(key) || []).filter((timestamp) => now - timestamp < 60_000);
  if (recent.length >= limit) {
    requestsByClient.set(key, recent);
    return true;
  }
  recent.push(now);
  requestsByClient.set(key, recent);
  return false;
}
