// pages/api/mobile-orders.ts
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
type CustomerRecord = {
  id: number;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
};

type MobileOrderItemInput = {
  modelNo: string;
  name: string;
  quantity: number;
  price: number;
};

type CustomerOrderRecord = {
  id: number;
  orderNo: string;
  createdAt: Date;
  customer?: CustomerRecord | null;
  items: MobileOrderItemInput[];
};

type PrismaMobileOrders = {
  customer: {
    findFirst(args: unknown): Promise<CustomerRecord | null>;
    create(args: unknown): Promise<CustomerRecord>;
  };
  customerOrder: {
    create(args: unknown): Promise<CustomerOrderRecord>;
  };
};

const db = prisma as unknown as PrismaMobileOrders;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    // Ürün listesi (KDV bilgisiyle birlikte)
    try {
      const { search } = req.query;
      
      const products = await prisma.product.findMany({
        where: search
          ? {
              OR: [
                { modelNo: { contains: search as string, mode: "insensitive" } },
                { name: { contains: search as string, mode: "insensitive" } },
              ],
            }
          : undefined,
        select: {
          id: true,
          modelNo: true,
          name: true,
          description: true,
          image: true,
          taxRate: {
            select: {
              id: true,
              name: true,
              rate: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 50, // Limit sonuçları
      });

      res.status(200).json(products);
    } catch (error: unknown) {
      console.error("Error fetching products:", error);
      res.status(500).json({
        message: "Ürünler alınamadı",
        error: getErrorMessage(error),
      });
    }
  } else if (req.method === "POST") {
    // Yeni sipariş oluştur (müşteri bilgileriyle)
    try {
      const {
        customerName,
        customerPhone,
        customerEmail,
        deliveryDate,
        notes,
        items,
        total,
      } = req.body;

      // Validate
      if (!customerName || !customerPhone || !items || items.length === 0) {
        return res.status(400).json({
          message: "Müşteri adı, telefon ve en az bir ürün zorunludur",
        });
      }

      // Generate order number
      const timestamp = Date.now();
      const orderNo = `MOBD-${new Date().toISOString().split("T")[0].replace(/-/g, "")}-${timestamp % 10000}`;

      // Find or create customer
      let customer = await db.customer.findFirst({
        where: {
          phone: customerPhone,
        },
      });

      if (!customer) {
        customer = await db.customer.create({
          data: {
            name: customerName,
            phone: customerPhone,
            email: customerEmail || null,
          },
        });
      }

      // Create order with items
      const order = await db.customerOrder.create({
        data: {
          orderNo,
          customerId: customer.id,
          items: {
            create: items.map((item: MobileOrderItemInput) => ({
              productCode: item.modelNo,
              description: item.name,
              quantity: item.quantity,
              unitPrice: item.price,
              totalPrice: item.quantity * item.price,
              deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
            })),
          },
          notes: notes || null,
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
          items: true,
        },
      });

      res.status(201).json({
        id: order.id,
        orderNo: order.orderNo,
        customerName: order.customer?.name,
        customerPhone: order.customer?.phone,
        customerEmail: order.customer?.email,
        total: total,
        itemCount: items.length,
        createdAt: order.createdAt,
      });
    } catch (error: unknown) {
      console.error("Error creating mobile order:", error);
      res.status(500).json({
        message: "Sipariş oluşturulamadı",
        error: getErrorMessage(error),
      });
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).json({ message: "Method not allowed" });
  }
}
