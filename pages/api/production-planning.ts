import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";

type MaterialPlanRow = {
  resourceType: "FABRIC" | "ACCESSORY";
  resourceId: number;
  resourceName: string;
  unit: string;
  requiredQuantity: number;
  stockQuantity: number;
  netQuantity: number;
  purchaseQuantity: number;
  orders: string[];
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const [orders, products, fabrics, accessories] = await Promise.all([
      prisma.customerOrder.findMany({
        include: {
          customer: true,
          items: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.findMany({
        include: {
          recipes: {
            include: {
              fabric: true,
              accessory: true,
            },
          },
        },
      }),
      prisma.fabric.findMany(),
      prisma.accessory.findMany(),
    ]);

    const productMap = new Map(products.map((product) => [product.modelNo, product]));
    const stockMap = new Map<string, { stockQuantity: number; name: string; unit: string }>();

    fabrics.forEach((fabric) => {
      stockMap.set(`FABRIC_${fabric.id}`, {
        stockQuantity: Number(fabric.stockQuantity) || 0,
        name: fabric.name,
        unit: fabric.unit || "m",
      });
    });

    accessories.forEach((accessory) => {
      stockMap.set(`ACCESSORY_${accessory.id}`, {
        stockQuantity: Number(accessory.stockQuantity) || 0,
        name: accessory.name,
        unit: accessory.unit,
      });
    });

    const planningMap = new Map<string, MaterialPlanRow>();

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const product = productMap.get(item.productCode);
        if (!product) return;

        product.recipes.forEach((recipe) => {
          const resourceId =
            recipe.resourceType === "FABRIC" ? recipe.fabricId : recipe.accessoryId;

          if (!resourceId) return;

          const stockKey = `${recipe.resourceType}_${resourceId}`;
          const stockInfo = stockMap.get(stockKey);
          const resourceName =
            recipe.resourceType === "FABRIC"
              ? recipe.fabric?.name || stockInfo?.name || "Kumaş"
              : recipe.accessory?.name || stockInfo?.name || "Aksesuar";
          const requiredQuantity = Number(item.quantity) * Number(recipe.quantityPerUnit);

          const existing = planningMap.get(stockKey);

          if (existing) {
            existing.requiredQuantity += requiredQuantity;
            if (!existing.orders.includes(order.orderNo)) {
              existing.orders.push(order.orderNo);
            }
          } else {
            planningMap.set(stockKey, {
              resourceType: recipe.resourceType as "FABRIC" | "ACCESSORY",
              resourceId,
              resourceName,
              unit: recipe.unit || stockInfo?.unit || "m",
              requiredQuantity,
              stockQuantity: stockInfo?.stockQuantity || 0,
              netQuantity: 0,
              purchaseQuantity: 0,
              orders: [order.orderNo],
            });
          }
        });
      });
    });

    const rows = Array.from(planningMap.values())
      .map((row) => {
        const netQuantity = row.stockQuantity - row.requiredQuantity;
        return {
          ...row,
          netQuantity,
          purchaseQuantity: netQuantity < 0 ? Math.abs(netQuantity) : 0,
        };
      })
      .sort((a, b) => a.resourceName.localeCompare(b.resourceName, "tr"));

    return res.status(200).json({
      rows,
      summary: {
        totalRows: rows.length,
        shortageCount: rows.filter((row) => row.purchaseQuantity > 0).length,
      },
    });
  } catch (error: any) {
    console.error("Production planning API error:", error);
    return res.status(500).json({ message: "Planlama verileri alınamadı", error: error.message });
  }
}
