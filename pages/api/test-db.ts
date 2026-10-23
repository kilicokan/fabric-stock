import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from '@prisma/client';
import { ensureDebugEndpointEnabled } from "@/lib/runtime-config";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!ensureDebugEndpointEnabled(res)) return;

  try {
    console.log('🔍 Veritabanı bağlantı testi başlıyor...');
    
    const prisma = new PrismaClient();
    
    console.log('📊 Kullanıcı sayısı sorgulanıyor...');
    const userCount = await prisma.user.count();
    console.log('👥 Kullanıcı sayısı:', userCount);
    
    console.log('📋 İlk kullanıcı sorgulanıyor...');
    const firstUser = await prisma.user.findFirst({
      select: { id: true, email: true, role: true, name: true }
    });
    console.log('👤 İlk kullanıcı:', firstUser);

    await prisma.$disconnect();
    
    return res.status(200).json({ 
      success: true,
      message: "Veritabanı bağlantısı başarılı!",
      userCount,
      firstUser,
      databaseUrl: process.env.DATABASE_URL ? "✅ Var" : "❌ Yok"
    });

  } catch (error: any) {
    console.error('💥 Veritabanı bağlantı hatası:', error);
    return res.status(500).json({ 
      success: false,
      message: "Veritabanı bağlantı hatası",
      error: error.message,
      code: error.code,
      stack: error.stack
    });
  }
}
