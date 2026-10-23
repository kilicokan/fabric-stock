import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma";
import { ensureDebugEndpointEnabled, getJwtSecret } from "@/lib/runtime-config";


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!ensureDebugEndpointEnabled(res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { email, password } = req.body;

  try {
    console.log('🔍 Login denemesi:', { email, password: password ? '***' : 'yok' });

    // 1. Kullanıcıyı bul
    console.log('👤 Kullanıcı aranıyor:', email);
    const user = await prisma.user.findUnique({
      where: { email: email }
    });

    console.log('🔍 Bulunan kullanıcı:', user ? {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      hasPassword: !!user.password
    } : 'Kullanıcı bulunamadı');

    if (!user) {
      console.log('❌ Kullanıcı bulunamadı');
      return res.status(401).json({ message: "Kullanıcı bulunamadı", debug: { email, userFound: false } });
    }

    // 2. Şifreyi kontrol et
    console.log('🔐 Şifre kontrol ediliyor...');
    const valid = await bcrypt.compare(password, user.password);
    console.log('🔐 Şifre sonucu:', valid);

    if (!valid) {
      console.log('❌ Şifre hatalı');
      return res.status(401).json({ 
        message: "Şifre hatalı", 
        debug: { 
          email, 
          userFound: true, 
          passwordMatch: false,
          providedPassword: password,
          storedPasswordLength: user.password.length
        }
      });
    }

    // 3. Token oluştur
    console.log('🎫 Token oluşturuluyor...');
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      getJwtSecret(),
      { expiresIn: "1d" }
    );

    console.log('✅ Login başarılı');
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
      debug: {
        success: true,
        userFound: true,
        passwordMatch: true
      }
    });

  } catch (error) {
    console.error('💥 Login hatası:', error);
    return res.status(500).json({ 
      message: "Sunucu hatası", 
      debug: { error: error.message }
    });
  }
}

