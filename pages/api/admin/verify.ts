import { NextApiRequest, NextApiResponse } from "next";
import jwt from "jsonwebtoken";

const SECRET_KEY = process.env.JWT_SECRET || "supersecretkey";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.headers.authorization?.split(" ")[1]; // "Bearer token"
  if (!token) return res.status(401).json({ valid: false, message: "Token yok" });

  try {
    jwt.verify(token, SECRET_KEY);
    return res.status(200).json({ valid: true });
  } catch (err) {
    return res.status(403).json({ valid: false, message: "Token geçersiz" });
  }
}
