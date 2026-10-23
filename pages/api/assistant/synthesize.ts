import type { NextApiRequest, NextApiResponse } from "next";
import { verifyToken } from "@/lib/auth";
import { isAssistantRateLimited } from "@/lib/assistant-rate-limit";

const MAX_TEXT_LENGTH = 2_000;

function piperEndpoint(): URL {
  const configured = process.env.PIPER_URL || "http://127.0.0.1:5000/api/tts";
  const endpoint = new URL(configured);
  if (!["http:", "https:"].includes(endpoint.protocol)) {
    throw new Error("PIPER_URL yalnızca HTTP veya HTTPS olabilir.");
  }
  return endpoint;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Yalnızca POST metodu destekleniyor" });
  }
  if (!verifyToken(req.headers.authorization)) {
    return res.status(401).json({ error: "Giriş gerekli" });
  }
  if (isAssistantRateLimited(req, "synthesize", 30)) {
    return res.status(429).json({ error: "Çok fazla ses üretim isteği gönderildi. Bir dakika sonra tekrar deneyin." });
  }

  const text = req.body?.text;
  if (typeof text !== "string" || !text.trim() || text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({ error: `Metin 1-${MAX_TEXT_LENGTH} karakter uzunluğunda olmalıdır.` });
  }

  try {
    const response = await fetch(piperEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "audio/wav" },
      body: JSON.stringify({ text: text.trim() }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 1_000);
      console.error("Piper synthesis failed:", response.status, detail);
      return res.status(502).json({ error: `Piper ses üretimi başarısız (HTTP ${response.status}).` });
    }
    const contentType = response.headers.get("Content-Type") || "";
    if (!contentType.toLowerCase().startsWith("audio/")) {
      console.error("Piper returned an unexpected content type:", contentType);
      return res.status(502).json({ error: "Piper servisi ses dosyası yerine geçersiz içerik döndürdü." });
    }

    const audio = Buffer.from(await response.arrayBuffer());
    if (!audio.length || audio.length > 15 * 1024 * 1024) {
      return res.status(502).json({ error: "Piper ses yanıtı boş veya izin verilen boyuttan büyük." });
    }
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", audio.length);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(audio);
  } catch (error) {
    console.error("Piper synthesis proxy failed:", error);
    return res.status(502).json({ error: "Yerel Piper servisine ulaşılamadı." });
  }
}
