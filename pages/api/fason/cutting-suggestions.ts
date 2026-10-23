import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";

type ReadinessStatus = "READY" | "WAITING_STOCK" | "MISSING_RECIPE" | "ALREADY_ASSIGNED";

type RequirementRow = {
  resourceType: "FABRIC" | "ACCESSORY";
  resourceId: number;
  resourceName: string;
  unit: string;
  requiredQuantity: number;
  availableStockAtEvaluation: number;
  incomingByDelivery: number;
  allocatedFromStock: number;
  allocatedFromIncoming: number;
  shortageQuantity: number;
};

type SuggestionRow = {
  workOrderId: number;
  orderNo: string;
  productCode: string;
  productName: string;
  color: string;
  customerName: string;
  quantity: number;
  status: string;
  deliveryDate: string | null;
  readiness: ReadinessStatus;
  isSuggested: boolean;
  reason: string;
  alreadyAssignedToCutting: boolean;
  requirements: RequirementRow[];
};

type IncomingSupplyEvent = {
  date: Date;
  remainingQuantity: number;
};

type ProductRecipeRecord = {
  resourceType: "FABRIC" | "ACCESSORY";
  fabricId: number | null;
  accessoryId: number | null;
  quantityPerUnit: number;
  unit: string;
  fabric: { id: number; name: string; unit: string } | null;
  accessory: { id: number; name: string; unit: string } | null;
};

type ProductRecord = {
  modelNo: string;
  name: string;
  recipes: ProductRecipeRecord[];
};

const round3 = (value: number): number => Number(value.toFixed(3));

const buildResourceKey = (resourceType: "FABRIC" | "ACCESSORY", resourceId: number) =>
  `${resourceType}_${resourceId}`;

const extractOrderItemIdFromExternalRef = (externalRef?: string | null): number | null => {
  if (!externalRef) return null;
  const match = externalRef.match(/customer-order:\d+:item:(\d+)/i);
  if (!match?.[1]) return null;
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const extractColorFromNotes = (notes?: string | null): string => {
  if (!notes) return "";
  const match = notes.match(/Renk:\s*([^|]+)/i);
  return match?.[1]?.trim() || "";
};

const isValidPositive = (value: unknown): value is number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
};

const compareWorkOrders = (a: { deliveryDate: Date | null; createdAt: Date }, b: { deliveryDate: Date | null; createdAt: Date }) => {
  if (a.deliveryDate && b.deliveryDate) {
    const diff = a.deliveryDate.getTime() - b.deliveryDate.getTime();
    if (diff !== 0) return diff;
  } else if (a.deliveryDate && !b.deliveryDate) {
    return -1;
  } else if (!a.deliveryDate && b.deliveryDate) {
    return 1;
  }

  return a.createdAt.getTime() - b.createdAt.getTime();
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const now = new Date();

    const [workOrders, fabrics, accessories, pastEntriesAgg, futureFabricEntries, exitsAgg] = await Promise.all([
      prisma.workOrder.findMany({
        where: {
          status: { not: "TESLIM_EDILDI" },
        },
        include: {
          fasonTrackings: {
            select: {
              id: true,
              processType: true,
              status: true,
              assignedQuantity: true,
              workshopId: true,
            },
          },
        },
      }),
      prisma.fabric.findMany({
        select: {
          id: true,
          name: true,
          unit: true,
          stockQuantity: true,
        },
      }),
      prisma.accessory.findMany({
        select: {
          id: true,
          name: true,
          unit: true,
          stockQuantity: true,
        },
      }),
      prisma.fabricEntry.groupBy({
        by: ["fabricId"],
        where: {
          entryDate: { lte: now },
        },
        _sum: {
          quantityKg: true,
        },
      }),
      prisma.fabricEntry.findMany({
        where: {
          entryDate: { gt: now },
        },
        select: {
          fabricId: true,
          quantityKg: true,
          entryDate: true,
        },
        orderBy: {
          entryDate: "asc",
        },
      }),
      prisma.fabricExit.groupBy({
        by: ["fabricType"],
        where: {
          createdAt: { lte: now },
          fabricType: { not: null },
        },
        _sum: {
          productWeightKg: true,
        },
      }),
    ]);

    const orderItemIds = Array.from(
      new Set(workOrders.map((order) => extractOrderItemIdFromExternalRef(order.externalErpId)).filter((id): id is number => Boolean(id)))
    );
    const orderItems =
      orderItemIds.length > 0
        ? await prisma.customerOrderItem.findMany({
            where: { id: { in: orderItemIds } },
            select: { id: true, color: true },
          })
        : [];
    const orderItemColorMap = new Map(orderItems.map((item) => [item.id, item.color || ""]));

    const productCodes = Array.from(new Set(workOrders.map((order) => order.productCode).filter(Boolean)));

    const products: ProductRecord[] =
      productCodes.length > 0
        ? await prisma.product.findMany({
            where: {
              modelNo: { in: productCodes },
            },
            select: {
              modelNo: true,
              name: true,
              recipes: {
                select: {
                  resourceType: true,
                  fabricId: true,
                  accessoryId: true,
                  quantityPerUnit: true,
                  unit: true,
                  fabric: {
                    select: {
                      id: true,
                      name: true,
                      unit: true,
                    },
                  },
                  accessory: {
                    select: {
                      id: true,
                      name: true,
                      unit: true,
                    },
                  },
                },
              },
            },
          })
        : [];

    const productMap = new Map(products.map((product) => [product.modelNo, product]));
    const entriesByFabricId = new Map(pastEntriesAgg.map((entry) => [entry.fabricId, Number(entry._sum.quantityKg || 0)]));
    const exitsByFabricName = new Map(
      exitsAgg.map((entry) => [entry.fabricType || "", Number(entry._sum.productWeightKg || 0)])
    );

    const remainingStock = new Map<string, number>();
    const incomingByResource = new Map<string, IncomingSupplyEvent[]>();

    fabrics.forEach((fabric) => {
      const hasMovements = entriesByFabricId.has(fabric.id) || exitsByFabricName.has(fabric.name);
      const movementBasedStock = Number(entriesByFabricId.get(fabric.id) || 0) - Number(exitsByFabricName.get(fabric.name) || 0);
      const staticStock = Number(fabric.stockQuantity) || 0;
      const effectiveStock = Math.max(hasMovements ? movementBasedStock : staticStock, 0);

      remainingStock.set(buildResourceKey("FABRIC", fabric.id), round3(effectiveStock));
    });

    accessories.forEach((accessory) => {
      const stock = Math.max(Number(accessory.stockQuantity) || 0, 0);
      remainingStock.set(buildResourceKey("ACCESSORY", accessory.id), round3(stock));
    });

    futureFabricEntries.forEach((entry) => {
      if (!isValidPositive(entry.quantityKg)) return;
      const resourceKey = buildResourceKey("FABRIC", entry.fabricId);
      const existingEvents = incomingByResource.get(resourceKey);
      const nextEvent: IncomingSupplyEvent = {
        date: new Date(entry.entryDate),
        remainingQuantity: round3(Number(entry.quantityKg)),
      };

      if (existingEvents) {
        existingEvents.push(nextEvent);
      } else {
        incomingByResource.set(resourceKey, [nextEvent]);
      }
    });

    const sortedWorkOrders = [...workOrders].sort(compareWorkOrders);
    const rows: SuggestionRow[] = [];

    for (const workOrder of sortedWorkOrders) {
      const product = productMap.get(workOrder.productCode);
      const deliveryDate = workOrder.deliveryDate ? new Date(workOrder.deliveryDate) : null;
      const orderItemId = extractOrderItemIdFromExternalRef(workOrder.externalErpId);
      const color = (orderItemId ? orderItemColorMap.get(orderItemId) : "") || extractColorFromNotes(workOrder.notes) || "";
      const activeCuttingTrackings = workOrder.fasonTrackings.filter(
        (tracking) => tracking.processType === "KESIM" && tracking.status !== "IPTAL_EDILDI"
      );
      const alreadyAssignedToCutting = activeCuttingTrackings.length > 0;

      if (!product) {
        rows.push({
          workOrderId: workOrder.id,
          orderNo: workOrder.orderNo,
          productCode: workOrder.productCode,
          productName: workOrder.productName || workOrder.productCode,
          color,
          customerName: workOrder.customerName || "",
          quantity: workOrder.quantity,
          status: workOrder.status,
          deliveryDate: deliveryDate ? deliveryDate.toISOString() : null,
          readiness: "MISSING_RECIPE",
          isSuggested: false,
          reason: "Urun karti bulunamadi. Is emri urun kodu ile urun karti model no eslesmiyor olabilir.",
          alreadyAssignedToCutting,
          requirements: [],
        });
        continue;
      }

      if (!Array.isArray(product.recipes) || product.recipes.length === 0) {
        rows.push({
          workOrderId: workOrder.id,
          orderNo: workOrder.orderNo,
          productCode: workOrder.productCode,
          productName: workOrder.productName || product.name || workOrder.productCode,
          color,
          customerName: workOrder.customerName || "",
          quantity: workOrder.quantity,
          status: workOrder.status,
          deliveryDate: deliveryDate ? deliveryDate.toISOString() : null,
          readiness: "MISSING_RECIPE",
          isSuggested: false,
          reason: "Urun recetesi tanimli degil.",
          alreadyAssignedToCutting,
          requirements: [],
        });
        continue;
      }

      const requirementMap = new Map<string, Omit<RequirementRow, "availableStockAtEvaluation" | "incomingByDelivery" | "allocatedFromStock" | "allocatedFromIncoming" | "shortageQuantity">>();

      product.recipes.forEach((recipe) => {
        const resourceId = recipe.resourceType === "FABRIC" ? recipe.fabricId : recipe.accessoryId;
        if (!resourceId) return;

        const requiredQuantity = Number(workOrder.quantity) * Number(recipe.quantityPerUnit || 0);
        if (!isValidPositive(requiredQuantity)) return;

        const key = buildResourceKey(recipe.resourceType as "FABRIC" | "ACCESSORY", resourceId);
        const existing = requirementMap.get(key);
        const resourceName =
          recipe.resourceType === "FABRIC"
            ? recipe.fabric?.name || "Kumas"
            : recipe.accessory?.name || "Aksesuar";
        const resourceUnit =
          recipe.unit ||
          (recipe.resourceType === "FABRIC" ? recipe.fabric?.unit : recipe.accessory?.unit) ||
          "kg";

        if (existing) {
          existing.requiredQuantity = round3(existing.requiredQuantity + requiredQuantity);
        } else {
          requirementMap.set(key, {
            resourceType: recipe.resourceType as "FABRIC" | "ACCESSORY",
            resourceId,
            resourceName,
            unit: resourceUnit,
            requiredQuantity: round3(requiredQuantity),
          });
        }
      });

      const requirements: RequirementRow[] = [];

      Array.from(requirementMap.values()).forEach((requirement) => {
        const resourceKey = buildResourceKey(requirement.resourceType, requirement.resourceId);
        const availableStockAtEvaluation = round3(Math.max(remainingStock.get(resourceKey) || 0, 0));
        const incomingEvents = incomingByResource.get(resourceKey) || [];
        const incomingByDelivery =
          requirement.resourceType === "FABRIC" && deliveryDate
            ? round3(
                incomingEvents
                  .filter((event) => event.date.getTime() <= deliveryDate.getTime())
                  .reduce((sum, event) => sum + event.remainingQuantity, 0)
              )
            : 0;

        let allocatedFromStock = Math.min(availableStockAtEvaluation, requirement.requiredQuantity);
        allocatedFromStock = round3(Math.max(allocatedFromStock, 0));
        remainingStock.set(resourceKey, round3(Math.max(availableStockAtEvaluation - allocatedFromStock, 0)));

        let remainingNeed = round3(Math.max(requirement.requiredQuantity - allocatedFromStock, 0));
        let allocatedFromIncoming = 0;

        if (remainingNeed > 0 && requirement.resourceType === "FABRIC" && deliveryDate) {
          for (const event of incomingEvents) {
            if (event.date.getTime() > deliveryDate.getTime()) continue;
            if (remainingNeed <= 0) break;
            if (event.remainingQuantity <= 0) continue;

            const fromThisEvent = Math.min(event.remainingQuantity, remainingNeed);
            if (fromThisEvent <= 0) continue;

            event.remainingQuantity = round3(Math.max(event.remainingQuantity - fromThisEvent, 0));
            allocatedFromIncoming = round3(allocatedFromIncoming + fromThisEvent);
            remainingNeed = round3(Math.max(remainingNeed - fromThisEvent, 0));
          }
        }

        const shortageQuantity = round3(Math.max(requirement.requiredQuantity - allocatedFromStock - allocatedFromIncoming, 0));

        requirements.push({
          ...requirement,
          availableStockAtEvaluation,
          incomingByDelivery,
          allocatedFromStock,
          allocatedFromIncoming,
          shortageQuantity,
        });
      });

      const hasShortage = requirements.some((requirement) => requirement.shortageQuantity > 0);
      let readiness: ReadinessStatus = hasShortage ? "WAITING_STOCK" : "READY";
      let reason = hasShortage
        ? "Stok veya termin acisindan tum malzemeler henuz yeterli degil."
        : "Kesime vermek icin malzeme yeterli.";

      if (requirements.length === 0) {
        readiness = "MISSING_RECIPE";
        reason = "Recete satirlari eksik veya gecersiz.";
      }

      if (alreadyAssignedToCutting) {
        readiness = "ALREADY_ASSIGNED";
        reason = "Bu is emri daha once kesim surecine atanmis.";
      }

      rows.push({
        workOrderId: workOrder.id,
        orderNo: workOrder.orderNo,
        productCode: workOrder.productCode,
        productName: workOrder.productName || product.name || workOrder.productCode,
        color,
        customerName: workOrder.customerName || "",
        quantity: workOrder.quantity,
        status: workOrder.status,
        deliveryDate: deliveryDate ? deliveryDate.toISOString() : null,
        readiness,
        isSuggested: readiness === "READY",
        reason,
        alreadyAssignedToCutting,
        requirements,
      });
    }

    const summary = {
      total: rows.length,
      ready: rows.filter((row) => row.readiness === "READY").length,
      waitingStock: rows.filter((row) => row.readiness === "WAITING_STOCK").length,
      missingRecipe: rows.filter((row) => row.readiness === "MISSING_RECIPE").length,
      alreadyAssigned: rows.filter((row) => row.readiness === "ALREADY_ASSIGNED").length,
    };

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      summary,
      rows,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Cutting suggestions API error:", error);
    return res.status(500).json({
      message: "Kesim onerileri olusturulamadi",
      error: message,
    });
  }
}
