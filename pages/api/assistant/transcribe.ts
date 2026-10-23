import type { NextApiRequest, NextApiResponse } from "next";
import { verifyToken } from "@/lib/auth";
import { isAssistantRateLimited } from "@/lib/assistant-rate-limit";

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

function whisperEndpoint(): URL {
  const configured = process.env.WHISPER_URL || "http://127.0.0.1:8000/v1/audio/transcriptions";
  const endpoint = new URL(configured);
  if (!["http:", "https:"].includes(endpoint.protocol)) {
    throw new Error("WHISPER_URL yalnızca HTTP veya HTTPS olabilir.");
  }
  return endpoint;
}

async function readAudio(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of req) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += data.length;
    if (length > MAX_AUDIO_BYTES) {
      throw new RangeError("Ses kaydı 20 MB sınırını aşıyor.");
    }
    chunks.push(data);
  }
  return Buffer.concat(chunks, length);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!verifyToken(req.headers.authorization)) {
    return res.status(401).json({ error: "Giriş gerekli" });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Yalnızca GET ve POST metotları destekleniyor" });
  }

  if (isAssistantRateLimited(req, "transcribe", 10)) {
    return res.status(429).json({ error: "Çok fazla ses isteği gönderildi. Bir dakika sonra tekrar deneyin." });
  }

  let endpoint: URL;
  try {
    endpoint = whisperEndpoint();
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "WHISPER_URL ayarı geçersiz." });
  }

  if (req.method === "GET") {
    const healthUrl = process.env.WHISPER_HEALTH_URL || new URL("/health", endpoint).toString();
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(3_000) });
      if (!response.ok) {
        return res.status(503).json({ available: false, error: `Whisper servisi HTTP ${response.status} döndürdü.` });
      }
      return res.status(200).json({ available: true });
    } catch (error) {
      console.error("Whisper health check failed:", error);
      return res.status(503).json({ available: false, error: "Yerel Whisper servisine ulaşılamıyor." });
    }
  }

  const contentType = req.headers["content-type"] || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    return res.status(400).json({ error: "Ses dosyası multipart/form-data olarak gönderilmelidir." });
  }
  const contentLength = Number(req.headers["content-length"]);
  if (Number.isFinite(contentLength) && contentLength > MAX_AUDIO_BYTES) {
    return res.status(413).json({ error: "Ses kaydı 20 MB sınırını aşıyor." });
  }

  try {
    const audio = await readAudio(req);
    if (audio.length === 0) {
      return res.status(400).json({ error: "Ses kaydı boş." });
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: Uint8Array.from(audio),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 1_000);
      console.error("Whisper transcription failed:", response.status, detail);
      return res.status(502).json({ error: `Whisper transkripsiyonu başarısız (HTTP ${response.status}).` });
    }

    const result = await response.json() as { text?: unknown; detail?: unknown };
    if (typeof result.text !== "string" || !result.text.trim()) {
      const detail = typeof result.detail === "string" ? result.detail : null;
      return res.status(502).json({
        error: detail || "Whisper servisi boş veya geçersiz bir transkripsiyon döndürdü.",
      });
    }
    return res.status(200).json({ text: result.text.trim() });
  } catch (error) {
    if (error instanceof RangeError) {
      return res.status(413).json({ error: error.message });
    }
    console.error("Whisper transcription proxy failed:", error);
    return res.status(502).json({ error: "Whisper servisine ulaşılamadı veya ses çözümlenemedi." });
  }
}
