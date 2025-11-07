import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// Mira sisteminden ERP'ye veri gönderme endpoint'i
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // JWT token kontrolü
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Token bulunamadı' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'secret-key');

    const {
      action, // 'sync_status', 'sync_completion'
      workOrderId,
      status,
      completionData
    } = req.body;

    switch (action) {
      case 'sync_status':
        return await syncWorkOrderStatus(workOrderId, status, res);
      case 'sync_completion':
        return await syncWorkOrderCompletion(workOrderId, completionData, res);
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

  } catch (error) {
    console.error('ERP Sync Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// İş emri durumunu ERP'ye gönder
async function syncWorkOrderStatus(workOrderId: number, status: string, res: NextApiResponse) {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: {
      fasonTrackings: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });

  if (!workOrder) {
    return res.status(404).json({ error: 'Work order not found' });
  }

  // ERP sistemine HTTP request gönder
  const erpData = {
    externalErpId: workOrder.externalErpId,
    orderNo: workOrder.orderNo,
    status: status,
    lastUpdate: new Date().toISOString(),
    tracking: workOrder.fasonTrackings[0] || null
  };

  try {
    // ERP sistemine POST request
    const erpResponse = await fetch(process.env.ERP_API_URL + '/work-orders/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ERP_API_TOKEN}`
      },
      body: JSON.stringify(erpData)
    });

    if (!erpResponse.ok) {
      throw new Error(`ERP API error: ${erpResponse.statusText}`);
    }

    // Başarılı sync kaydını tut
    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: { 
        status,
        updatedAt: new Date()
      }
    });

    return res.json({ 
      success: true,
      message: 'Status synced to ERP successfully',
      erpResponse: await erpResponse.json()
    });

  } catch (fetchError) {
    console.error('ERP API Error:', fetchError);
    return res.status(502).json({ 
      error: 'Failed to sync with ERP system',
      details: fetchError instanceof Error ? fetchError.message : 'Unknown error'
    });
  }
}

// İş emri tamamlanma bilgilerini ERP'ye gönder
async function syncWorkOrderCompletion(workOrderId: number, completionData: any, res: NextApiResponse) {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: {
      fasonTrackings: {
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!workOrder) {
    return res.status(404).json({ error: 'Work order not found' });
  }

  const erpData = {
    externalErpId: workOrder.externalErpId,
    orderNo: workOrder.orderNo,
    completionDate: new Date().toISOString(),
    totalProcessTime: calculateTotalProcessTime(workOrder.fasonTrackings),
    processHistory: workOrder.fasonTrackings.map(tracking => ({
      processType: tracking.processType,
      status: tracking.status,
      startDate: tracking.startDate,
      endDate: tracking.endDate,
      notes: tracking.notes,
      problemNotes: tracking.problemNotes
    })),
    ...completionData
  };

  try {
    const erpResponse = await fetch(process.env.ERP_API_URL + '/work-orders/completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ERP_API_TOKEN}`
      },
      body: JSON.stringify(erpData)
    });

    if (!erpResponse.ok) {
      throw new Error(`ERP API error: ${erpResponse.statusText}`);
    }

    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: { 
        status: 'TESLIM_EDILDI' as any,
        updatedAt: new Date()
      }
    });

    return res.json({ 
      success: true,
      message: 'Completion data synced to ERP successfully',
      erpResponse: await erpResponse.json()
    });

  } catch (fetchError) {
    console.error('ERP API Error:', fetchError);
    return res.status(502).json({ 
      error: 'Failed to sync completion data with ERP system',
      details: fetchError instanceof Error ? fetchError.message : 'Unknown error'
    });
  }
}

// Toplam süreç süresini hesapla
function calculateTotalProcessTime(trackings: any[]): number {
  let totalMinutes = 0;
  
  trackings.forEach(tracking => {
    if (tracking.startDate && tracking.endDate) {
      const start = new Date(tracking.startDate);
      const end = new Date(tracking.endDate);
      const diffMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
      totalMinutes += diffMinutes;
    }
  });

  return totalMinutes;
}
