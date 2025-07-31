import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req: { method: string; body: { fabricType: any; color: any; weightKg: any; lengthMeter: any; cuttingTable: any; }; }, res: { status: (arg0: number) => { (): any; new(): any; json: { (arg0: { error: string; }): void; new(): any; }; end: { (): void; new(): any; }; }; }) {
  if (req.method === "POST") {
    const { fabricType, color, weightKg, lengthMeter, cuttingTable } = req.body;

    console.log("Kumaş çıkışı alınıyor:", req.body);

    try {
      const created = await prisma.fabricExit.create({
        data: {
          fabricType,
          color,
          weightKg,
          lengthMeter,
          cuttingTable,
        },
      });

      res.status(200).json(created);
    } catch (err) {
      console.error("Hata:", err);
      res.status(500).json({ error: "Kayıt oluşturulamadı" });
    }
  } else {
    res.status(405).end(); // Method Not Allowed
  }
}
