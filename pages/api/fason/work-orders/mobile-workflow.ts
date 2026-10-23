import { NextApiRequest, NextApiResponse } from 'next';
import prisma from "@/lib/prisma";
import * as jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/runtime-config';
import {
  checkRouteCompleteForCentralReceive,
  parseStoredRoute,
  resolveProcessTypeForWorkshop
} from '@/lib/product-route';


interface TokenPayload {
  userId: number;
  email: string;
}

const verifyToken = (req: NextApiRequest): TokenPayload => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new Error('Token bulunamadı');
  
  return jwt.verify(token, getJwtSecret()) as TokenPayload;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const user = verifyToken(req);

    switch (req.method) {
      case 'POST':
        return handlePost(req, res, user);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// Workflow akışı:
// 1. startWorkshop - Atölyede işleme başla (BAŞLADI)
// 2. receiveFromWorkshop - Atölyeden mal teslim al (adet, defo, fire, tamir)
// 3. assignNextWorkshop - Sonraki atölyeye malı ata
// 4. finalReceive - Üretim tamamlandı, mal teslim alındı

async function handlePost(req: NextApiRequest, res: NextApiResponse, user: TokenPayload) {
  const { action, workOrderId, workshopId, quantity, defective, damaged, repaired } = req.body;

  if (!action || !workOrderId) {
    return res.status(400).json({ error: 'action ve workOrderId zorunludur' });
  }

  try {
    switch (action) {
      case 'startWorkshop':
        return await startWorkshop(res, workOrderId, workshopId, user.userId);
      
      case 'receiveFromWorkshop':
        return await receiveFromWorkshop(res, workOrderId, workshopId, quantity, defective, damaged, repaired, user.userId);
      
      case 'assignNextWorkshop':
        return await assignNextWorkshop(res, workOrderId, workshopId, user.userId);
      
      case 'finalReceive': {
        const { damagedQuantity, defectiveQuantity, repairedQuantity, lostQuantity } = req.body;
        const quantities = [damagedQuantity, defectiveQuantity, repairedQuantity, lostQuantity].map(
          (value) => (value === undefined || value === null ? 0 : Number(value))
        );
        if (quantities.some((value) => !Number.isInteger(value) || value < 0)) {
          return res.status(400).json({ error: 'Adetler sıfır veya pozitif tam sayı olmalıdır' });
        }
        const [damaged, defective, repaired, lost] = quantities;
        return await finalReceive(res, workOrderId, user.userId, { damaged, defective, repaired, lost });
      }
      
      default:
        return res.status(400).json({ error: 'Bilinmeyen aksiyon' });
    }
  } catch (error) {
    console.error('Workflow Error:', error);
    return res.status(500).json({ error: 'Workflow işlemi başarısız' });
  }
}

/**
 * Atölyede işleme başla - Malı atölyeye teslim et
 */
async function startWorkshop(
  res: NextApiResponse,
  workOrderId: number,
  workshopId: number,
  userId: number
) {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: { fasonTrackings: { orderBy: { createdAt: 'desc' } } }
  });

  if (!workOrder) {
    return res.status(404).json({ error: 'İş emri bulunamadı' });
  }

  // Atölye bilgisini getir
  const workshop = await prisma.fasonWorkshop.findUnique({
    where: { id: workshopId }
  });

  if (!workshop) {
    return res.status(404).json({ error: 'Atölye bulunamadı' });
  }

  // Ürün rotasına ve atölye uzmanlığına göre ProcessType belirle
  const startProduct = await prisma.product.findUnique({
    where: { modelNo: workOrder.productCode },
    select: { routeSteps: true }
  });
  const startResolved = resolveProcessTypeForWorkshop(
    parseStoredRoute(startProduct?.routeSteps),
    workshop.specialization,
    workOrder.fasonTrackings
  );
  if (startResolved.ok === false) {
    return res.status(400).json({ error: startResolved.message });
  }
  const processType = startResolved.processType;
  const tracking = await prisma.fasonTracking.create({
    data: {
      workOrderId,
      workshopId,
      userId,
      processType,
      stepName: startResolved.stepName ?? null,
      status: 'ATÖLYEDE',
      startDate: new Date(),
      assignedQuantity: workOrder.quantity
    }
  });

  // WorkOrder durumunu ATÖLYEDE olarak güncelle
  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: { status: 'ATÖLYEDE' }
  });

  return res.json({
    success: true,
    message: 'Mal atölyeye teslim edildi',
    tracking
  });
}

/**
 * Atölyeden mal teslim al - Adet, defo, fire, tamir girilir
 */
async function receiveFromWorkshop(
  res: NextApiResponse,
  workOrderId: number,
  workshopId: number,
  quantity: number,
  defective: number,
  damaged: number,
  repaired: number,
  userId: number
) {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId }
  });

  if (!workOrder) {
    return res.status(404).json({ error: 'İş emri bulunamadı' });
  }

  const receivedQty = Number(quantity);
  if (!Number.isFinite(receivedQty) || receivedQty <= 0) {
    return res.status(400).json({ error: 'Teslim alınan adet 1 veya daha büyük olmalıdır' });
  }

  if (receivedQty > workOrder.quantity) {
    return res.status(400).json({
      error: `Toplam alınan miktar iş emri adedinden fazla olamaz. Maksimum ${workOrder.quantity} adet teslim alabilirsiniz.`
    });
  }

  // Mevcut tracking kaydını al (kapasite hesaplaması için)
  const currentTracking = await prisma.fasonTracking.findFirst({
    where: {
      workOrderId,
      workshopId,
      status: 'ATÖLYEDE'
    },
    include: { workshop: true }
  });

  // Mevcut tracking kaydını HAZIR durumuna güncelle
  const updatedTracking = await prisma.fasonTracking.updateMany({
    where: {
      workOrderId,
      workshopId,
      status: 'ATÖLYEDE'
    },
    data: {
      status: 'HAZIR',
      endDate: new Date(),
      assignedQuantity: receivedQty,
      receivedQuantity: receivedQty,
      problemNotes: `Defo: ${defective}, Fire: ${damaged}, Tamir: ${repaired}`
    }
  });

  // Atölyenin kapasitesini güncelle (TESLIM AL - Kapasite AÇ/ARTIR)
  if (currentTracking && workshopId) {
    console.log(`💰 Atölye kapasitesi güncelleniyor: workshopId=${workshopId}, teslim alınan adet=${receivedQty}`);

    // Kapasiteyi ARTIR - tutar bazlı
    // Kapasite = (quantity × unitPrice) kadarını ARTIR (atölyeyi boşalt)
    const unitPrice = Number(currentTracking.unitPrice ?? 0);
    const capacityIncrease = receivedQty * unitPrice;
    
    console.log(`📈 Kapasite artırması: quantity=${quantity}, unitPrice=${unitPrice}, total=${capacityIncrease}`);

    const workshop = await prisma.fasonWorkshop.findUnique({
      where: { id: workshopId }
    });

    if (workshop) {
      const currentCapacity = workshop.capacity ?? (workshop.maxCapacity || 500000);
      const maxCapacity = workshop.maxCapacity || 500000;
      // Kapasite maxCapacity'yi geçmesin
      const newCapacity = Math.min(maxCapacity, currentCapacity + capacityIncrease);
      
      await prisma.fasonWorkshop.update({
        where: { id: workshopId },
        data: {
          capacity: newCapacity
        }
      });

      console.log(`✅ Atölye kapasitesi arttırıldı (teslim al): ${currentCapacity} → ${newCapacity}`);
    }
  }

  // WorkOrder durumunu HAZIR olarak güncelle
  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: { status: 'HAZIR' }
  });

  // Sonraki adımı hazırla: Atölye ata veya teslim al
  const nextTracking = await prisma.fasonTracking.findFirst({
    where: { workOrderId },
    orderBy: { createdAt: 'desc' }
  });

  return res.json({
    success: true,
    message: 'Mal teslim alındı',
    data: {
      receivedQuantity: receivedQty,
      defective,
      damaged,
      repaired,
      nextAction: 'assignOrFinalReceive' // UI'ye sonraki adımı söyle
    }
  });
}

/**
 * Malı sonraki atölyeye ata (örn. Dikim -> Ütü)
 */
async function assignNextWorkshop(
  res: NextApiResponse,
  workOrderId: number,
  nextWorkshopId: number,
  userId: number
) {
  // Sonraki atölye bilgisini getir
  const nextWorkshop = await prisma.fasonWorkshop.findUnique({
    where: { id: nextWorkshopId }
  });

  if (!nextWorkshop) {
    return res.status(404).json({ error: 'Atölye bulunamadı' });
  }

  // Ürün rotasına ve atölye uzmanlığına göre ProcessType belirle
  const nextOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: { fasonTrackings: true }
  });
  if (!nextOrder) {
    return res.status(404).json({ error: 'İş emri bulunamadı' });
  }
  const nextProduct = await prisma.product.findUnique({
    where: { modelNo: nextOrder.productCode },
    select: { routeSteps: true }
  });
  const nextResolved = resolveProcessTypeForWorkshop(
    parseStoredRoute(nextProduct?.routeSteps),
    nextWorkshop.specialization,
    nextOrder.fasonTrackings
  );
  if (nextResolved.ok === false) {
    return res.status(400).json({ error: nextResolved.message });
  }
  const processType = nextResolved.processType;
  // Yeni tracking kaydı oluştur
  const newTracking = await prisma.fasonTracking.create({
    data: {
      workOrderId,
      workshopId: nextWorkshopId,
      userId,
      processType,
      stepName: nextResolved.stepName ?? null,
      status: 'BEKLIYOR',
      assignedQuantity: 0 // Henüz bilinmiyor, receiveFromWorkshop'tan sonra set edilecek
    }
  });

  return res.json({
    success: true,
    message: 'Mal sonraki atölyeye atandı',
    tracking: newTracking
  });
}

/**
 * Üretim tamamlandı - Malı teslim al (final)
 */
const extractColorFromNotes = (notes?: string | null): string => {
  if (!notes) return "";
  const match = notes.match(/Renk:\s*([^|]+)/i);
  return match?.[1]?.trim() || "";
};

const extractOrderItemIdFromExternalRef = (externalRef?: string | null): number | null => {
  if (!externalRef) return null;
  const match = externalRef.match(/customer-order:\d+:item:(\d+)/i);
  if (!match?.[1]) return null;
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

async function resolveCutColor(externalErpId?: string | null, notes?: string | null): Promise<string> {
  const orderItemId = extractOrderItemIdFromExternalRef(externalErpId);
  if (orderItemId) {
    const orderItem = await prisma.customerOrderItem.findUnique({
      where: { id: orderItemId },
      select: { color: true }
    });
    const color = String(orderItem?.color || "").trim();
    if (color) return color;
  }

  return extractColorFromNotes(notes);
}

async function createAutomaticFabricExitsForFinalReceive(workOrderId: number) {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: {
      id: true,
      orderNo: true,
      productCode: true,
      productName: true,
      quantity: true,
      customerName: true,
      externalErpId: true,
      notes: true,
    }
  });

  if (!workOrder) {
    return;
  }

  const product = await prisma.product.findFirst({
    where: { modelNo: workOrder.productCode },
    include: {
      fabric: true,
      recipes: {
        where: { resourceType: 'FABRIC' },
        include: { fabric: true }
      }
    }
  });

  const cuttingTable = await prisma.cuttingTable.findFirst({
    orderBy: { id: 'asc' },
    select: { id: true }
  });

  if (!product || !cuttingTable) {
    return;
  }

  const resolvedColor = await resolveCutColor(workOrder.externalErpId, workOrder.notes);

  for (const recipe of product.recipes) {
    if (recipe.resourceType !== 'FABRIC') continue;

    const unit = String(recipe.unit || '').trim().toLowerCase().startsWith('m') ? 'm' : 'kg';
    const quantityPerUnit = Number(recipe.quantityPerUnit || 0);
    const consumedQuantity = Number(workOrder.quantity || 0) * quantityPerUnit;
    if (consumedQuantity <= 0) continue;

    const reportNumber = `AUTO-KESIM-${workOrder.id}-${recipe.id}`;
    const existingExit = await prisma.fabricExit.findFirst({
      where: { reportNumber },
      select: { id: true }
    });

    if (existingExit) continue;

    await prisma.fabricExit.create({
      data: {
        modelNo: workOrder.productCode,
        modelName: product.name || workOrder.productName || null,
        orderNo: workOrder.orderNo,
        customerId: workOrder.customerName || '-',
        layerCount: 1,
        productWeightKg: unit === 'kg' ? consumedQuantity : 0,
        productLengthMeter: unit === 'm' ? consumedQuantity : 0,
        grammage: 0,
        externalProductId: workOrder.externalErpId || null,
        unitType: unit,
        fabricType: recipe.fabric?.name || product.fabric?.name || workOrder.productName || workOrder.productCode,
        color: resolvedColor || null,
        cuttingTableId: cuttingTable.id,
        reportNumber,
        createdAt: new Date()
      }
    });
  }
}

/**
 * Üretim tamamlandı - Malı teslim al (final)
 */
async function finalReceive(
  res: NextApiResponse,
  workOrderId: number,
  userId: number,
  quantities: { damaged: number; defective: number; repaired: number; lost: number }
) {
  const finalOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: { fasonTrackings: true }
  });
  if (!finalOrder) {
    return res.status(404).json({ error: 'İş emri bulunamadı' });
  }
  const finalProduct = await prisma.product.findUnique({
    where: { modelNo: finalOrder.productCode },
    select: { routeSteps: true }
  });
  const routeCheck = checkRouteCompleteForCentralReceive(
    parseStoredRoute(finalProduct?.routeSteps),
    finalOrder.fasonTrackings
  );
  if (routeCheck.ok === false) {
    return res.status(400).json({ error: routeCheck.message });
  }
  if (finalOrder.status === 'TESLIM_EDILDI') {
    return res.status(400).json({ error: 'Bu iş emri zaten kapatılmış.' });
  }
  const pendingAssignment = finalOrder.fasonTrackings.find(
    (t) => t.processType !== 'KESIM' && (t.status === 'BEKLIYOR' || t.status === 'ATÖLYEDE')
  );
  if (pendingAssignment) {
    return res.status(400).json({
      error: 'Atölyede teslim alınmamış bir atama var. Önce atölyeden teslim alın.'
    });
  }

  const updatedWorkOrder = await prisma.$transaction(async (tx) => {
    const result = await tx.workOrder.update({
      where: { id: workOrderId },
      data: {
        status: 'TESLIM_EDILDI',
        centralWarehouseReceived: true,
        updatedAt: new Date()
      }
    });

    await tx.fasonTracking.updateMany({
      where: {
        workOrderId,
        status: { in: ['HAZIR', 'ATÖLYEDE'] }
      },
      data: {
        status: 'TESLIM_EDILDI',
        endDate: new Date(),
        problemNotes: `Merkez Depo teslimi - Lekeli: ${quantities.damaged}, Defolu: ${quantities.defective}, Tamir: ${quantities.repaired}, Kayıp: ${quantities.lost}`
      }
    });

    return result;
  });

  await createAutomaticFabricExitsForFinalReceive(updatedWorkOrder.id);

  return res.json({
    success: true,
    message: 'Üretim tamamlandı, mal teslim alındı',
    workOrder: updatedWorkOrder
  });
}
