import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { withCors } from "@/lib/cors";
import { requireApiAuth } from "@/lib/api-auth";

function toLimit(raw: unknown): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 25;
  if (value > 100) return 100;
  return Math.floor(value);
}

function toPositiveInt(raw: unknown, fallback: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

function normalizeText(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

function toOffset(raw: unknown): number | null {
  const text = normalizeText(raw);
  if (!text) return null;

  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.floor(value);
}

function toOptionalInt(raw: unknown): number | null {
  const text = normalizeText(raw);
  if (!text) return null;

  const value = Number(text);
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) return null;
  return value;
}

function parseDateFilter(raw: unknown, endOfDay = false): Date | null {
  const text = normalizeText(raw);
  if (!text) return null;

  const value = new Date(text);
  if (Number.isNaN(value.getTime())) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    if (endOfDay) {
      value.setHours(23, 59, 59, 999);
    } else {
      value.setHours(0, 0, 0, 0);
    }
  }

  return value;
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const auth = await requireApiAuth(req, res, { requiredRole: "ADMIN" });
  if (!auth) return;

  try {
    const eventModel = (prisma as any).licenseEvent;
    if (!eventModel || typeof eventModel.findMany !== "function") {
      return res.status(500).json({ message: "LicenseEvent model is not available. Run migrations first." });
    }

    const key = normalizeText(req.query.key);
    const eventType = normalizeText(req.query.eventType).toUpperCase();
    const status = normalizeText(req.query.status).toUpperCase();
    const createdBy = toOptionalInt(req.query.createdBy);
    const from = parseDateFilter(req.query.from, false);
    const to = parseDateFilter(req.query.to, true);
    const limit = toLimit(req.query.limit);
    const queryPage = toPositiveInt(req.query.page, 1);
    const queryOffset = toOffset(req.query.offset);
    const skip = queryOffset ?? (queryPage - 1) * limit;
    const page = Math.floor(skip / limit) + 1;

    const where: Record<string, unknown> = {};

    const licenseWhere: Record<string, unknown> = {};
    if (key) {
      licenseWhere.key = key;
    }
    if (status) {
      licenseWhere.status = status;
    }
    if (Object.keys(licenseWhere).length) {
      where.license = licenseWhere;
    }

    if (eventType) {
      where.eventType = eventType;
    }

    if (createdBy !== null) {
      where.createdBy = createdBy;
    }

    if (from || to) {
      const createdAt: Record<string, Date> = {};
      if (from) createdAt.gte = from;
      if (to) createdAt.lte = to;
      where.createdAt = createdAt;
    }

    const whereClause = Object.keys(where).length ? where : undefined;

    const [total, events] = await Promise.all([
      eventModel.count({ where: whereClause }),
      eventModel.findMany({
        where: whereClause,
        include: {
          license: {
            select: {
              key: true,
              plan: true,
              status: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: limit,
      }),
    ]);

    const hasMore = skip + events.length < total;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return res.status(200).json({
      events,
      count: events.length,
      total,
      limit,
      page,
      pageSize: limit,
      offset: skip,
      hasMore,
      totalPages,
      filters: {
        key: key || null,
        eventType: eventType || null,
        status: status || null,
        createdBy,
        from: from ? from.toISOString() : null,
        to: to ? to.toISOString() : null,
        page,
        offset: skip,
      },
    });
  } catch (error) {
    console.error("License events error:", error);
    return res.status(500).json({ message: "Could not fetch license events" });
  }
};

export default withCors(handler);
