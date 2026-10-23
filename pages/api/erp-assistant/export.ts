import type { NextApiRequest, NextApiResponse } from "next";
import { verifyToken } from "@/lib/auth";

type ExportRequestBody = {
  type?: "stock_xlsx" | "stock_pdf" | "order_cutting";
  params?: Record<string, unknown>;
};

const buildStockXlsx = (params?: Record<string, unknown>): string => {
  const qs = new URLSearchParams();
  if (params?.fabric && typeof params.fabric === "string") qs.set("fabric", params.fabric);
  if (params?.startDate && typeof params.startDate === "string") qs.set("startDate", params.startDate);
  if (params?.endDate && typeof params.endDate === "string") qs.set("endDate", params.endDate);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return `/api/reports/stock${suffix}`;
};

const buildStockPdf = (params?: Record<string, unknown>): string => {
  const qs = new URLSearchParams();
  if (params?.fabric && typeof params.fabric === "string") qs.set("fabric", params.fabric);
  if (params?.startDate && typeof params.startDate === "string") qs.set("startDate", params.startDate);
  if (params?.endDate && typeof params.endDate === "string") qs.set("endDate", params.endDate);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return `/api/reports/stock?format=pdf${suffix}`;
};

const resolveExportActions = (type: string | undefined, params?: Record<string, unknown>) => {
  if (type === "stock_xlsx") {
    return [
      {
        type: "download",
        url: buildStockXlsx(params),
        label: "Stok Raporunu Excel Olarak Indir",
      },
    ];
  }

  if (type === "stock_pdf") {
    return [
      {
        type: "download",
        url: buildStockPdf(params),
        label: "Stok Raporunu PDF Olarak Indir",
      },
    ];
  }

  if (type === "order_cutting") {
    return [
      {
        type: "navigate",
        path: "/reports/order-cutting",
        label: "Kesim Raporu",
      },
    ];
  }

  return [
    {
      type: "navigate",
      path: "/reports/stock",
      label: "Raporlar Sayfasina Git",
    },
  ];
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Yalnizca POST metodu destekleniyor" });
  }

  if (!verifyToken(req.headers.authorization)) {
    return res.status(401).json({ error: "Giris gerekli" });
  }

  try {
    const body = req.body as ExportRequestBody;
    const exportType = typeof body?.type === "string" ? body.type : undefined;
    const params = body?.params && typeof body.params === "object" ? body.params : undefined;

    const actions = resolveExportActions(exportType, params);

    return res.status(200).json({
      data: {
        type: "actions",
        message: exportType ? "Rapor hazirlaniyor, indirme baglantisi asagida." : "Lutfen rapor turunu secin.",
        actions,
      },
    });
  } catch (error) {
    console.error("ERP Export error:", error);
    return res.status(500).json({ error: "Rapor hazirlanirken hata olustu" });
  }
}
