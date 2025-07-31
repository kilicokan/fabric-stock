import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req: { method: string; body: { name: any; color: any; weightKg: any; lengthMeter: any; }; }, res: { status: (arg0: number) => { (): any; new(): any; json: { (arg0: { error: string; }): void; new(): any; }; end: { (): void; new(): any; }; }; }) {
  if (req.method === "POST") {
    const { name, color, weightKg, lengthMeter } = req.body;

    try {
      const entry = await prisma.fabricEntry.create({
        data: {
          name,
          color,
          weightKg: weightKg ? parseFloat(weightKg) : null,
          lengthMeter: lengthMeter ? parseFloat(lengthMeter) : null,
        },
      });

      res.status(200).json(entry);
    } catch (err) {
      console.error("Kayıt hatası:", err);
      res.status(500).json({ error: "Veri kaydedilemedi" });
    }
  } else {
    res.status(405).end();
  }
}
