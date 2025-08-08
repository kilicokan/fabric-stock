import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // ✅ Tartı servisine istek atıyoruz
    const response = await axios.get("http://localhost:3002/weight");
    res.status(200).json(response.data);
  } catch (err) {
    console.error("Tartı verisi alınamadı:", err);
    res.status(500).json({ error: "Tartı servisine ulaşılamadı" });
  }
}
