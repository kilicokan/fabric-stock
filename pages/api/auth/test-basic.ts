import type { NextApiRequest, NextApiResponse } from "next";
import { ensureDebugEndpointEnabled } from "@/lib/runtime-config";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!ensureDebugEndpointEnabled(res)) return;

  try {
    console.log('🔍 Test API çalışıyor');
    
    // Basit test
    return res.status(200).json({ 
      message: "Test API çalışıyor!",
      method: req.method,
      body: req.body,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('💥 Test API hatası:', error);
    return res.status(500).json({ 
      message: "Test API hatası", 
      error: error.message,
      stack: error.stack
    });
  }
}
