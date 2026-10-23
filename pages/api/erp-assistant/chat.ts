import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

type AssistantAction =
  | { type: "download_excel"; url: string; label: string }
  | { type: "download_pdf"; url: string; label: string }
  | { type: "navigate"; path: string; label: string };

type AssistantResponse = {
  type: "text";
  text: string;
  suggestions?: string[];
  actions?: AssistantAction[];
};

type ChatRequestBody = {
  query?: string;
  context?: { path?: string; filters?: Record<string, unknown> };
};

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

const buildStockResponse = async (term: string, onlyOutOfStock = false): Promise<{ text: string }> => {
  const where = term
    ? {
        name: { contains: term, mode: "insensitive" as const },
        ...(onlyOutOfStock ? { stockQuantity: { lte: 0 } } : {}),
      }
    : onlyOutOfStock
      ? { stockQuantity: { lte: 0 } }
      : undefined;

  const fabrics = await prisma.fabric.findMany({
    where,
    include: { warehouse: { select: { name: true } } },
    orderBy: onlyOutOfStock ? { stockQuantity: "asc" } : { stockQuantity: "desc" },
    take: 30,
  });

  if (fabrics.length === 0) {
    return { text: onlyOutOfStock ? "Stogu biten kumas bulunamadi." : "Kumas stogu bulunamadi." };
  }

  const lines = fabrics.map((f) => {
    const wh = f.warehouse?.name || "-";
    return `- ${f.name} (${f.code || "kod yok"}): ${f.stockQuantity} ${f.unit || "kg"} | Depo: ${wh}`;
  });

  return {
    text: onlyOutOfStock
      ? `Stogu biten kumaslar (${fabrics.length}):\n${lines.join("\n")}`
      : `Bulunan kumas stoklari (${fabrics.length}):\n${lines.join("\n")}`,
  };
};

const buildOrderResponse = async (term: string, scope: "all" | "customer" | "fabric"): Promise<{ text: string }> => {
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
    return { text: "Siparis bulunamadi." };
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

  return { text: parts.join("\n") };
};

const buildWorkOrderResponse = async (term: string): Promise<{ text: string }> => {
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
    return { text: "Is emru bulunamadi." };
  }

  return {
    text: `Bulunan is emirleri (${orders.length}):\n${orders
      .map(
        (o) =>
          `- ${o.orderNo} | ${o.productCode} - ${o.productName || "?"} | Musteri: ${o.customerName || "-"} | Miktar: ${o.quantity} | Durum: ${formatStatus(o.status)} | Atanan: ${o.assignedUser?.name || "-"} | ${new Date(o.createdAt).toLocaleDateString("tr-TR")}`
      )
      .join("\n")}`,
  };
};

const buildCuttingOrderResponse = async (term: string): Promise<{ text: string }> => {
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
    return { text: "Kesim emri bulunamadi." };
  }

  return {
    text: `Bulunan kesim emirleri (${exits.length}):\n${exits
      .map(
        (e) =>
          `- ${e.orderNo} | Model: ${e.modelNo} (${e.modelName || "-"}) | Rapor: ${e.reportNumber || "-"} | Kat: ${e.layerCount} | Masaya: ${e.cuttingTable?.name || "-"} | ${new Date(e.createdAt).toLocaleDateString("tr-TR")}`
      )
      .join("\n")}`,
  };
};

const buildProductionResponse = async (): Promise<{ text: string }> => {
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
  parts.push(...Object.entries(statusCounts).map(([s, c]) => `  - ${s}: ${c}`));
  parts.push(`\nAktif kesim/cikislar: ${fabricExits.length}`);
  parts.push(`Aksesuar siparisleri: ${accessoryOrders.length}`);

  return { text: parts.join("\n") };
};

const buildFasonWorkshopResponse = async (term: string): Promise<{ text: string }> => {
  const where = term ? { name: { contains: term, mode: "insensitive" as const } } : undefined;

  const workshops = await prisma.fasonWorkshop.findMany({
    where,
    orderBy: { name: "asc" },
    take: 20,
  });

  if (workshops.length === 0) {
    return { text: "Atolye bulunamadi." };
  }

  const lines = workshops.map((w) => {
    const capacity = w.capacityType === "TL" ? `${w.capacity} TL` : `${w.capacity} adet`;
    return `- ${w.name} | Kapasite: ${capacity} | Bakiye: ${w.balance}`;
  });

  return { text: `Atolyeler (${workshops.length}):\n${lines.join("\n")}` };
};

const buildVehicleResponse = async (term: string): Promise<{ text: string }> => {
  const where = term ? { licensePlate: { contains: term, mode: "insensitive" as const } } : undefined;

  const vehicles = await prisma.vehicle.findMany({
    where,
    include: {
      assignedUser: { select: { name: true } },
      locations: { orderBy: { timestamp: "desc" }, take: 1 },
    },
    orderBy: { licensePlate: "asc" },
    take: 20,
  });

  if (vehicles.length === 0) {
    return { text: "Arac bulunamadi." };
  }

  const lines = vehicles.map((v) => {
    const lastLocation = (v as Record<string, unknown>).locations?.[0];
    const locationText = lastLocation
      ? `Son konum: ${(lastLocation.latitude as number).toFixed(4)}, ${(lastLocation.longitude as number).toFixed(4)}`
      : "Konum bilgisi yok";
    const driver = (v as any).assignedUser?.name || "Atanmadi";
    return `- ${v.licensePlate} | Surucu: ${driver} | ${locationText}`;
  });

  return { text: `Araclar (${vehicles.length}):\n${lines.join("\n")}` };
};

const resolveRuleBasedIntent = async (message: string): Promise<AssistantResponse> => {
  const term = message.trim().toLocaleLowerCase("tr");
  const suggestions = [
    "Stok sorgula",
    "Siparis ara",
    "Is emru listele",
    "Kesim emirleri",
    "Uretim durumu",
    "Atolyeler",
    "Araclar",
  ];

  const normalized = term
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/\s+/gi, " ")
    .trim();

  const includes = (values: string[]) => values.some((v) => normalized.includes(v));

  if (includes(["stok", "kumas stok"]) && includes(["rapor", "excel", "pdf", "yazdir", "yazdır"])) {
    const cleaned = normalized.replace(/(stok|kumas|rapor|excel|pdf|yazdir|yazdır|sorgula)/gi, "").trim();
    const stockResult = await buildStockResponse(cleaned);
    return {
      type: "text",
      text: stockResult.text || "Stok raporu icin asagidaki sayfayi kullanabilirsiniz:",
      suggestions: ["Siparis ara", "Is emru listele"],
      actions: [
        {
          type: "navigate",
          path: "/reports/stock",
          label: "Stok Raporu",
        },
      ],
    };
  }

  if (includes(["stok", "depo", "kumas stok", "stok durumu", "kalan"])) {
    const cleaned = normalized
      .replace(/\b(stok(?:lar|ları|ları|da|de|ta|te|dan|den|tan|ten)?|stok durumu|depo|kuma(?:ş|s)?(?:lar|ları|ları)?|sorgula|sorgu|ara)\b/gi, "")
      .replace(/\s+/gi, " ")
      .trim();
    const isOutOfStockQuery = includes(["stoğu biten", "stok biten", "tukenmiş", "tükenmiş", "kalan yok"]);
    const stockResult = await buildStockResponse(cleaned, isOutOfStockQuery);
    return {
      type: "text",
      text: stockResult.text,
      suggestions: ["Siparis ara", "Is emru listele", "Uretim durumu"],
      actions: [
        {
          type: "navigate",
          path: "/reports/stock",
          label: "Stok Raporu",
        },
      ],
    };
  }

  if (includes(["kesim", "kesim emri", "cutting", "kesim rapor", "kesim listesi"])) {
    const cleaned = normalized.replace(/(kesim|emri|emir|ara|sorgula|durumu|cutting|rapor|listesi)/gi, "").trim();
    try {
      const result = await buildCuttingOrderResponse(cleaned);
      return {
        type: "text",
        text: result.text,
        suggestions: ["Is emru listele", "Stok sorgula", "Uretim durumu"],
      };
    } catch (error) {
      console.error("Kesim emri sorgulama hatasi:", error);
      return {
        type: "text",
        text: "Kesim emirleri saglanirken bir hata olustu. Lutfen sistem yoneticisine basvurun.",
        suggestions: ["Is emru listele", "Stok sorgula"],
      };
    }
  }

  if (includes(["musteri siparisi", "siparis", "siparis listesi", "siparis ara", "siparis durumu"])) {
    const scope = includes(["kumas siparis", "tedarik siparis"]) ? "fabric" : "customer";
    const cleaned = normalized
      .replace(/(musteri|siparis|sorgula|ara|durumu|listesi|kumas|tedarik)/gi, "")
      .trim();
    const result = await buildOrderResponse(cleaned, scope);
    return { type: "text", text: result.text, suggestions: ["Is emru listele", "Kesim emirleri", "Stok sorgula"] };
  }

  if (includes(["is emru", "is emri", "work order", "proje", "uretim"])) {
    const cleaned = normalized.replace(/(is|emru|emri|listele|ara|durumu|proje|uretim)/gi, "").trim();
    const result = await buildWorkOrderResponse(cleaned);
    return { type: "text", text: result.text, suggestions: ["Kesim emirleri", "Siparis ara", "Uretim durumu"] };
  }

  if (includes(["uretim durumu", "ureticim durum", "genel durum", "ozet", "rapor", "dashboard"])) {
    const result = await buildProductionResponse();
    return { type: "text", text: result.text, suggestions: ["Stok sorgula", "Is emru listele", "Siparis ara"] };
  }

  if (includes(["atolye", "fason", "workshop"])) {
    const cleaned = normalized.replace(/\b(atolye|fason|workshop|gecikme|gecen|geciken|gecikmeli|backorder|kalan|tamamlanmamis)\b/gi, "").trim();
    if (includes(["gecikme", "gecen", "geciken", "gecikmeli", "backorder", "kalan", "tamamlanmamis"])) {
      return {
        type: "text",
        text: "Bu sistemde atolye/ise emir gecikme takibi henuz mevcut degil.",
        suggestions: ["Is emru listele", "Kesim emirleri", "Uretim durumu"],
      };
    }
    const result = await buildFasonWorkshopResponse(cleaned);
    return {
      type: "text",
      text: result.text,
      suggestions: ["Is emru listele", "Stok sorgula", "Araclar"],
      actions: [
        {
          type: "navigate",
          path: "/fason/workshops",
          label: "Atolyeleri Goruntule",
        },
      ],
    };
  }

  if (includes(["arac", "araclar", "tasima", "arac durumu", "arac konum", "tasit"])) {
    const cleaned = normalized.replace(/(arac|araclar|tasima|arac durumu|arac konum|tasit)/gi, "").trim();
    const result = await buildVehicleResponse(cleaned);
    return {
      type: "text",
      text: result.text,
      suggestions: ["Atolyeler", "Is emru listele", "Stok sorgula"],
      actions: [
        {
          type: "navigate",
          path: "/vehicles",
          label: "Araclari Goruntule",
        },
      ],
    };
  }

  return {
    type: "text",
    text:
      "Anlamadim. Lutfen kullanici dostu komutlar deneyin:\n" +
      "- Stok sorgula (kumas stoklari)\n" +
      "- Siparis ara / musteri siparisi / kumas siparisi\n" +
      "- Is emru listele\n" +
      "- Kesim emirleri\n" +
      "- Uretim durumu\n" +
      "- Atolyeler (fason atolye durumu)\n" +
      "- Araclar (tasit/arac durumu ve konum)",
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
    const body = req.body as ChatRequestBody;
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    const context = body?.context;

    if (!query) {
      return res.status(400).json({ error: "Soru bos olamaz" });
    }

    const pageContext = typeof context?.path === "string" && context.path.trim() ? context.path.trim() : null;

    const combinedMessage =
      pageContext && !/\b(stok|siparis|is emri|kesim|uretim|atolye)\b/.test(query.toLowerCase())
        ? `${query} (kullanici suanda ${pageContext} sayfasinda)`
        : query;

    const ruleResult = await resolveRuleBasedIntent(combinedMessage);

    res.status(200).json({ data: ruleResult });
  } catch (error) {
    console.error("ERP Chat error:", error);
    res.status(500).json({ error: "Istek islenirken hata olustu" });
  }
}
