// pages/api/mobile-orders/send-email.ts
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import nodemailer from "nodemailer";
type OrderItemRecord = {
  description?: string | null;
  productCode?: string | null;
  quantity: number;
  unitPrice?: number | null;
  totalPrice?: number | null;
};

type OrderRecord = {
  customer?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  items: OrderItemRecord[];
};

type PrismaMobileOrderEmail = {
  customerOrder: {
    findFirst(args: unknown): Promise<OrderRecord | null>;
  };
};

const db = prisma as unknown as PrismaMobileOrderEmail;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error";

// Configure your email service
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { orderNo, customerEmail } = req.body;

    if (!orderNo || !customerEmail) {
      return res
        .status(400)
        .json({ message: "Sipariş no ve email adresi gerekli" });
    }

    // Fetch order from database
    const order = await db.customerOrder.findFirst({
      where: { orderNo },
      include: {
        customer: true,
        items: true,
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Sipariş bulunamadı" });
    }

    // Format email content
    const itemsHtml = order.items
      .map(
        (item: OrderItemRecord) => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${item.description || item.productCode}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${item.quantity}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${item.unitPrice?.toFixed(2) || "0.00"} TL</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${item.totalPrice?.toFixed(2) || "0.00"} TL</td>
      </tr>
    `
      )
      .join("");

    const total = order.items.reduce(
      (sum: number, item: OrderItemRecord) => sum + (item.totalPrice || 0),
      0
    );

    const htmlContent = `
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #0066CC; color: white; padding: 20px; border-radius: 8px; }
            .order-details { margin: 20px 0; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th { background-color: #f5f5f5; border: 1px solid #ddd; padding: 8px; text-align: left; }
            td { border: 1px solid #ddd; padding: 8px; }
            .total { text-align: right; font-weight: bold; font-size: 18px; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Sipariş Detayı</h1>
              <p>Sipariş No: ${orderNo}</p>
            </div>

            <div class="order-details">
              <h3>Müşteri Bilgileri</h3>
              <p>
                <strong>Ad:</strong> ${order.customer?.name || "N/A"}<br>
                <strong>Telefon:</strong> ${order.customer?.phone || "N/A"}<br>
                <strong>Email:</strong> ${order.customer?.email || "N/A"}
              </p>
            </div>

            <h3>Ürünler</h3>
            <table>
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th style="text-align: right;">Miktar</th>
                  <th style="text-align: right;">Birim Fiyat</th>
                  <th style="text-align: right;">Toplam</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div class="total">
              Genel Toplam: ${total.toFixed(2)} TL
            </div>

            <p style="margin-top: 30px; color: #666; font-size: 12px;">
              Bu email otomatik olarak oluşturulmuştur. Lütfen değiştirmeyin.
            </p>
          </div>
        </body>
      </html>
    `;

    // Send email
    await transporter.sendMail({
      from: process.env.SMTP_FROM || "noreply@mirastok.com",
      to: customerEmail,
      subject: `Sipariş Detayı - ${orderNo}`,
      html: htmlContent,
    });

    res
      .status(200)
      .json({ message: "Email başarıyla gönderildi", orderNo });
  } catch (error: unknown) {
    console.error("Error sending email:", error);
    res.status(500).json({
      message: "Email gönderilemedi",
      error: getErrorMessage(error),
    });
  }
}
