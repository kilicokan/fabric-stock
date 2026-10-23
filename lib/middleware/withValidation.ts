import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

type SchemaMap = Record<string, z.ZodSchema>;

export function withValidation(schemas: SchemaMap) {
  return function (handler: (req: NextApiRequest, res: NextApiResponse) => Promise<unknown> | unknown) {
    return async (req: NextApiRequest, res: NextApiResponse) => {
      const schema = schemas[req.method];
      if (!schema) {
        return handler(req, res);
      }

      try {
        req.body = schema.parse(req.body);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            error: "Validation failed",
            details: error.flatten().fieldErrors,
          });
        }
        return res.status(400).json({ error: "Invalid request body" });
      }

      return handler(req, res);
    };
  };
}
