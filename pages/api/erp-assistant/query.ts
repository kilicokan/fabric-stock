import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

type QueryBody = {
  message?: string;
};

const normalize = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLocaleLowerCase("tr") : "";

const matchAny = (haystack: string, needles: string[]): boolean =>
  needles.some((needle) => haystack.includes(needle));

const formatStatus = (value?: string | null): string => {
  if (!value) return "-";
  const map: Record<string, string> = {
    BEKLIYOR: "Bekliyor",
    ALINDI: "Alindi",
    ATÖLYEDE: "Atolyede",
    HAZIR: "Hazir",
    TESLIM_EDILDI: "Teslim Edildi",
    SORUN_VAR: "Sorun Var",
    IPTAL_EDILDI: "Iptal Edildi",
  };
  return map[value.toUpperCase()] || value;
};

const buildStockResponse = async (term: string): Promise<string> => {
  const fabrics = await prisma.fabric.findMany({
    where: term ? { name: { contains: term, mode: "insensitive" } } : undefined,
    include: { warehouse: { select: { name: true } } },
    orderBy: { stockQuantity: "desc" },
    take: 20,
  });

  if (fabrics.length === 0) {
    return "Kumas stogu bulunamadi.";
  }

  const lines = fabrics.map((f) => {
    const wh = f.warehouse?.name || "-";
    return `- ${f.name} (${f.code || "kod yok"}): ${f.stockQuantity} ${f.unit || "kg"} | Depo: ${wh}`;
  });

  return `Bulunan kumas stoklari (${fabrics.length}):\n${lines.join("\n")}`;
};

const buildOrderResponse = async (term: string, scope: "all" | "customer" | "fabric"): Promise<string> => {
  let customerWhere: Parameters<typeof prisma.customerOrder.findMany>[0]["where"] | undefined;
  let fabricWhere: Parameters<typeof prisma.fabricOrder.findMany>[0]["where"] | undefined;

  if (term) {
    if (scope !== "fabric") {
      customerWhere = {
        OR: [
          { orderNo: { contains: term, mode: "insensitive" } },
          { customer: { name: { contains: term, mode: "insensitive" } } },
        ],
      };
    }
    if (scope !== "customer") {
      fabricWhere = {
        OR: [
          { fabric: { name: { contains: term, mode: "insensitive" } } },
          { supplier: { name: { contains: term, mode: "insensitive" } } },
        ],
      };
    }
  }

  const [customerOrders, fabricOrders] = await Promise.all([
    scope === "fabric"
      ? Promise.resolve([])
      : prisma.customerOrder.findMany({
          where: customerWhere,
          include: { customer: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
    scope === "customer"
      ? Promise.resolve([])
      : prisma.fabricOrder.findMany({
          where: fabricWhere,
          include: { fabric: { select: { name: true } }, supplier: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
  ]);

  if (customerOrders.length === 0 && fabricOrders.length === 0) {
    return "Siparis bulunamadi.";
  }

  const parts: string[] = [];
  if (customerOrders.length > 0) {
    parts.push(`Musteri siparisleri (${customerOrders.length}):`);
    parts.push(
      ...customerOrders.map(
        (o) =>
          `- ${o.orderNo} | Musteri: ${o.customer.name} | Durum: ${o.approved ? "Onayli" : "Onay Bekliyor"} | ${new Date(o.createdAt).toLocaleDateString("tr-TR")}`
      )
    );
  }
  if (fabricOrders.length > 0) {
    parts.push(`Kumas siparisleri (${fabricOrders.length}):`);
    parts.push(
      ...fabricOrders.map(
        (o) =>
          `- ${o.orderNumber} | Kumas: ${o.fabric.name} | Tedarikci: ${o.supplier.name} | Miktar: ${o.quantity} ${o.unitType} | Durum: ${o.status}`
      )
    );
  }

  return parts.join("\n");
};

const buildWorkOrderResponse = async (term: string): Promise<string> => {
  const where: Parameters<typeof prisma.workOrder.findMany>[0]["where"] = term
    ? {
        OR: [
          { orderNo: { contains: term, mode: "insensitive" } },
          { productCode: { contains: term, mode: "insensitive" } },
          { productName: { contains: term, mode: "insensitive" } },
          { customerName: { contains: term, mode: "insensitive" } },
        ],
      }
    : undefined;

  const orders = await prisma.workOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { assignedUser: { select: { name: true } } },
  });

  if (orders.length === 0) {
    return "Is emru bulunamadi.";
  }

  return `Bulunan is emirleri (${orders.length}):\n${orders
    .map(
      (o) =>
        `- ${o.orderNo} | ${o.productCode} - ${o.productName || "?"} | Musteri: ${o.customerName || "-"} | Miktar: ${o.quantity} | Durum: ${formatStatus(o.status)} | Atanan: ${o.assignedUser?.name || "-"} | ${new Date(o.createdAt).toLocaleDateString("tr-TR")}`
    )
    .join("\n")}`;
};

const buildCuttingOrderResponse = async (term: string): Promise<string> => {
  const where: Parameters<typeof prisma.fabricExit.findMany>[0]["where"] = term
    ? {
        OR: [
          { orderNo: { contains: term, mode: "insensitive" } },
          { modelNo: { contains: term, mode: "insensitive" } },
          { modelName: { contains: term, mode: "insensitive" } },
          { reportNumber: { contains: term, mode: "insensitive" } },
        ],
      }
    : undefined;

  const exits = await prisma.fabricExit.findMany({
    where,
    include: { cuttingTable: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  if (exits.length === 0) {
    return "Kesim emri bulunamadi.";
  }

  return `Bulunan kesim emirleri (${exits.length}):\n${exits
    .map(
      (e) =>
        `- ${e.orderNo} | Model: ${e.modelNo} (${e.modelName || "-"}) | Rapor: ${e.reportNumber || "-"} | Kat: ${e.layerCount} | Masaya: ${e.cuttingTable.name} | ${new Date(e.createdAt).toLocaleDateString("tr-TR")}`
    )
    .join("\n")}`;
};

const buildProductionResponse = async (): Promise<string> => {
  const [workOrders, fabricExits, accessoryOrders] = await Promise.all([
    prisma.workOrder.findMany({ take: 20, orderBy: { createdAt: "desc" } }),
    prisma.fabricExit.findMany({ take: 20, orderBy: { createdAt: "desc" } }),
    prisma.accessoryOrder.findMany({ take: 20, orderBy: { orderDate: "desc" } }),
  ]);

  const parts: string[] = [];

  const statusCounts = workOrders.reduce<Record<string, number>>((acc, o) => {
    const s = formatStatus(o.status);
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  parts.push(`Is emirleri toplam: ${workOrders.length}`);
  parts.push(
    ...Object.entries(statusCounts).map(([s, c]) => `  - ${s}: ${c}`)
  );

  parts.push(`\nAktif kesim/cikislar: ${fabricExits.length}`);
  parts.push(`Aksesuar siparisleri: ${accessoryOrders.length}`);

  return parts.join("\n");
};

const resolveIntent = async (message: string): Promise<{ intent: string; text: string; suggestions: string[] }> => {
  const term = normalize(message);
  const suggestions = [
    "Stok sorgula",
    "Siparis ara",
    "Is emri listele",
    "Kesim emirleri",
    "Uretim durumu",
  ];

  if (matchAny(term, ["yardim", "yardım", "help", "ne yapabilirsin", "komutlar", "yardimci"])) {
    return {
      intent: "yardim",
      text:
        "Elimdeki temel komutlar:\n" +
        "- Stok sorgula (kumas stoklari)\n" +
        "- Siparis ara / musteri siparisi / kumas siparisi\n" +
        "- Is emru listele\n" +
        "- Kesim emirleri\n" +
        "- Uretim durumu",
      suggestions,
    };
  }

  if (matchAny(term, ["stok", "depo", "kumas stok", "stok durumu", "kalan"])) {
    const text = await buildStockResponse(term.replace(/stok|sorgula|kalan|durumu/gi, "").trim());
    return { intent: "stok_sorgulama", text, suggestions: ["Siparis ara", "Is emru listele", "Uretim durumu"] };
  }

  if (matchAny(term, ["kesim", "kesim emri", "cutting"])) {
    const text = await buildCuttingOrderResponse(term.replace(/kesim|emri|emir|ara|sorgula|durumu/gi, "").trim());
    return { intent: "kesim_emri_sorgulama", text, suggestions: ["Is emru listele", "Stok sorgula", "Uretim durumu"] };
  }

  if (matchAny(term, ["musteri siparisi", "siparis", "siparis listesi", "siparis ara", "siparis durumu"])) {
    const scope = matchAny(term, ["kumas siparis", "tedarik siparis"]) ? "fabric" : "customer";
    const text = await buildOrderResponse(term.replace(/musteri|siparis|sorgula|ara|durumu|listesi|kumas|tedarik/gi, "").trim(), scope);
    return { intent: "siparis_sorgulama", text, suggestions: ["Is emru listele", "Kesim emirleri", "Stok sorgula"] };
  }

  if (matchAny(term, ["is emru", "is emri", "work order", "proje", "uretim"])) {
    const text = await buildWorkOrderResponse(term.replace(/is|emru|emri|listele|ara|durumu|proje|uretim/gi, "").trim());
    return { intent: "is_emri_sorgulama", text, suggestions: ["Kesim emirleri", "Siparis ara", "Uretim durumu"] };
  }

  if (matchAny(term, ["uretim durumu", "ureticim durum", "genel durum", "ozet", "rapor", "dashboard"])) {
    const text = await buildProductionResponse();
    return { intent: "rapor_hazirla", text, suggestions: ["Stok sorgula", "Is emru listele", "Siparis ara"] };
  }

  return {
    intent: "bilinmeyen",
    text:
      "Anlamadim. Lutfen kullanici dostu komutlar deneyin:\n" +
      "- Stok sorgula (kumas stoklari)\n" +
      "- Siparis ara / musteri siparisi / kumas siparisi\n" +
      "- Is emru listele\n" +
      "- Kesim emirleri\n" +
      "- Uretim durumu",
    suggestions,
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Yalnizca POST metodu destekleniyor" });
  }

  if (!verifyToken(req.headers.authorization)) {
    return res.status(401).json({ error: "Giris gerekli" });
  }

  try {
    const body = req.body as QueryBody;
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!message) {
      return res.status(400).json({ error: "Mesaj bos olamaz" });
    }

    const result = await resolveIntent(message);

    res.status(200).json({
      data: {
        intent: result.intent,
        message: result.text,
        suggestions: result.suggestions,
      },
    });
  } catch (error) {
    console.error("Gork error:", error);
    res.status(500).json({ error: "Istek islenirken hata olustu" });
  }
}
