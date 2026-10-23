import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

type DefectiveStockItem = {
  id: number;
  fabricId: number;
  fabricName: string;
  color: string;
  colorId?: number | null;
  defectiveQuantity: number;
  unit: string;
  supplierCode?: string | null;
  supplierName?: string | null;
  createdAt: string;
};

type CreateReturnInput = {
  fabricId: number;
  quantityKg?: number;
  quantityM?: number;
  reason?: string;
  documentType?: "irsaliye" | "fatura";
  documentNumber: string;
  date: string;
  supplierCode?: string;
  supplierName?: string;
  entryWarehouseCode?: string;
  exitWarehouseCode?: string;
  total?: number;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = verifyToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({
    where: { id: token.id },
    select: { stockAccess: true, fasonAccess: true },
  });

  if (!user?.stockAccess && !user?.fasonAccess) {
    return res.status(403).json({ message: "Forbidden: access denied" });
  }

  if (req.method === "GET") {
    try {
      const { returnId } = req.query;

      if (returnId && typeof returnId === "string") {
        const parsedId = Number(returnId);
        console.log("DEFECTIVE_STOCK_GET_RETURN_ID", returnId, "parsed", parsedId);

        if (!Number.isInteger(parsedId) || parsedId <= 0) {
          return res.status(400).json({ message: "Geçersiz belge numarası." });
        }

        let returnRecord: any = null;
        try {
          returnRecord = await prisma.fabricReturn.findUnique({
            where: { id: parsedId },
            include: {
              fabric: {
                select: {
                  id: true,
                  name: true,
                  unit: true,
                },
              },
              relatedDocument: true,
            },
          }) as Awaited<ReturnType<typeof prisma.fabricReturn.findUnique>> & { 
            fabric: { id: number; name: string; unit: string | null } | null; 
            relatedDocument: { supplierCode: string | null; supplierName: string | null } | null; 
          };
        } catch (queryError) {
          console.error("Defective stock GET return query error:", queryError);
          return res.status(500).json({ message: "İade kaydı alınamadı." });
        }

        if (!returnRecord) {
          return res.status(404).json({ message: "İade kaydı bulunamadı." });
        }

        const supplierName = returnRecord.relatedDocument?.supplierName || returnRecord.fabric?.supplierName || "-";
        const supplierCode = returnRecord.relatedDocument?.supplierCode || returnRecord.fabric?.supplierCode || "-";

        return res.status(200).json({
          return: returnRecord,
          document: returnRecord.relatedDocument,
          supplierName,
          supplierCode,
        });
      }

      const fabricsWithDefects = await prisma.fabric.findMany({
        where: { defectiveQuantity: { gt: 0 } },
        select: {
          id: true,
          name: true,
          unit: true,
          defectiveQuantity: true,
        },
      });

      const items: DefectiveStockItem[] = fabricsWithDefects.map((fabric) => ({
        id: fabric.id,
        fabricId: fabric.id,
        fabricName: fabric.name,
        color: "Belirtilmedi",
        defectiveQuantity: fabric.defectiveQuantity,
        unit: fabric.unit || "kg",
        supplierCode: null,
        supplierName: null,
        createdAt: new Date().toISOString(),
      }));

      return res.status(200).json(items);
    } catch (error) {
      console.error("Defective stock GET error:", error);
      return res.status(500).json({ message: "Hatalı stok listesi alınamadı" });
    }
  }

  if (req.method === "POST") {
    const body = req.body as CreateReturnInput;

    const quantityKg = Number(body.quantityKg || 0);
    const quantityM = Number(body.quantityM || 0);
    const returnedQuantity = quantityKg > 0 ? quantityKg : quantityM;

    console.log("DEFECTIVE_STOCK_POST_BODY", JSON.stringify(body));
    console.log("DEFECTIVE_STOCK_POST_VALUES", JSON.stringify({ quantityKg, quantityM, returnedQuantity, documentNumber: body.documentNumber, date: body.date, fabricId: body.fabricId }));

    if (!body.fabricId || returnedQuantity <= 0) {
      return res.status(400).json({ message: "Geçersiz iade miktarı." });
    }

    if (!body.documentNumber || !body.date) {
      return res.status(400).json({ message: "Belge numarası ve tarih zorunludur." });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const fabric = await tx.fabric.findUnique({
          where: { id: Number(body.fabricId) },
          select: { id: true, defectiveQuantity: true, name: true, unit: true },
        });

        if (!fabric) {
          return { error: "Kumaş bulunamadı.", status: 404 as const };
        }

        if (returnedQuantity > fabric.defectiveQuantity) {
          return {
            error: `İade miktarı hatalı stoktan fazla (mevcut: ${fabric.defectiveQuantity})`,
            status: 400 as const,
          };
        }

        const documentNumber = String(body.documentNumber).trim();
        const existingDoc = await tx.fabricDocument.findFirst({
          where: { number: documentNumber },
          select: { id: true },
        });

        let documentId = existingDoc?.id;
        if (!documentId) {
          const doc = await tx.fabricDocument.create({
            data: {
              type: body.documentType || "irsaliye",
              number: documentNumber,
              date: new Date(body.date),
              customer: body.supplierName || "-",
              warehouse: body.entryWarehouseCode || "-",
              total: Number(body.total) || 0,
              supplierCode: body.supplierCode || null,
              supplierName: body.supplierName || null,
              entryWarehouseCode: body.entryWarehouseCode || null,
              exitWarehouseCode: body.exitWarehouseCode || null,
              fabricId: Number(body.fabricId),
              quantity: returnedQuantity,
              unitType: fabric.unit?.toLowerCase().startsWith("m") ? "m" : "kg",
            },
          });
          documentId = doc.id;
        }

        const shouldDecreaseStock = (body.documentType || "irsaliye") === "irsaliye";

        let updatedFabric = fabric;
        if (shouldDecreaseStock) {
          updatedFabric = await tx.fabric.update({
            where: { id: Number(body.fabricId) },
            data: {
              defectiveQuantity: {
                decrement: returnedQuantity,
              },
            },
            select: { id: true, name: true, unit: true, defectiveQuantity: true },
          });
        }

        const fabricReturn = await tx.fabricReturn.create({
          data: {
            fabricId: Number(body.fabricId),
            quantityKg: returnedQuantity,
            reason: body.reason || "İade",
            relatedDocumentId: documentId,
          },
        });

        return {
          data: {
            return: fabricReturn,
            fabric: { ...fabric, defectiveQuantity: updatedFabric.defectiveQuantity },
            documentId,
            decreasedStock: shouldDecreaseStock,
          },
          status: 201 as const,
        };
      });

      if ("error" in result) {
        return res.status(result.status).json({ message: result.error });
      }

      return res.status(result.status).json(result.data);
    } catch (error) {
      console.error("Defective return POST error:", error);
      return res.status(500).json({ message: "İade işlemi başarısız" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ message: "Method not allowed" });
}
