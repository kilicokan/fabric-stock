import { NextApiRequest, NextApiResponse } from "next";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma";
import { withCors } from "@/lib/cors";
import { getJwtSecret } from "@/lib/runtime-config";
import { checkLicense } from "@/lib/license";

type AuthTokenPayload = {
  id: number;
  email?: string;
  role?: string;
};

function isMissingColumnError(error: unknown): boolean {
  const maybeCode =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  const message = error instanceof Error ? error.message : "";
  return maybeCode === "P2022" || message.includes("does not exist");
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");

    if (!token) {
      return res.status(401).json({ error: "Token bulunamadi" });
    }

    const decoded = jwt.verify(
      token,
      getJwtSecret()
    ) as AuthTokenPayload;

    let user:
      | {
          id: number;
          email: string;
          name: string | null;
          role: string;
          stockAccess?: boolean;
          fasonAccess?: boolean;
          mobileAccess?: boolean;
        }
      | null = null;

    try {
      user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          stockAccess: true,
          fasonAccess: true,
          mobileAccess: true,
        },
      });
    } catch (error) {
      if (!isMissingColumnError(error)) {
        throw error;
      }
      // DB schema drift fallback if permission columns do not exist.
      user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      });
    }

    if (!user) {
      return res.status(404).json({ error: "Kullanici bulunamadi" });
    }

    let license = null;
    try {
      license = await checkLicense();
    } catch (licenseError) {
      console.error("Auth me license check error:", licenseError);
    }

    return res.json({
      user: {
        ...user,
        stockAccess: user.stockAccess ?? false,
        fasonAccess: user.fasonAccess ?? false,
        mobileAccess: user.mobileAccess ?? false,
      },
      license,
    });
  } catch (error) {
    console.error("Auth me error:", error);
    if (error instanceof Error) {
      if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Gecersiz token" });
      }
    }
    return res.status(500).json({ error: "Sunucu hatasi" });
  }
};

export default withCors(handler);
