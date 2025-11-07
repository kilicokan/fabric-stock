import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

const verifyToken = (req: NextApiRequest) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new Error('Token bulunamadı');
  
  return jwt.verify(token, process.env.JWT_SECRET || 'secret-key');
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const user = verifyToken(req);

    switch (req.method) {
      case 'GET':
        return handleGet(req, res);
      case 'POST':
        return handlePost(req, res, user);
      case 'PUT':
        return handlePut(req, res, user);
      case 'DELETE':
        return handleDelete(req, res, user);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// Atölyeleri listele
async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const { specialization, isActive } = req.query;

  const where: any = {};
  if (specialization) where.specialization = specialization;
  if (isActive !== undefined) where.isActive = isActive === 'true';

  const workshops = await prisma.fasonWorkshop.findMany({
    where,
    orderBy: { name: 'asc' }
  });

  return res.json(workshops);
}

// Yeni atölye oluştur
async function handlePost(req: NextApiRequest, res: NextApiResponse, user: any) {
  const {
    name,
    contactPerson,
    phone,
    address,
    specialization
  } = req.body;

  const workshop = await prisma.fasonWorkshop.create({
    data: {
      name,
      contactPerson,
      phone,
      address,
      specialization
    }
  });

  return res.status(201).json(workshop);
}

// Atölye güncelle
async function handlePut(req: NextApiRequest, res: NextApiResponse, user: any) {
  const { id, ...updateData } = req.body;

  const workshop = await prisma.fasonWorkshop.update({
    where: { id: parseInt(id) },
    data: {
      ...updateData,
      updatedAt: new Date()
    }
  });

  return res.json(workshop);
}

// Atölye sil
async function handleDelete(req: NextApiRequest, res: NextApiResponse, user: any) {
  const { id } = req.query;

  await prisma.fasonWorkshop.delete({
    where: { id: parseInt(id as string) }
  });

  return res.json({ message: 'Workshop deleted successfully' });
}
