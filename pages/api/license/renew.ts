import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { withCors } from "@/lib/cors";
import { requireApiAuth } from "@/lib/api-auth";
import { checkLicense, createLicenseSignature } from "@/lib/license";

type RenewBody = {
  key?: unknown;
  extendDays?: unknown;
  expiresAt?: unknown;
  graceDays?: unknown;
  plan?: unknown;
  maxUsers?: unknown;
  status?: unknown;
  features?: unknown;
  signature?: unknown;
};

const RENEW_ALLOWED_STATUSES = new Set(["ACTIVE", "TRIAL", "GRACE"]);
const LICENSE_KEY_REGEX = /^[A-Za-z0-9._-]{8,128}$/;
const SIGNATURE_FEATURE_KEY = "__signature";

function parseDateInput(value: unknown): Date | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parsePositiveInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function parseFeatureInput(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function sanitizeFeaturePayload(features: Record<string, unknown> | null): Record<string, unknown> {
  if (!features) return {};
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(features)) {
    if (key === "__signature" || key === "signature" || key === "licenseSignature") continue;
    sanitized[key] = value;
  }
  return sanitized;
}

function isSignatureRequired(): boolean {
  const configured = String(process.env.LICENSE_REQUIRE_SIGNATURE || "")
    .trim()
    .toLowerCase();
  if (!configured) return false;
  return ["1", "true", "yes", "on"].includes(configured);
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const auth = await requireApiAuth(req, res, { requiredRole: "ADMIN" });
  if (!auth) return;

  const body = (req.body || {}) as RenewBody;
  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!key) {
    return res.status(400).json({ message: "License key is required" });
  }
  if (!LICENSE_KEY_REGEX.test(key)) {
    return res.status(400).json({ message: "License key format is invalid" });
  }

  const extendDays = parsePositiveInt(body.extendDays);
  const requestedExpiresAt = parseDateInput(body.expiresAt);
  if (!requestedExpiresAt && !extendDays) {
    return res.status(400).json({ message: "Either expiresAt or extendDays must be provided" });
  }
  if (body.expiresAt !== undefined && body.expiresAt !== null && body.expiresAt !== "" && !requestedExpiresAt) {
    return res.status(400).json({ message: "expiresAt format is invalid" });
  }
  if (body.extendDays !== undefined && body.extendDays !== null && body.extendDays !== "" && !extendDays) {
    return res.status(400).json({ message: "extendDays must be a positive integer" });
  }

  const graceDays = parsePositiveInt(body.graceDays);
  if (body.graceDays !== undefined && body.graceDays !== null && body.graceDays !== "" && !graceDays) {
    return res.status(400).json({ message: "graceDays must be a positive integer" });
  }

  const maxUsers = parsePositiveInt(body.maxUsers);
  if (body.maxUsers !== undefined && body.maxUsers !== null && body.maxUsers !== "" && !maxUsers) {
    return res.status(400).json({ message: "maxUsers must be a positive integer" });
  }

  const rawStatus = typeof body.status === "string" ? body.status.trim().toUpperCase() : "ACTIVE";
  const status = RENEW_ALLOWED_STATUSES.has(rawStatus) ? rawStatus : "ACTIVE";
  const overridePlan = typeof body.plan === "string" && body.plan.trim() ? body.plan.trim() : null;
  const providedSignature =
    typeof body.signature === "string" && body.signature.trim() ? body.signature.trim().toLowerCase() : "";
  const overrideFeatures = parseFeatureInput(body.features);

  try {
    const licenseModel = (prisma as any).license;
    const eventModel = (prisma as any).licenseEvent;

    if (!licenseModel || typeof licenseModel.findUnique !== "function" || typeof licenseModel.update !== "function") {
      return res.status(500).json({ message: "License model is not available. Run migrations first." });
    }

    const existing = await licenseModel.findUnique({ where: { key } });
    if (!existing) {
      return res.status(404).json({ message: "License not found" });
    }

    const now = new Date();
    const currentExpiresAt =
      existing.expiresAt instanceof Date && !Number.isNaN(existing.expiresAt.getTime()) ? existing.expiresAt : null;
    const extensionBase = currentExpiresAt && currentExpiresAt > now ? currentExpiresAt : now;
    const expiresAt = requestedExpiresAt || new Date(extensionBase.getTime() + Number(extendDays || 0) * 86400000);

    if (expiresAt <= now) {
      return res.status(400).json({ message: "Renewal expiresAt must be in the future" });
    }

    const graceUntil = graceDays ? new Date(expiresAt.getTime() + graceDays * 86400000) : existing.graceUntil;
    const plan = overridePlan || (typeof existing.plan === "string" && existing.plan.trim() ? existing.plan : "PRO");
    const nextMaxUsers = maxUsers ?? (typeof existing.maxUsers === "number" ? existing.maxUsers : null);
    const featureBase =
      overrideFeatures ||
      (existing.features && typeof existing.features === "object" && !Array.isArray(existing.features)
        ? (existing.features as Record<string, unknown>)
        : null);
    const cleanFeatures = sanitizeFeaturePayload(featureBase);

    const expectedSignature = createLicenseSignature({
      key,
      plan,
      status,
      expiresAt: expiresAt.toISOString(),
      graceUntil: graceUntil ? graceUntil.toISOString() : null,
      maxUsers: nextMaxUsers,
      features: cleanFeatures,
    });

    if (providedSignature && expectedSignature && providedSignature !== expectedSignature) {
      return res.status(400).json({ message: "Provided signature does not match payload" });
    }

    const finalSignature = providedSignature || expectedSignature;
    if (isSignatureRequired() && !finalSignature) {
      return res.status(500).json({ message: "License signature is required but signing secret is missing" });
    }

    const features: Record<string, unknown> = { ...cleanFeatures };
    if (finalSignature) {
      features[SIGNATURE_FEATURE_KEY] = finalSignature;
    }

    const license = await licenseModel.update({
      where: { key },
      data: {
        status,
        plan,
        expiresAt,
        graceUntil,
        maxUsers: nextMaxUsers,
        features,
        lastValidatedAt: new Date(),
      },
    });

    if (eventModel && typeof eventModel.create === "function") {
      await eventModel.create({
        data: {
          licenseId: license.id,
          eventType: "RENEW",
          message: "License renewed",
          createdBy: auth.token.id,
          payload: {
            previousExpiresAt: currentExpiresAt ? currentExpiresAt.toISOString() : null,
            newExpiresAt: expiresAt.toISOString(),
            graceUntil: graceUntil ? graceUntil.toISOString() : null,
            extendDays: extendDays || null,
            plan,
            status,
            maxUsers: nextMaxUsers,
            signature: finalSignature || null,
          },
        },
      });
    }

    const evaluated = await checkLicense();
    return res.status(200).json({
      message: "License renewed",
      license,
      evaluation: evaluated,
    });
  } catch (error) {
    console.error("License renew error:", error);
    return res.status(500).json({ message: "License renew failed" });
  }
};

export default withCors(handler);
