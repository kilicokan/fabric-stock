import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

type ParsedExternalRef = {
  orderId: number;
  itemId: number;
};

type ReportRow = {
  customerName: string;
  customerOrderId: number;
  customerOrderNo: string;
  itemId: number;
  productCode: string;
  productName: string;
  color: string;
  orderQuantity: number;
  assignedToCutting: number;
  cutQuantity: number;
  remainingQuantity: number;
  workOrderNos: string[];
};

const normalizeModelCode = (value: string | null | undefined): string =>
  String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR');

const parseExternalRef = (externalRef?: string | null): ParsedExternalRef | null => {
  if (!externalRef) return null;
  const match = externalRef.trim().match(/^customer-order:(\d+):item:(\d+)$/i);
  if (!match?.[1] || !match?.[2]) return null;
  const orderId = Number(match[1]);
  const itemId = Number(match[2]);
  if (!Number.isInteger(orderId) || orderId <= 0) return null;
  if (!Number.isInteger(itemId) || itemId <= 0) return null;
  return { orderId, itemId };
};

const round3 = (value: number): number => Number(value.toFixed(3));

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const [customerOrders, workOrders] = await Promise.all([
      prisma.customerOrder.findMany({
        include: {
          customer: {
            select: {
              id: true,
              name: true,
            },
          },
          items: {
            select: {
              id: true,
              productCode: true,
              description: true,
              color: true,
              quantity: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.workOrder.findMany({
        where: {
          externalErpId: {
            startsWith: 'customer-order:',
          },
        },
        select: {
          id: true,
          orderNo: true,
          quantity: true,
          centralWarehouseReceived: true,
          externalErpId: true,
          fasonTrackings: {
            where: {
              processType: 'KESIM',
              status: {
                not: 'IPTAL_EDILDI',
              },
            },
            select: {
              assignedQuantity: true,
              receivedQuantity: true,
            },
          },
        },
      }),
    ]);

    const workOrderMap = new Map<
      string,
      Array<{
        orderNo: string;
        quantity: number;
        assignedToCutting: number;
        cutQuantity: number;
        receivedAtWarehouse: number;
      }>
    >();

    workOrders.forEach((workOrder) => {
      const parsed = parseExternalRef(workOrder.externalErpId);
      if (!parsed) return;

      const trackingAssignedTotal = workOrder.fasonTrackings.reduce(
        (sum, tracking) => sum + Number(tracking.assignedQuantity || 0),
        0
      );
      const trackingCutTotal = workOrder.fasonTrackings.reduce(
        (sum, tracking) => sum + Number(tracking.receivedQuantity || 0),
        0
      );

      const fallbackOrderQty = Number(workOrder.quantity || 0);
      const assignedToCutting = trackingAssignedTotal > 0 ? trackingAssignedTotal : fallbackOrderQty;
      const cutQuantity = Math.max(0, trackingCutTotal);

      const key = `${parsed.orderId}:${parsed.itemId}`;
      const bucket = workOrderMap.get(key) || [];
      bucket.push({
        orderNo: workOrder.orderNo,
        quantity: fallbackOrderQty,
        assignedToCutting,
        cutQuantity,
        receivedAtWarehouse: workOrder.centralWarehouseReceived ? fallbackOrderQty : 0,
      });
      workOrderMap.set(key, bucket);
    });

    const rows: ReportRow[] = [];

    const productCodes = Array.from(
      new Set(
        customerOrders.flatMap((order) =>
          order.items
            .map((item) => String(item.productCode || '').trim())
            .filter((code) => code.length > 0)
        )
      )
    );

    const products =
      productCodes.length > 0
        ? await prisma.product.findMany({
            where: {
              modelNo: {
                in: productCodes,
              },
            },
            select: {
              modelNo: true,
              name: true,
            },
          })
        : [];

    const productNameByCode = new Map<string, string>();
    products.forEach((product) => {
      const key = normalizeModelCode(product.modelNo);
      const name = String(product.name || '').trim();
      if (key && name) {
        productNameByCode.set(key, name);
      }
    });

    customerOrders.forEach((order) => {
      order.items.forEach((item) => {
        const key = `${order.id}:${item.id}`;
        const linkedWorkOrders = workOrderMap.get(key) || [];

        const assignedToCutting = linkedWorkOrders.reduce(
          (sum, workOrder) => sum + Number(workOrder.assignedToCutting || 0),
          0
        );
        const cutQuantity = linkedWorkOrders.reduce(
          (sum, workOrder) => sum + Number(workOrder.cutQuantity || 0),
          0
        );
        const receivedAtWarehouse = linkedWorkOrders.reduce(
          (sum, workOrder) => sum + Number(workOrder.receivedAtWarehouse || 0),
          0
        );
        const orderQuantity = Number(item.quantity || 0);
        const remainingQuantity = Math.max(orderQuantity - receivedAtWarehouse, 0);
        const normalizedCode = normalizeModelCode(item.productCode);
        const productName =
          productNameByCode.get(normalizedCode) ||
          String(item.description || '').trim() ||
          '-';

        rows.push({
          customerName: order.customer?.name || '-',
          customerOrderId: order.id,
          customerOrderNo: order.orderNo,
          itemId: item.id,
          productCode: item.productCode || '-',
          productName,
          color: item.color || '-',
          orderQuantity: round3(orderQuantity),
          assignedToCutting: round3(assignedToCutting),
          cutQuantity: round3(cutQuantity),
          remainingQuantity: round3(remainingQuantity),
          workOrderNos: linkedWorkOrders.map((workOrder) => workOrder.orderNo),
        });
      });
    });

    const summary = {
      totalRows: rows.length,
      totalOrderQuantity: round3(rows.reduce((sum, row) => sum + row.orderQuantity, 0)),
      totalAssignedToCutting: round3(rows.reduce((sum, row) => sum + row.assignedToCutting, 0)),
      totalCutQuantity: round3(rows.reduce((sum, row) => sum + row.cutQuantity, 0)),
      totalRemainingQuantity: round3(rows.reduce((sum, row) => sum + row.remainingQuantity, 0)),
    };

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      summary,
      rows,
    });
  } catch (error) {
    console.error('Order cutting report API error:', error);
    return res.status(500).json({ error: 'Rapor olusturulamadi' });
  }
}
