import { NextApiRequest, NextApiResponse } from "next";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "@/lib/runtime-config";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ valid: false, message: "Token yok" });

  try {
    jwt.verify(token, getJwtSecret());
    return res.status(200).json({ valid: true });
  } catch {
    return res.status(403).json({ valid: false, message: "Token gecersiz" });
  }
}
