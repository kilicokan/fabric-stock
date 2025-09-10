import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../../../lib/prisma"; // prisma client'i import et (lib/prisma.ts içinde tanımlanmalı)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email: email }, // email alanı unique olmalı
    });

    if (!user) {
      return res.status(401).json({ message: "Kullanıcı bulunamadı" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: "Şifre hatalı" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: "ADMIN" },
      process.env.JWT_SECRET as string,
      { expiresIn: "1d" }
    );

    return res.status(200).json({
      token,
      user: { id: user.id, email: user.email, role: "ADMIN" },
    });
  } catch (error) {
    return res.status(500).json({ message: "Sunucu hatası" });
  }
}
