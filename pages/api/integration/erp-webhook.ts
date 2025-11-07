import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Dış ERP sisteminden gelen webhook verilerini işler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // API Key kontrolü (güvenlik için)
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey || apiKey !== process.env.ERP_WEBHOOK_API_KEY) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const {
      action, // 'create', 'update', 'delete'
      workOrder
    } = req.body;

    switch (action) {
      case 'create':
        return await createWorkOrder(workOrder, res);
      case 'update':
        return await updateWorkOrder(workOrder, res);
      case 'delete':
        return await deleteWorkOrder(workOrder.externalErpId, res);
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

  } catch (error) {
    console.error('ERP Webhook Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Yeni iş emri oluştur
async function createWorkOrder(orderData: any, res: NextApiResponse) {
  const {
    externalErpId,
    orderNo,
    productCode,
    productName,
    quantity,
    customerName,
    deliveryDate,
    notes
  } = orderData;

  // Aynı external ID ile kayıt var mı kontrol et
  const existingOrder = await prisma.workOrder.findFirst({
    where: { externalErpId }
  });

  if (existingOrder) {
    return res.status(409).json({ 
      error: 'Work order already exists',
      workOrderId: existingOrder.id 
    });
  }

  const workOrder = await prisma.workOrder.create({
    data: {
      orderNo,
      productCode,
      productName,
      quantity: parseInt(quantity),
      customerName,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
      notes,
      externalErpId,
      status: 'KESIM' // Varsayılan durum
    }
  });

  return res.status(201).json({ 
    success: true, 
    workOrderId: workOrder.id,
    message: 'Work order created successfully'
  });
}

// İş emrini güncelle
async function updateWorkOrder(orderData: any, res: NextApiResponse) {
  const { externalErpId, ...updateData } = orderData;

  const workOrder = await prisma.workOrder.findFirst({
    where: { externalErpId }
  });

  if (!workOrder) {
    return res.status(404).json({ error: 'Work order not found' });
  }

  const updatedOrder = await prisma.workOrder.update({
    where: { id: workOrder.id },
    data: {
      ...updateData,
      quantity: updateData.quantity ? parseInt(updateData.quantity) : undefined,
      deliveryDate: updateData.deliveryDate ? new Date(updateData.deliveryDate) : undefined,
      updatedAt: new Date()
    }
  });

  return res.json({ 
    success: true, 
    workOrderId: updatedOrder.id,
    message: 'Work order updated successfully'
  });
}

// İş emrini sil
async function deleteWorkOrder(externalErpId: string, res: NextApiResponse) {
  const workOrder = await prisma.workOrder.findFirst({
    where: { externalErpId }
  });

  if (!workOrder) {
    return res.status(404).json({ error: 'Work order not found' });
  }

  // İlgili takip kayıtlarını da sil
  await prisma.fasonTracking.deleteMany({
    where: { workOrderId: workOrder.id }
  });

  await prisma.workOrder.delete({
    where: { id: workOrder.id }
  });

  return res.json({ 
    success: true,
    message: 'Work order deleted successfully'
  });
}
