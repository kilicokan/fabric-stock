import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export default async function handler(req, res) {
  try {
    const externalApiUrl = "https://external-api.com/products"; // Dış API adresi
    const response = await fetch(externalApiUrl);
    const externalProducts = await response.json();

    for (const p of externalProducts) {
      await prisma.product.upsert({
        where: { modelNo: p.modelNo },
        update: { name: p.name, description: p.description ?? null },
        create: { modelNo: p.modelNo, name: p.name, description: p.description ?? null }
      });
    }

    res.json({ message: "Ürünler senkronize edildi" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Dış API'den veri alınamadı" });
  }
}
