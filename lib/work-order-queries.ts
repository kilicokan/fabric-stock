/**
 * İş Emri ve Atölye Takibi Sorguları
 * Prisma query helper fonksiyonları
 */

import prisma from './prisma';
import type { Prisma } from '@prisma/client';

type CompletedWorkOrder = Prisma.WorkOrderGetPayload<{
  select: {
    id: true;
    orderNo: true;
    productCode: true;
    productName: true;
    quantity: true;
    customerName: true;
    deliveryDate: true;
    status: true;
    priority: true;
    createdAt: true;
    updatedAt: true;
  };
}>;

type CompletedTracking = Prisma.FasonTrackingGetPayload<{
  include: {
    workshop: {
      select: {
        id: true;
        name: true;
        specialization: true;
      };
    };
    user: {
      select: {
        name: true;
        email: true;
      };
    };
  };
}>;

/**
 * İş emrinin tam işlem geçmişini getir
 * Tüm atölyelerdeki işlemleri kronolojik sırada döndürür
 */
export async function getWorkOrderHistory(workOrderId: number) {
  // İş emrini getir
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: {
      assignedUser: { select: { id: true, name: true, email: true, phone: true } },
      fasonTrackings: {
        include: {
          workshop: { select: { id: true, name: true, specialization: true, phone: true } },
          user: { select: { id: true, name: true, email: true, phone: true } }
        },
        orderBy: { createdAt: 'asc' } // En eski → en yeni
      }
    }
  });

  if (!workOrder) {
    return null;
  }

  // Tracking verilerini formatla
  const processingHistory = workOrder.fasonTrackings.map((tracking, index) => {
    const startDate = tracking.startDate ? new Date(tracking.startDate) : null;
    const endDate = tracking.endDate || tracking.deliveryDate;
    const completionDate = endDate ? new Date(endDate) : null;

    let duration: number | null = null;
    if (startDate && completionDate) {
      duration = Math.ceil((completionDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    const defectiveQty = tracking.assignedQuantity && tracking.receivedQuantity
      ? Math.max(0, tracking.assignedQuantity - tracking.receivedQuantity)
      : 0;

    const defectRate = tracking.receivedQuantity && tracking.receivedQuantity > 0
      ? ((defectiveQty / tracking.receivedQuantity) * 100)
      : 0;

    return {
      sequenceNumber: index + 1,
      trackingId: tracking.id,
      workshopId: tracking.workshopId,
      workshopName: tracking.workshop?.name || 'Bilinmiyor',
      workshopSpecialization: tracking.workshop?.specialization || null,
      workshopPhone: tracking.workshop?.phone || null,
      processType: tracking.processType,
      status: tracking.status,
      assignedQuantity: tracking.assignedQuantity,
      receivedQuantity: tracking.receivedQuantity || 0,
      defectiveQuantity: defectiveQty,
      defectRate: parseFloat(defectRate.toFixed(1)),
      unitPrice: tracking.unitPrice || 0,
      totalPrice: tracking.totalPrice || 0,
      startDate: startDate?.toISOString() || null,
      endDate: completionDate?.toISOString() || null,
      duration,
      pickupDate: tracking.pickupDate?.toISOString() || null,
      deliveryDate: tracking.deliveryDate?.toISOString() || null,
      notes: tracking.notes,
      problemNotes: tracking.problemNotes,
      assignedBy: tracking.user ? `${tracking.user.name}` : null,
      latitude: tracking.latitude,
      longitude: tracking.longitude,
      createdAt: tracking.createdAt.toISOString(),
      updatedAt: tracking.updatedAt.toISOString()
    };
  });

  // Özet bilgileri hesapla
  const completedStages = processingHistory.filter(p => p.status === 'TESLIM_EDILDI').length;
  const totalStages = processingHistory.length;
  const completionPercentage = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

  // Aktif aşamayı bul
  let currentStage = null;
  for (let i = processingHistory.length - 1; i >= 0; i--) {
    if (processingHistory[i].status === 'ATÖLYEDE') {
      currentStage = processingHistory[i];
      break;
    }
  }

  // Eğer aktif aşama yoksa, en son tamamlanmayan aşamayı bul
  if (!currentStage) {
    for (let i = processingHistory.length - 1; i >= 0; i--) {
      if (processingHistory[i].status !== 'TESLIM_EDILDI') {
        currentStage = processingHistory[i];
        break;
      }
    }
  }

  // Son tamamlanan aşamayı bul
  const lastCompletedStage = processingHistory.filter(p => p.status === 'TESLIM_EDILDI').pop();

  // Toplam fire ve received hesapla
  const lastCompleted = processingHistory.filter(p => p.status === 'TESLIM_EDILDI').pop();
  const totalReceivedQuantity = lastCompleted?.receivedQuantity || workOrder.quantity || 0;
  const totalDefectiveQuantity = lastCompleted
    ? Math.max(0, (lastCompleted.assignedQuantity || 0) - (lastCompleted.receivedQuantity || 0))
    : 0;
  const totalDefectRate = totalReceivedQuantity > 0
    ? parseFloat(((totalDefectiveQuantity / totalReceivedQuantity) * 100).toFixed(1))
    : 0;

  // Son aşama bilgisi
  const lastStage = processingHistory[processingHistory.length - 1];

  const summary = {
    totalStages,
    completedStages,
    currentStage: currentStage ? {
      sequenceNumber: currentStage.sequenceNumber,
      workshopName: currentStage.workshopName,
      processType: currentStage.processType,
      status: currentStage.status,
      estimatedCompletionDate: currentStage.endDate
    } : null,
    lastWorkshop: lastStage?.workshopName || null,
    lastProcessType: lastStage?.processType || null,
    lastUpdateDate: lastStage?.endDate || lastStage?.startDate || workOrder.updatedAt.toISOString(),
    completionPercentage,
    totalDefectiveQuantity,
    totalReceivedQuantity,
    totalDefectRate,
    estimatedCompletionDate: workOrder.deliveryDate?.toISOString() || null
  };

  return {
    workOrder: {
      id: workOrder.id,
      orderNo: workOrder.orderNo,
      productCode: workOrder.productCode,
      productName: workOrder.productName,
      quantity: workOrder.quantity,
      customerName: workOrder.customerName,
      deliveryDate: workOrder.deliveryDate?.toISOString() || null,
      status: workOrder.status,
      priority: workOrder.priority,
      notes: workOrder.notes,
      assignedUser: workOrder.assignedUser,
      createdAt: workOrder.createdAt.toISOString(),
      updatedAt: workOrder.updatedAt.toISOString()
    },
    processingHistory,
    summary
  };
}

/**
 * Tamamlanan iş emirlerinin detaylı raporunu getir
 * Atölye Raporu sayfası için
 */
export async function getCompletedWorkOrdersReport(
  startDate?: Date,
  endDate?: Date,
  workshopId?: number,
  limit = 100,
  offset = 0
) {
  const where: Prisma.FasonTrackingWhereInput = {};

  // Tarih filtrelemesi
  if (startDate || endDate) {
    where.endDate = {};
    if (startDate) {
      where.endDate.gte = startDate;
    }
    if (endDate) {
      where.endDate.lte = endDate;
    }
  }

  // Atölye filtrelemesi
  if (workshopId) {
    where.workshopId = workshopId;
  }

  // Toplam sayıyı diğer sorgularla paralel al
  const totalPromise = prisma.fasonTracking.count({ where });

  // Filtrelenen tracking kayıtlarından iş emri havuzunu çıkar
  const filteredTrackings = await prisma.fasonTracking.findMany({
    where,
    select: {
      workOrderId: true,
      endDate: true,
      workOrder: {
        select: {
          id: true,
          orderNo: true,
          productCode: true,
          productName: true,
          quantity: true,
          customerName: true,
          deliveryDate: true,
          status: true,
          priority: true,
          createdAt: true,
          updatedAt: true
        }
      }
    },
    orderBy: { endDate: 'desc' },
    take: limit,
    skip: offset
  });

  const uniqueWorkOrderIds: number[] = [];
  const workOrderMap = new Map<number, CompletedWorkOrder>();

  for (const tracking of filteredTrackings) {
    if (!workOrderMap.has(tracking.workOrderId)) {
      uniqueWorkOrderIds.push(tracking.workOrderId);
      workOrderMap.set(tracking.workOrderId, tracking.workOrder);
    }
  }

  // N+1 yerine tek sorguda tüm detay tracking verilerini çek
  const allTrackings = uniqueWorkOrderIds.length > 0
    ? await prisma.fasonTracking.findMany({
      where: {
        workOrderId: { in: uniqueWorkOrderIds }
      },
      include: {
        workshop: {
          select: {
            id: true,
            name: true,
            specialization: true
          }
        },
        user: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: [
        { workOrderId: 'asc' },
        { createdAt: 'asc' }
      ]
    })
    : [];

  const trackingsByWorkOrder = new Map<number, CompletedTracking[]>();
  for (const tracking of allTrackings) {
    const bucket = trackingsByWorkOrder.get(tracking.workOrderId);
    if (bucket) {
      bucket.push(tracking);
    } else {
      trackingsByWorkOrder.set(tracking.workOrderId, [tracking]);
    }
  }

  const reports: ReturnType<typeof buildWorkOrderReport>[] = [];
  for (const workOrderId of uniqueWorkOrderIds) {
    const workOrder = workOrderMap.get(workOrderId);
    if (!workOrder) {
      continue;
    }
    reports.push(buildWorkOrderReport(workOrder, trackingsByWorkOrder.get(workOrderId) || []));
  }

  reports.sort((a, b) =>
    new Date(b.lastUpdateDate).getTime() - new Date(a.lastUpdateDate).getTime()
  );

  // Toplam sayı
  const total = await totalPromise;

  return {
    data: reports,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    }
  };
}

/**
 * İş emri ve tracking verilerinden rapor oluştur
 */
function buildWorkOrderReport(workOrder: CompletedWorkOrder, trackings: CompletedTracking[]) {
  const processingHistory = trackings.map((tracking, index) => {
    const startDate = tracking.startDate ? new Date(tracking.startDate) : null;
    const endDate = tracking.endDate || tracking.deliveryDate;
    const completionDate = endDate ? new Date(endDate) : null;

    let duration: number | null = null;
    if (startDate && completionDate) {
      duration = Math.ceil((completionDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    const defectiveQty = tracking.assignedQuantity && tracking.receivedQuantity
      ? Math.max(0, tracking.assignedQuantity - tracking.receivedQuantity)
      : 0;

    const defectRate = tracking.receivedQuantity && tracking.receivedQuantity > 0
      ? parseFloat(((defectiveQty / tracking.receivedQuantity) * 100).toFixed(1))
      : 0;

    return {
      stageNumber: index + 1,
      workshopName: tracking.workshop?.name || 'Bilinmiyor',
      workshopSpecialization: tracking.workshop?.specialization || null,
      processType: tracking.processType,
      status: tracking.status,
      assignedQuantity: tracking.assignedQuantity,
      receivedQuantity: tracking.receivedQuantity || 0,
      defectiveQuantity: defectiveQty,
      defectRate,
      unitPrice: tracking.unitPrice || 0,
      totalPrice: tracking.totalPrice || 0,
      startDate: startDate?.toISOString() || null,
      completionDate: completionDate?.toISOString() || null,
      duration,
      assignedBy: tracking.user ? tracking.user.name : null,
      notes: tracking.notes
    };
  });

  // Özet hesapla
  const completedStages = processingHistory.filter(p => p.status === 'TESLIM_EDILDI').length;
  const totalStages = processingHistory.length;

  // Toplam alınan = iş emrinin son tamamlanan aşamasındaki miktar (atölyeler arası tekrar sayılmaz)
  const lastCompleted = processingHistory.filter(p => p.status === 'TESLIM_EDILDI').pop();
  const totalReceivedQuantity = lastCompleted?.receivedQuantity || workOrder.quantity || 0;

  // Fire = atanan - alınan, sadece son aşamada
  const totalDefectiveQuantity = lastCompleted
    ? Math.max(0, (lastCompleted.assignedQuantity || 0) - (lastCompleted.receivedQuantity || 0))
    : 0;

  const totalDefectRate = totalReceivedQuantity > 0
    ? parseFloat(((totalDefectiveQuantity / totalReceivedQuantity) * 100).toFixed(1))
    : 0;

  const lastStage = processingHistory[processingHistory.length - 1];
  const lastCompletedStage = processingHistory.filter(p => p.status === 'TESLIM_EDILDI').pop();

  // Toplam değer
  const totalValue = processingHistory.reduce((sum, p) => sum + (p.totalPrice || 0), 0);

  return {
    workOrderId: workOrder.id,
    orderNo: workOrder.orderNo,
    productCode: workOrder.productCode,
    productName: workOrder.productName,
    totalQuantity: workOrder.quantity,
    customerName: workOrder.customerName,
    finalStatus: workOrder.status,
    currentWorkshop: lastStage?.workshopName || null,
    currentStage: lastStage?.processType || null,
    currentStatus: lastStage?.status || null,
    lastUpdateDate: lastCompletedStage?.completionDate || lastStage?.startDate || workOrder.updatedAt.toISOString(),
    stagesCompleted: completedStages,
    totalStages,
    completionPercentage: totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0,
    totalDefectiveQuantity,
    totalReceivedQuantity,
    totalDefectRate,
    totalValue: parseFloat(totalValue.toFixed(2)),
    processingHistory,
    createdAt: workOrder.createdAt.toISOString(),
    updatedAt: workOrder.updatedAt.toISOString(),
    deliveryDate: workOrder.deliveryDate?.toISOString() || null
  };
}

/**
 * Belirli bir atölyede işlem gören iş emirlerini getir
 */
export async function getWorkOrdersByWorkshop(workshopId: number) {
  const trackings = await prisma.fasonTracking.findMany({
    where: { workshopId },
    include: {
      workOrder: true,
      workshop: true
    },
    orderBy: { createdAt: 'desc' }
  });

  // İş emirlerini gruplayarak benzersiz hale getir
  const uniqueWorkOrders = new Map();
  trackings.forEach(tracking => {
    if (!uniqueWorkOrders.has(tracking.workOrderId)) {
      uniqueWorkOrders.set(tracking.workOrderId, {
        workOrderId: tracking.workOrderId,
        orderNo: tracking.workOrder.orderNo,
        productName: tracking.workOrder.productName,
        status: tracking.workOrder.status,
        processType: tracking.processType,
        lastUpdateDate: tracking.endDate || tracking.startDate || tracking.createdAt
      });
    }
  });

  return Array.from(uniqueWorkOrders.values());
}

/**
 * Belirli tarih aralığında tamamlanan iş emirlerini getir
 */
export async function getCompletedWorkOrdersInDateRange(startDate: Date, endDate: Date) {
  const trackings = await prisma.fasonTracking.findMany({
    where: {
      endDate: {
        gte: startDate,
        lte: endDate
      },
      status: 'TESLIM_EDILDI'
    },
    include: {
      workOrder: true,
      workshop: true
    },
    orderBy: { endDate: 'desc' }
  });

  // İş emirlerini gruplayarak benzersiz hale getir
  const uniqueWorkOrders = new Map();
  trackings.forEach(tracking => {
    if (!uniqueWorkOrders.has(tracking.workOrderId)) {
      uniqueWorkOrders.set(tracking.workOrderId, {
        workOrderId: tracking.workOrderId,
        orderNo: tracking.workOrder.orderNo,
        productName: tracking.workOrder.productName,
        completionDate: tracking.endDate,
        totalQuantity: tracking.workOrder.quantity,
        workshopName: tracking.workshop?.name
      });
    }
  });

  return Array.from(uniqueWorkOrders.values());
}
