import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import type { TokenPayload } from "@/lib/auth";
import { verifyToken, verifyTokenFromCookie } from "@/lib/auth";
import { checkLicense, type LicenseCheckOptions, type LicenseCheckResult } from "@/lib/license";

type RequiredAccess = "stock" | "fason" | "mobile" | "both";

type UserAccessRecord = {
  id: number;
  role: string;
  stockAccess: boolean;
  fasonAccess: boolean;
  mobileAccess: boolean;
};

export interface RequireApiAuthOptions extends LicenseCheckOptions {
  requiredRole?: string | string[];
  requiredAccess?: RequiredAccess;
  requireLicense?: boolean;
}

export interface ApiAuthContext {
  token: TokenPayload;
  user: UserAccessRecord | null;
  license: LicenseCheckResult | null;
}

function normalizeRole(role: string | null | undefined): string {
  return (role || "").trim().toUpperCase();
}

function hasRequiredRole(tokenRole: string, requiredRole?: string | string[]): boolean {
  if (!requiredRole) return true;
  const tokenRoleNormalized = normalizeRole(tokenRole);
  const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  return requiredRoles.map((role) => normalizeRole(role)).includes(tokenRoleNormalized);
}

function canAccess(user: UserAccessRecord, requiredAccess: RequiredAccess): boolean {
  switch (requiredAccess) {
    case "stock":
      return user.stockAccess;
    case "fason":
      return user.fasonAccess;
    case "mobile":
      return user.mobileAccess;
    case "both":
      return user.stockAccess && user.fasonAccess;
    default:
      return true;
  }
}

function isMissingColumnError(error: unknown): boolean {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  const message = error instanceof Error ? error.message : String(error);
  return code === "P2022" || message.includes("does not exist");
}

async function loadUserAccess(userId: number): Promise<UserAccessRecord | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        stockAccess: true,
        fasonAccess: true,
        mobileAccess: true,
      },
    });
    if (!user) return null;
    return {
      id: user.id,
      role: user.role,
      stockAccess: user.stockAccess ?? false,
      fasonAccess: user.fasonAccess ?? false,
      mobileAccess: user.mobileAccess ?? false,
    };
  } catch (error) {
    if (!isMissingColumnError(error)) {
      throw error;
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
      },
    });
    if (!user) return null;
    return {
      id: user.id,
      role: user.role,
      stockAccess: false,
      fasonAccess: false,
      mobileAccess: false,
    };
  }
}

function setLicenseWarnHeader(res: NextApiResponse, reason: string) {
  const safe = reason.replace(/[\r\n]/g, " ").slice(0, 180);
  res.setHeader("X-License-Warn", safe);
}

export async function requireApiAuth(
  req: NextApiRequest,
  res: NextApiResponse,
  options: RequireApiAuthOptions = {}
): Promise<ApiAuthContext | null> {
  const token = verifyToken(req.headers.authorization) || verifyTokenFromCookie(req.headers.cookie);
  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }

  if (!hasRequiredRole(token.role, options.requiredRole)) {
    res.status(403).json({ message: "Forbidden: role not allowed" });
    return null;
  }

  const needsUserLookup = Boolean(options.requiredAccess);
  let user: UserAccessRecord | null = null;
  if (needsUserLookup) {
    try {
      user = await loadUserAccess(token.id);
    } catch (error) {
      console.error("User access lookup error:", error);
      res.status(500).json({ message: "User access check failed" });
      return null;
    }

    if (!user) {
      res.status(404).json({ message: "Kullanici bulunamadi" });
      return null;
    }

    if (!canAccess(user, options.requiredAccess as RequiredAccess)) {
      res.status(403).json({ message: "Forbidden: access denied" });
      return null;
    }
  }

  let license: LicenseCheckResult | null = null;
  if (options.requireLicense) {
    license = await checkLicense({
      feature: options.feature,
      allowGrace: options.allowGrace,
    });

    if (!license.ok) {
      res.status(402).json({
        message: "License is not valid",
        reason: license.reason,
        status: license.status,
      });
      return null;
    }

    if (license.mode === "warn" && license.reason.startsWith("warn-mode:")) {
      setLicenseWarnHeader(res, license.reason);
    }
  }

  return {
    token,
    user,
    license,
  };
}
