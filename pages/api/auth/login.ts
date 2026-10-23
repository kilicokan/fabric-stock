import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/cors";
import { getJwtSecret } from "@/lib/runtime-config";
import { checkLicense } from "@/lib/license";

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

type SafeUser = {
  id: number;
  email: string;
  password: string;
  role: string;
  name: string | null;
  stockAccess?: boolean;
  fasonAccess?: boolean;
  mobileAccess?: boolean;
};

function isMissingColumnError(error: unknown): boolean {
  const maybeCode =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  const message = error instanceof Error ? error.message : "";
  return maybeCode === "P2022" || message.includes("does not exist");
}

async function findUserForLogin(email: string): Promise<SafeUser | null> {
  try {
    return (await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        name: true,
        stockAccess: true,
        fasonAccess: true,
        mobileAccess: true,
      },
    })) as SafeUser | null;
  } catch (error) {
    // DB schema drift fallback: if permission columns are missing, continue with core fields.
    if (!isMissingColumnError(error)) {
      throw error;
    }
    return (await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        name: true,
      },
    })) as SafeUser | null;
  }
}

async function verifyPasswordAndUpgradeIfNeeded(
  user: SafeUser,
  plainPassword: string
): Promise<boolean> {
  const stored = user.password || "";
  let valid = false;

  if (stored.startsWith("$2")) {
    try {
      valid = await bcrypt.compare(plainPassword, stored);
    } catch {
      // Old or broken hash format: fall back to plain compare as a compatibility path.
      valid = plainPassword === stored;
    }
  } else {
    valid = plainPassword === stored;
  }

  if (valid && !stored.startsWith("$2")) {
    try {
      const hashed = await bcrypt.hash(plainPassword, 12);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashed },
      });
    } catch (upgradeError) {
      // Do not block login if hash upgrade fails.
      console.warn("Password hash upgrade failed:", upgradeError);
    }
  }

  return valid;
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const body = (req.body || {}) as LoginBody;
  const rawEmail = typeof body.email === "string" ? body.email : "";
  const rawPassword = typeof body.password === "string" ? body.password : "";
  const email = rawEmail.trim().toLowerCase();
  const password = rawPassword;

  if (!email || !password) {
    return res.status(400).json({ message: "Email ve sifre zorunludur." });
  }

  try {
    const user = await findUserForLogin(email);

    if (!user) {
      return res.status(401).json({ message: "Kullanici bulunamadi." });
    }

    const valid = await verifyPasswordAndUpgradeIfNeeded(user, password);
    if (!valid) {
      return res.status(401).json({ message: "Sifre hatali." });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      getJwtSecret(),
      { expiresIn: "1d" }
    );

    const isProduction = process.env.NODE_ENV === 'production';
    res.setHeader('Set-Cookie', [
      `token=${token}; Path=/; HttpOnly; ${isProduction ? 'Secure;' : ''} SameSite=Strict; Max-Age=86400`,
      `authToken=${token}; Path=/; HttpOnly; ${isProduction ? 'Secure;' : ''} SameSite=Strict; Max-Age=86400`,
    ].join(', '));

    let license = null;
    try {
      license = await checkLicense();
    } catch (licenseError) {
      console.error("Login license check error:", licenseError);
    }

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        stockAccess: user.stockAccess ?? false,
        fasonAccess: user.fasonAccess ?? false,
        mobileAccess: user.mobileAccess ?? false,
      },
      license,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Login error:", error);
    return res.status(500).json({
      message: "Sunucu hatasi",
      detail: process.env.NODE_ENV === "development" ? message : undefined,
    });
  }
};

export default withAuthRateLimit(handler);
