import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Only GET method allowed' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'İş emri ID zorunludur' });
  }

  try {
    // İş emri detaylarını getir
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: parseInt(id) },
      include: {
        assignedUser: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!workOrder) {
      return res.status(404).json({ error: 'İş emri bulunamadı' });
    }

    // Bu iş emrinin tüm workflow'larını getir
    const workflows = await prisma.fasonTracking.findMany({
      where: { workOrderId: parseInt(id) },
      include: {
        workshop: {
          select: { id: true, name: true, specialization: true }
        },
        user: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Mobil app için format
    const formattedWorkflows = workflows.map((wf) => ({
      id: wf.id,
      workshopId: wf.workshopId,
      workshopName: wf.workshop?.name || 'Atölye',
      processType: wf.processType,
      status: wf.status,
      startDate: wf.startDate,
      endDate: wf.endDate,
      assignedQuantity: wf.assignedQuantity,
      notes: wf.problemNotes || wf.notes
    }));

    return res.status(200).json({
      workOrder,
      workflows: formattedWorkflows
    });
  } catch (error) {
    console.error('Error fetching work order detail:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
