// pages/api/customer-orders/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import pool from "@/utils/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    try {
      const customerOrders = await pool.customerOrder.findMany({
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
        orderBy: {
          createdAt: "desc",
        },
      });
      res.status(200).json(customerOrders);
    } catch (error: any) {
      console.error("PostgreSQL GET error:", error);
      res.status(500).json({ message: "Müşteri siparişleri alınamadı", error: error.message });
    }
  }

  else if (req.method === "POST") {
    const { orderNo, customerId, items } = req.body;

    if (!orderNo || !customerId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Sipariş no, müşteri ve en az bir ürün zorunludur" });
    }

    try {
      const customerOrder = await pool.customerOrder.create({
        data: {
          orderNo,
          customerId: parseInt(customerId),
          items: {
            create: items.map((item: any) => ({
              productCode: item.productCode,
              color: item.color,
              description: item.description || null,
              notes: item.notes || null,
              quantity: parseFloat(item.quantity),
              unit: item.unit || null,
              deliveryDate: item.deliveryDate ? new Date(item.deliveryDate) : null,
              unitPrice: parseFloat(item.unitPrice),
              totalPrice: parseFloat(item.totalPrice),
            })),
          },
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

      res.status(201).json(customerOrder);
    } catch (error: any) {
      console.error("PostgreSQL POST error:", error);
      res.status(500).json({ message: "Müşteri siparişi eklenemedi", error: error.message });
    }
  }

  else if (req.method === "PUT") {
    const { id, orderNo, customerId, items } = req.body;

    if (!id || !orderNo || !customerId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "ID, sipariş no, müşteri ve en az bir ürün zorunludur" });
    }

    try {
      // Delete existing items and create new ones
      await pool.customerOrderItem.deleteMany({
        where: { orderId: parseInt(id) },
      });

      const customerOrder = await pool.customerOrder.update({
        where: { id: parseInt(id) },
        data: {
          orderNo,
          customerId: parseInt(customerId),
          items: {
            create: items.map((item: any) => ({
              productCode: item.productCode,
              color: item.color,
              description: item.description || null,
              notes: item.notes || null,
              quantity: parseFloat(item.quantity),
              unit: item.unit || null,
              deliveryDate: item.deliveryDate ? new Date(item.deliveryDate) : null,
              unitPrice: parseFloat(item.unitPrice),
              totalPrice: parseFloat(item.totalPrice),
            })),
          },
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

      res.status(200).json(customerOrder);
    } catch (error: any) {
      console.error("PostgreSQL PUT error:", error);
      res.status(500).json({ message: "Müşteri siparişi güncellenemedi", error: error.message });
    }
  }

  else if (req.method === "DELETE") {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ message: "ID zorunludur" });
    }

    try {
      await pool.customerOrder.delete({
        where: { id: parseInt(id) },
      });

      res.status(200).json({ message: "Müşteri siparişi başarıyla silindi" });
    } catch (error: any) {
      console.error("PostgreSQL DELETE error:", error);
      res.status(500).json({ message: "Müşteri siparişi silinemedi", error: error.message });
    }
  }

  else {
    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    res.status(405).json({ message: "Method not allowed" });
  }
}
