import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mobil uygulama için PUBLIC atölyeler endpoint
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Only GET method allowed' });

  // Set CORS headers for mobile access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const workshops = await prisma.fasonWorkshop.findMany({
      where: { isActive: true }, // Only active workshops
      select: {
        id: true,
        name: true,
        specialization: true,
        contactPerson: true,
        phone: true,
      },
      orderBy: { name: 'asc' },
    });
    res.status(200).json({ workshops });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
