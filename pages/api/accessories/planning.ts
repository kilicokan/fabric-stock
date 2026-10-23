import type { NextApiRequest, NextApiResponse } from "next";
import pool from "@/utils/db";

type FabricPlanningRow = {
  id: string;
  orderNo: string;
  modelAdi: string;
  miktar: number;
  musteri: string;
  malzemeAdi: string;
  gereken: number;
  saSiparisi: number;
  varyantAciklama: string;
  gelen: number;
  uretimeCikan: number;
  unit: string;
  fisBaglantilari: string[];
};

type ExitPoolLot = {
  refNo: string;
  remaining: number;
};

type FabricExitLite = {
  id: number;
  orderNo: string;
  modelNo: string;
  color: string | null;
  fabricType: string | null;
  reportNumber: string | null;
  productWeightKg: number;
  productLengthMeter: number;
};

type FabricOrderLite = {
  fabricId: number;
  colorName: string | null;
  unitType: string;
  quantity: number;
  status: string;
};

type FabricDocumentLite = {
  orderNo: string | null;
  fabricId: number | null;
  colorName: string | null;
  unitType: string | null;
  quantity: number;
};

const roundQuantity = (value: number): number => Number(value.toFixed(3));

const normalizeText = (value: string | null | undefined): string =>
  (value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ")
    .trim();

const normalizeColorTokens = (value: string | null | undefined): string[] =>
  normalizeText(value)
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);

const buildPoolKey = (
  orderKey: string,
  modelKey: string,
  fabricKey: string,
  colorKey: string,
  unit: "kg" | "m"
): string => `${orderKey}||${modelKey}||${fabricKey}||${colorKey}||${unit}`;

const resolveUnit = (recipeUnit: string | null | undefined, fabricUnit: string | null | undefined): "kg" | "m" => {
  const rawUnit = String(recipeUnit || fabricUnit || "m").toLowerCase().trim();
  return rawUnit === "kg" ? "kg" : "m";
};

const normalizeStatusForCompare = (value: string | null | undefined): string =>
  normalizeText(value).replace(/\u0131/g, "i");

const buildPurchaseOrderColorKey = (
  fabricId: number,
  unit: "kg" | "m",
  colorKey: string
): string => `${fabricId}||${unit}||${colorKey}`;

const buildPurchaseOrderTotalKey = (fabricId: number, unit: "kg" | "m"): string =>
  `${fabricId}||${unit}`;

const buildIncomingOrderColorKey = (
  orderKey: string,
  fabricId: number,
  unit: "kg" | "m",
  colorKey: string
): string => `${orderKey}||${fabricId}||${unit}||${colorKey}`;

const isMissingRelationError = (error: unknown, relationName: string): boolean => {
  if (!(error instanceof Error)) return false;

  const message = error.message;
  const lower = message.toLowerCase();
  const relationLower = relationName.toLowerCase();

  return (
    lower.includes("code: `42p01`") ||
    lower.includes("does not exist")
  ) && (
    lower.includes(`relation "${relationLower}"`) ||
    lower.includes(`relation '${relationLower}'`) ||
    lower.includes(`"${relationLower}"`) ||
    lower.includes(relationLower)
  );
};

const isMissingTableError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const lower = error.message.toLowerCase();

  return (
    lower.includes("code: `42p01`") ||
    lower.includes("relation") && lower.includes("does not exist") ||
    lower.includes("p2021")
  );
};

const buildEmptyPlanningResponse = () => ({
  rows: [],
  summary: {
    totalRows: 0,
    totalGereken: 0,
    totalSaSiparisi: 0,
    totalGelen: 0,
    totalUretimeCikan: 0,
  },
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const orders = await pool.customerOrder.findMany({
      include: {
        customer: {
          select: {
            name: true,
          },
        },
        items: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const orderNos = Array.from(new Set(orders.map((order) => order.orderNo).filter(Boolean)));
    const modelNos = Array.from(
      new Set(
        orders.flatMap((order) =>
          order.items.map((item) => item.productCode).filter((code): code is string => Boolean(code))
        )
      )
    );

    const products =
      modelNos.length > 0
        ? await pool.product.findMany({
            where: {
              modelNo: { in: modelNos },
            },
            select: {
              modelNo: true,
              name: true,
              recipes: {
                include: { accessory: true, },
              },
            },
          })
        : [];

    let fabricOrders: FabricOrderLite[] = [];
    try {
      fabricOrders = await pool.$queryRaw<FabricOrderLite[]>`
        SELECT
          fo."accessoryId" AS "fabricId",
          c."name" AS "colorName",
          fo."unitType",
          fo."quantity",
          fo."status"
        FROM "AccessoryOrder" fo
        LEFT JOIN "Color" c ON c."id" = fo."colorId"
      `;
    } catch (error: unknown) {
      if (isMissingRelationError(error, "AccessoryOrder")) {
        console.warn("AccessoryOrder tablosu bulunamadi, planlama siparis verisi bos kabul edildi.");
        fabricOrders = [];
      } else {
        throw error;
      }
    }

    const purchaseOrderByColor = new Map<string, number>();
    const purchaseOrderByTotal = new Map<string, number>();

    fabricOrders.forEach((order) => {
      const status = normalizeStatusForCompare(order.status);
      if (status === "iptal edildi") return;

      const fabricId = Number(order.fabricId) || 0;
      const quantity = roundQuantity(Number(order.quantity) || 0);
      if (!fabricId || quantity <= 0) return;

      const unit = resolveUnit(order.unitType, order.unitType);
      const colorKey = normalizeText(order.colorName) || "*";

      const colorMapKey = buildPurchaseOrderColorKey(fabricId, unit, colorKey);
      purchaseOrderByColor.set(
        colorMapKey,
        roundQuantity((purchaseOrderByColor.get(colorMapKey) || 0) + quantity)
      );

      const totalMapKey = buildPurchaseOrderTotalKey(fabricId, unit);
      purchaseOrderByTotal.set(
        totalMapKey,
        roundQuantity((purchaseOrderByTotal.get(totalMapKey) || 0) + quantity)
      );
    });

    let fabricDocuments: FabricDocumentLite[] = [];
    try {
      fabricDocuments = await pool.$queryRaw<FabricDocumentLite[]>`
        SELECT
          fd."orderNo",
          fd."accessoryId" AS "fabricId",
          c."name" AS "colorName",
          fd."unitType",
          fd."quantity"
        FROM "AccessoryDocument" fd
        LEFT JOIN "Color" c ON c."id" = fd."colorId"
        WHERE fd."quantity" > 0
      `;
    } catch (error: unknown) {
      if (isMissingRelationError(error, "AccessoryDocument")) {
        console.warn("AccessoryDocument tablosu bulunamadi, planlama gelen veri bos kabul edildi.");
        fabricDocuments = [];
      } else {
        throw error;
      }
    }

    const incomingByColor = new Map<string, number>();
    const incomingByTotal = new Map<string, number>();
    const incomingOrderColorRemaining = new Map<string, number>();

    fabricDocuments.forEach((document) => {
      const fabricId = Number(document.fabricId) || 0;
      const quantity = roundQuantity(Number(document.quantity) || 0);
      if (!fabricId || quantity <= 0) return;

      const unit = resolveUnit(document.unitType, document.unitType);
      const colorKey = normalizeText(document.colorName) || "*";
      const orderKey = normalizeText(document.orderNo) || "*";

      const purchaseColorKey = buildPurchaseOrderColorKey(fabricId, unit, colorKey);
      incomingByColor.set(
        purchaseColorKey,
        roundQuantity((incomingByColor.get(purchaseColorKey) || 0) + quantity)
      );

      const purchaseTotalKey = buildPurchaseOrderTotalKey(fabricId, unit);
      incomingByTotal.set(
        purchaseTotalKey,
        roundQuantity((incomingByTotal.get(purchaseTotalKey) || 0) + quantity)
      );

      const orderColorKey = buildIncomingOrderColorKey(orderKey, fabricId, unit, colorKey);
      incomingOrderColorRemaining.set(
        orderColorKey,
        roundQuantity((incomingOrderColorRemaining.get(orderColorKey) || 0) + quantity)
      );
    });

    const productMap = new Map(products.map((product) => [product.modelNo, product]));

    const exits: FabricExitLite[] =
      orderNos.length > 0 && modelNos.length > 0
        ? await pool.fabricExit.findMany({
            where: {
              orderNo: { in: orderNos },
              modelNo: { in: modelNos },
            },
            select: {
              id: true,
              orderNo: true,
              modelNo: true,
              color: true,
              fabricType: true,
              reportNumber: true,
              productWeightKg: true,
              productLengthMeter: true,
            },
            orderBy: {
              createdAt: "asc",
            },
          })
        : [];

    const exitPools = new Map<string, ExitPoolLot[]>();

    const appendExitPoolLot = (key: string, lot: ExitPoolLot): void => {
      const current = exitPools.get(key);
      if (current) {
        current.push(lot);
      } else {
        exitPools.set(key, [lot]);
      }
    };

    exits.forEach((exit) => {
      const orderKey = normalizeText(exit.orderNo);
      const modelKey = normalizeText(exit.modelNo);
      const fabricKey = normalizeText(exit.fabricType) || "*";
      const colorTokens = normalizeColorTokens(exit.color);
      const colorKeys = colorTokens.length === 1 ? colorTokens : ["*"];
      const refNo = exit.reportNumber?.trim() || `KESIM-${String(exit.id).padStart(6, "0")}`;

      const kgQuantity = roundQuantity(Number(exit.productWeightKg) || 0);
      const meterQuantity = roundQuantity(Number(exit.productLengthMeter) || 0);

      if (kgQuantity > 0) {
        colorKeys.forEach((colorKey) => {
          appendExitPoolLot(buildPoolKey(orderKey, modelKey, fabricKey, colorKey, "kg"), {
            refNo,
            remaining: kgQuantity,
          });
        });
      }

      if (meterQuantity > 0) {
        colorKeys.forEach((colorKey) => {
          appendExitPoolLot(buildPoolKey(orderKey, modelKey, fabricKey, colorKey, "m"), {
            refNo,
            remaining: meterQuantity,
          });
        });
      }
    });

    const consumeProduction = (params: {
      orderKey: string;
      modelKey: string;
      fabricKey: string;
      colorKey: string;
      unit: "kg" | "m";
      needed: number;
    }): { consumed: number; refs: string[] } => {
      let remainingNeeded = roundQuantity(params.needed);
      let consumed = 0;
      const usedRefs = new Set<string>();

      if (remainingNeeded <= 0) {
        return { consumed: 0, refs: [] };
      }

      const candidateKeys = Array.from(
        new Set([
          buildPoolKey(params.orderKey, params.modelKey, params.fabricKey, params.colorKey, params.unit),
          buildPoolKey(params.orderKey, params.modelKey, params.fabricKey, "*", params.unit),
          buildPoolKey(params.orderKey, params.modelKey, "*", params.colorKey, params.unit),
          buildPoolKey(params.orderKey, params.modelKey, "*", "*", params.unit),
        ])
      );

      for (const key of candidateKeys) {
        if (remainingNeeded <= 0) break;

        const lots = exitPools.get(key);
        if (!lots || lots.length === 0) continue;

        for (const lot of lots) {
          if (remainingNeeded <= 0) break;
          if (lot.remaining <= 0) continue;

          const take = Math.min(lot.remaining, remainingNeeded);
          if (take <= 0) continue;

          lot.remaining = roundQuantity(lot.remaining - take);
          remainingNeeded = roundQuantity(remainingNeeded - take);
          consumed = roundQuantity(consumed + take);
          usedRefs.add(lot.refNo);
        }
      }

      return {
        consumed: roundQuantity(consumed),
        refs: Array.from(usedRefs),
      };
    };

    const consumeIncomingByOrderAndColor = (params: {
      orderKey: string;
      fabricId: number;
      colorKey: string;
      unit: "kg" | "m";
      needed: number;
    }): number => {
      let remainingNeeded = roundQuantity(params.needed);
      let consumed = 0;

      if (remainingNeeded <= 0 || !params.fabricId) {
        return 0;
      }

      const candidateKeys = Array.from(
        new Set([
          buildIncomingOrderColorKey(params.orderKey, params.fabricId, params.unit, params.colorKey),
          buildIncomingOrderColorKey(params.orderKey, params.fabricId, params.unit, "*"),
          buildIncomingOrderColorKey("*", params.fabricId, params.unit, params.colorKey),
          buildIncomingOrderColorKey("*", params.fabricId, params.unit, "*"),
        ])
      );

      for (const key of candidateKeys) {
        if (remainingNeeded <= 0) break;

        const available = roundQuantity(incomingOrderColorRemaining.get(key) || 0);
        if (available <= 0) continue;

        const take = Math.min(available, remainingNeeded);
        if (take <= 0) continue;

        incomingOrderColorRemaining.set(key, roundQuantity(available - take));
        remainingNeeded = roundQuantity(remainingNeeded - take);
        consumed = roundQuantity(consumed + take);
      }

      return roundQuantity(consumed);
    };

    const rows: FabricPlanningRow[] = [];

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const product = productMap.get(item.productCode);
        if (!product || product.recipes.length === 0) return;

        product.recipes.forEach((recipe) => {
          if (recipe.resourceType !== "ACCESSORY") return;
          if (!recipe.accessory) return;

          const quantity = Number(item.quantity) || 0;
          const required = roundQuantity(quantity * Number(recipe.quantityPerUnit || 0));
          const fabricId = recipe.accessory.id;
          const unit = resolveUnit(recipe.unit, recipe.accessory.unit);
          const orderKey = normalizeText(order.orderNo);
          const rowColor = item.color || "";
          const varyantAciklama = [rowColor, item.description].filter(Boolean).join(" ") || "-";
          const colorKey = normalizeText(rowColor) || "*";
          const gelen = consumeIncomingByOrderAndColor({
            orderKey,
            fabricId,
            colorKey,
            unit,
            needed: required,
          });

          const purchaseOrderColorValue =
            purchaseOrderByColor.get(buildPurchaseOrderColorKey(fabricId, unit, colorKey)) || 0;
          const purchaseOrderTotalValue =
            purchaseOrderByTotal.get(buildPurchaseOrderTotalKey(fabricId, unit)) || 0;
          const incomingColorValue =
            incomingByColor.get(buildPurchaseOrderColorKey(fabricId, unit, colorKey)) || 0;
          const incomingTotalValue =
            incomingByTotal.get(buildPurchaseOrderTotalKey(fabricId, unit)) || 0;
          const remainingColor = roundQuantity(Math.max(purchaseOrderColorValue - incomingColorValue, 0));
          const remainingTotal = roundQuantity(Math.max(purchaseOrderTotalValue - incomingTotalValue, 0));
          const saSiparisi = roundQuantity(remainingColor > 0 ? remainingColor : remainingTotal);

          const { consumed, refs } = consumeProduction({
            orderKey,
            modelKey: normalizeText(product.modelNo),
            fabricKey: normalizeText(recipe.accessory.name) || "*",
            colorKey,
            unit,
            needed: required,
          });

          rows.push({
            id: `${order.id}-${item.id}-${recipe.id}`,
            orderNo: order.orderNo,
            modelAdi: product.name || product.modelNo,
            miktar: roundQuantity(quantity),
            musteri: order.customer?.name || "-",
            malzemeAdi: recipe.accessory.name,
            gereken: required,
            saSiparisi,
            varyantAciklama,
            gelen,
            uretimeCikan: consumed,
            unit,
            fisBaglantilari: refs,
          });
        });
      });
    });

    const remainingPurchaseByTotal = new Map<string, number>();
    purchaseOrderByTotal.forEach((purchaseValue, key) => {
      const incomingValue = incomingByTotal.get(key) || 0;
      remainingPurchaseByTotal.set(key, roundQuantity(Math.max(purchaseValue - incomingValue, 0)));
    });

    return res.status(200).json({
      rows,
      summary: {
        totalRows: rows.length,
        totalGereken: roundQuantity(rows.reduce((sum, row) => sum + row.gereken, 0)),
        totalSaSiparisi: roundQuantity(
          Array.from(remainingPurchaseByTotal.values()).reduce((sum, value) => sum + value, 0)
        ),
        totalGelen: roundQuantity(rows.reduce((sum, row) => sum + row.gelen, 0)),
        totalUretimeCikan: roundQuantity(rows.reduce((sum, row) => sum + row.uretimeCikan, 0)),
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Accessories planning API error:", error);

    if (isMissingTableError(error)) {
      console.warn("Planlama icin gereken bazi tablolar bulunamadi, bos sonuc donuldu.");
      return res.status(200).json({
        ...buildEmptyPlanningResponse(),
        warning: "Planlama tablolari eksik oldugu icin bos sonuc donuldu.",
      });
    }

    return res.status(500).json({ message: "Aksesuar planlama verileri alinamadi", error: errorMessage });
  }
}

