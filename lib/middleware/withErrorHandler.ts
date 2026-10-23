import type { NextApiRequest, NextApiResponse } from "next";

type Handler = (req: NextApiRequest, res: NextApiResponse) => Promise<unknown> | unknown;

export function withErrorHandler(handler: Handler): Handler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      return await handler(req, res);
    } catch (error) {
      console.error("[api-error]", req.method, req.url, error);

      const message = error instanceof Error ? error.message : "Internal server error";

      const prismaKnown =
        typeof error === "object" &&
        error &&
        "code" in error &&
        String((error as { code?: unknown }).code).startsWith("P");

      if (prismaKnown) {
        return res.status(400).json({ error: message });
      }

      return res.status(500).json({
        error: process.env.NODE_ENV === "development" ? message : "Internal server error",
      });
    }
  };
}
