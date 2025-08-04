import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req: { method: string; }, res: { status: (arg0: number) => { (): any; new(): any; json: { (arg0: { error: string; }): void; new(): any; }; end: { (): void; new(): any; }; }; }) {
  if (req.method === "GET") {
    try {
      const entries = await prisma.fabricEntry.findMany({
        orderBy: {
          createdAt: "desc",
        },
      });

      res.status(200).json(entries);
    } catch (err) {
      console.error("Listeleme hatası:", err);
      res.status(500).json({ error: "Veriler alınamadı" });
    }
  } else {
    res.status(405).end();
  }
}
