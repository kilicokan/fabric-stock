import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { withCors } from "@/lib/cors";
import { requireApiAuth } from "@/lib/api-auth";
import { checkLicense, createLicenseSignature } from "@/lib/license";

type ActivateBody = {
  key?: unknown;
  plan?: unknown;
  status?: unknown;
  expiresAt?: unknown;
  graceUntil?: unknown;
  maxUsers?: unknown;
  features?: unknown;
  signature?: unknown;
};

const ALLOWED_STATUSES = new Set(["TRIAL", "ACTIVE", "GRACE", "EXPIRED", "SUSPENDED", "REVOKED"]);
const LICENSE_KEY_REGEX = /^[A-Za-z0-9._-]{8,128}$/;
const SIGNATURE_FEATURE_KEY = "__signature";

function parseDateInput(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseFeatureInput(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
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

function parseMaxUsersInput(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return null;
  return Math.floor(numberValue);
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

  const body = (req.body || {}) as ActivateBody;
  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!key) {
    return res.status(400).json({ message: "License key is required" });
  }
  if (!LICENSE_KEY_REGEX.test(key)) {
    return res.status(400).json({ message: "License key format is invalid" });
  }

  const rawStatus = typeof body.status === "string" ? body.status.trim().toUpperCase() : "ACTIVE";
  const status = ALLOWED_STATUSES.has(rawStatus) ? rawStatus : "ACTIVE";

  const plan = typeof body.plan === "string" && body.plan.trim() ? body.plan.trim() : "PRO";
  const expiresAt = parseDateInput(body.expiresAt);
  const graceUntil = parseDateInput(body.graceUntil);
  const maxUsers = parseMaxUsersInput(body.maxUsers);
  if (body.maxUsers !== undefined && body.maxUsers !== null && body.maxUsers !== "" && maxUsers === null) {
    return res.status(400).json({ message: "maxUsers must be a positive integer" });
  }

  const parsedFeatures = parseFeatureInput(body.features) || {
    stock: true,
    fason: true,
    mobile: true,
  };
  const cleanFeatures = sanitizeFeaturePayload(parsedFeatures);
  const providedSignature =
    typeof body.signature === "string" && body.signature.trim() ? body.signature.trim().toLowerCase() : "";

  const expectedSignature = createLicenseSignature({
    key,
    plan,
    status,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    graceUntil: graceUntil ? graceUntil.toISOString() : null,
    maxUsers,
    features: cleanFeatures,
  });

  if (providedSignature && expectedSignature && providedSignature !== expectedSignature) {
    return res.status(400).json({ message: "Provided signature does not match payload" });
  }

  const finalSignature = providedSignature || expectedSignature;
  if (isSignatureRequired() && !finalSignature) {
    return res.status(500).json({ message: "License signature is required but signing secret is missing" });
  }

  const features: Record<string, unknown> = {
    ...cleanFeatures,
  };
  if (finalSignature) {
    features[SIGNATURE_FEATURE_KEY] = finalSignature;
  }

  try {
    const licenseModel = (prisma as any).license;
    const eventModel = (prisma as any).licenseEvent;

    if (!licenseModel || typeof licenseModel.upsert !== "function") {
      return res.status(500).json({ message: "License model is not available. Run migrations first." });
    }

    const license = await licenseModel.upsert({
      where: { key },
      update: {
        plan,
        status,
        expiresAt,
        graceUntil,
        maxUsers,
        features,
        lastValidatedAt: new Date(),
      },
      create: {
        key,
        plan,
        status,
        expiresAt,
        graceUntil,
        maxUsers,
        features,
        lastValidatedAt: new Date(),
      },
    });

    if (eventModel && typeof eventModel.create === "function") {
      await eventModel.create({
        data: {
          licenseId: license.id,
          eventType: "ACTIVATE",
          message: "License activated or updated",
          createdBy: auth.token.id,
          payload: {
            status,
            plan,
            expiresAt: expiresAt ? expiresAt.toISOString() : null,
            graceUntil: graceUntil ? graceUntil.toISOString() : null,
            maxUsers,
            signature: finalSignature || null,
          },
        },
      });
    }

    const evaluated = await checkLicense();
    return res.status(200).json({
      message: "License activated",
      license,
      evaluation: evaluated,
    });
  } catch (error) {
    console.error("License activation error:", error);
    return res.status(500).json({ message: "License activation failed" });
  }
};

export default withCors(handler);
