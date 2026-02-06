import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../../../lib/prisma"; // prisma client'i import et (lib/prisma.ts içinde tanımlanmalı)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS başlıklarını ayarla
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // OPTIONS request'ini handle et
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { email, password } = req.body;

  try {
    console.log('🔍 Login denemesi (gerçek API):', { email, password: password ? '***' : 'yok' });
    
    const user = await prisma.user.findUnique({
      where: { email: email }, // email alanı unique olmalı
    });

    console.log('👤 Bulunan kullanıcı (gerçek API):', user ? {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    } : 'Kullanıcı bulunamadı');

    if (!user) {
      console.log('❌ Kullanıcı bulunamadı (gerçek API)');
      return res.status(401).json({ message: "Kullanıcı bulunamadı" });
    }

    console.log('🔐 Şifre kontrol ediliyor (gerçek API)...');
    const valid = await bcrypt.compare(password, user.password);
    console.log('🔐 Şifre sonucu (gerçek API):', valid);

    if (!valid) {
      console.log('❌ Şifre hatalı (gerçek API)');
      return res.status(401).json({ message: "Şifre hatalı" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'default-secret-key',
      { expiresIn: "1d" }
    );

    return res.status(200).json({
      token,
      user: { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        name: user.name,
        stockAccess: user.stockAccess,
        fasonAccess: user.fasonAccess
      },
    });
  } catch (error) {
    console.error('💥 Login hatası:', error);
    return res.status(500).json({ message: "Sunucu hatası", error: error.message });
  }
}
