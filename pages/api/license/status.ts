import type { NextApiRequest, NextApiResponse } from "next";
import { withCors } from "@/lib/cors";
import { requireApiAuth } from "@/lib/api-auth";
import { checkLicense } from "@/lib/license";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const auth = await requireApiAuth(req, res);
  if (!auth) return;

  const feature = typeof req.query.feature === "string" ? req.query.feature : undefined;
  const license = await checkLicense({ feature });

  return res.status(200).json({
    ok: license.ok,
    mode: license.mode,
    status: license.status,
    reason: license.reason,
    checkedAt: license.checkedAt,
    requestedFeature: feature ?? null,
    license: license.license,
  });
};

export default withCors(handler);
