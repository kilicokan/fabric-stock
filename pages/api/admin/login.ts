import { NextApiRequest, NextApiResponse } from "next";
import jwt from "jsonwebtoken";

const SECRET_KEY = "supersecretkey"; // .env içine taşıyabilirsin

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const { username, password } = req.body;

    const ADMIN_USER = "admin";
    const ADMIN_PASS = "1234";

    if (username === ADMIN_USER && password === ADMIN_PASS) {
      // ✅ JWT token oluştur
      const token = jwt.sign({ user: username }, SECRET_KEY, { expiresIn: "2h" });
      return res.status(200).json({ success: true, token });
    } else {
      return res.status(401).json({ success: false, message: "Hatalı giriş" });
    }
  }

  res.status(405).json({ message: "Yalnızca POST isteği desteklenir" });
}
