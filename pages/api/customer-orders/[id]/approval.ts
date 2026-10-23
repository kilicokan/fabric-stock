import type { NextApiRequest, NextApiResponse } from "next";
import pool from "@/utils/db";

const parseOrderId = (raw: string | string[] | undefined): number | null => {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", ["PATCH"]);
    return res.status(405).json({ message: "Method not allowed" });
  }

  const orderId = parseOrderId(req.query.id);
  if (!orderId) {
    return res.status(400).json({ message: "Gecerli siparis id gerekli" });
  }

  const approvedRaw = req.body?.approved;
  if (typeof approvedRaw !== "boolean") {
    return res.status(400).json({ message: "approved alani boolean olmali" });
  }

  try {
    const existingOrder = await pool.customerOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNo: true,
      },
    });

    if (!existingOrder) {
      return res.status(404).json({ message: "Siparis bulunamadi" });
    }

    const approvedAt = approvedRaw ? new Date() : null;
    const updatedRows = await pool.$queryRawUnsafe<
      Array<{ id: number; orderNo: string; approved: boolean; approvedAt: Date | null }>
    >(
      `UPDATE "CustomerOrder"
       SET "approved" = $1,
           "approvedAt" = $2,
           "updatedAt" = NOW()
       WHERE "id" = $3
       RETURNING "id", "orderNo", "approved", "approvedAt"`,
      approvedRaw,
      approvedAt,
      orderId
    );

    const updatedOrder = updatedRows[0] || {
      id: existingOrder.id,
      orderNo: existingOrder.orderNo,
      approved: approvedRaw,
      approvedAt,
    };

    return res.status(200).json({
      message: approvedRaw ? "Siparis onaylandi" : "Siparis onayi kaldirildi",
      data: updatedOrder,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Customer order approval update error:", error);
    return res.status(500).json({ message: "Siparis onayi guncellenemedi", error: message });
  }
}
