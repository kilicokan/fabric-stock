import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { withCors } from "@/lib/cors";
import { requireApiAuth } from "@/lib/api-auth";
import { checkLicense } from "@/lib/license";

type RevokeBody = {
  key?: unknown;
  status?: unknown;
  reason?: unknown;
};

const REVOKE_STATUSES = new Set(["SUSPENDED", "REVOKED", "EXPIRED"]);
const LICENSE_KEY_REGEX = /^[A-Za-z0-9._-]{8,128}$/;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const auth = await requireApiAuth(req, res, { requiredRole: "ADMIN" });
  if (!auth) return;

  const body = (req.body || {}) as RevokeBody;
  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!key) {
    return res.status(400).json({ message: "License key is required" });
  }
  if (!LICENSE_KEY_REGEX.test(key)) {
    return res.status(400).json({ message: "License key format is invalid" });
  }

  const rawStatus = typeof body.status === "string" ? body.status.trim().toUpperCase() : "REVOKED";
  const status = REVOKE_STATUSES.has(rawStatus) ? rawStatus : "REVOKED";
  const reasonRaw = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "Manual revoke";
  const reason = reasonRaw.length > 300 ? reasonRaw.slice(0, 300) : reasonRaw;

  try {
    const licenseModel = (prisma as any).license;
    const eventModel = (prisma as any).licenseEvent;

    if (!licenseModel || typeof licenseModel.update !== "function") {
      return res.status(500).json({ message: "License model is not available. Run migrations first." });
    }

    const license = await licenseModel.update({
      where: { key },
      data: {
        status,
        lastValidatedAt: new Date(),
      },
    });

    if (eventModel && typeof eventModel.create === "function") {
      await eventModel.create({
        data: {
          licenseId: license.id,
          eventType: "REVOKE",
          message: reason,
          createdBy: auth.token.id,
          payload: {
            status,
          },
        },
      });
    }

    const evaluated = await checkLicense();
    return res.status(200).json({
      message: "License updated",
      license,
      evaluation: evaluated,
    });
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";

    if (code === "P2025") {
      return res.status(404).json({ message: "License not found" });
    }

    console.error("License revoke error:", error);
    return res.status(500).json({ message: "License revoke failed" });
  }
};

export default withCors(handler);
