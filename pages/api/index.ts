import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";

type CreateFabricExitBody = {
  modelNo?: string;
  modelName?: string;
  orderNo?: string;
  customerId?: string;
  layerCount?: number;
  productWeightKg?: number;
  weightKg?: number;
  productLengthMeter?: number;
  lengthMeter?: number;
  grammage?: number;
  unitType?: string;
  cuttingTableId?: number;
  fabricEntryId?: number;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiAuth(req, res, {
    requireLicense: true,
    feature: "stock",
  });
  if (!auth) return;

  if (req.method === "POST") {
    try {
      const body = (req.body || {}) as CreateFabricExitBody;

      const modelNo = String(body.modelNo || "").trim();
      const orderNo = String(body.orderNo || "").trim();
      const customerId = String(body.customerId || "").trim();
      const cuttingTableId = Number(body.cuttingTableId);

      if (!modelNo || !orderNo || !customerId || !Number.isInteger(cuttingTableId) || cuttingTableId <= 0) {
        return res.status(400).json({
          error: "modelNo, orderNo, customerId ve gecerli cuttingTableId zorunludur",
        });
      }

      const layerCount = Number.isFinite(Number(body.layerCount)) ? Number(body.layerCount) : 1;
      const productWeightKg = Number.isFinite(Number(body.productWeightKg))
        ? Number(body.productWeightKg)
        : Number.isFinite(Number(body.weightKg))
          ? Number(body.weightKg)
          : 0;
      const productLengthMeter = Number.isFinite(Number(body.productLengthMeter))
        ? Number(body.productLengthMeter)
        : Number.isFinite(Number(body.lengthMeter))
          ? Number(body.lengthMeter)
          : 0;
      const grammage = Number.isFinite(Number(body.grammage)) ? Number(body.grammage) : 0;
      const unitType = String(body.unitType || "kg");
      const fabricEntryIdRaw = Number(body.fabricEntryId);
      const fabricEntryId = Number.isInteger(fabricEntryIdRaw) && fabricEntryIdRaw > 0 ? fabricEntryIdRaw : null;

      const created = await prisma.fabricExit.create({
        data: {
          modelNo,
          modelName: body.modelName ? String(body.modelName) : null,
          orderNo,
          customerId,
          layerCount,
          productWeightKg,
          productLengthMeter,
          grammage,
          unitType,
          cuttingTableId,
          fabricEntryId,
        },
      });

      return res.status(201).json(created);
    } catch (error: unknown) {
      console.error("Fabric exit create error:", error);
      return res.status(500).json({ error: "Kayit eklenirken hata olustu" });
    }
  }

  if (req.method === "GET") {
    try {
      const exits = await prisma.fabricExit.findMany({
        include: {
          cuttingTable: true,
          fabricEntry: {
            include: {
              fabric: true,
              color: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return res.status(200).json(exits);
    } catch (error: unknown) {
      console.error("Fabric exit list error:", error);
      return res.status(500).json({ error: "Veriler alinirken hata olustu" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method not allowed" });
}
