import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";
import { withCors } from "@/lib/cors";
import { parseStoredRoute, validateRouteSteps } from "@/lib/product-route";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiAuth(req, res, {
    requireLicense: true,
    feature: "stock",
  });
  if (!auth) return;

  if (req.method !== "PATCH" && req.method !== "GET") {
    res.setHeader("Allow", ["GET", "PATCH"]);
    return res.status(405).json({ message: "Yalnızca GET ve PATCH metodu destekleniyor." });
  }

  const productId = Number(req.query.id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ message: "Geçerli ürün ID zorunludur." });
  }

  try {
    const existing = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, routeSteps: true },
    });
    if (!existing) {
      return res.status(404).json({ message: "Ürün bulunamadı." });
    }

    if (req.method === "GET") {
      return res.status(200).json({
        product: { id: existing.id, routeSteps: parseStoredRoute(existing.routeSteps) },
      });
    }

    const validation = validateRouteSteps(req.body?.routeSteps);
    if (validation.valid === false) {
      return res.status(400).json({ message: validation.message });
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: { routeSteps: validation.steps },
      select: { id: true, routeSteps: true },
    });
    return res.status(200).json({ product });
  } catch (error) {
    console.error("Product route update failed:", error);
    return res.status(500).json({ message: "Ürün rotası kaydedilemedi." });
  }
}

export default withCors(handler);
