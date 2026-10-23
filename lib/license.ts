import prisma from "@/lib/prisma";
import crypto from "crypto";

export type LicenseMode = "off" | "warn" | "enforce";
export type LicenseStatusValue =
  | "ACTIVE"
  | "TRIAL"
  | "GRACE"
  | "EXPIRED"
  | "SUSPENDED"
  | "REVOKED"
  | "NONE"
  | "UNKNOWN";

export interface LicenseSnapshot {
  id: number;
  key: string | null;
  plan: string | null;
  status: LicenseStatusValue;
  expiresAt: string | null;
  graceUntil: string | null;
  maxUsers: number | null;
  features: Record<string, unknown> | null;
  lastValidatedAt: string | null;
}

export interface LicenseCheckOptions {
  feature?: string;
  allowGrace?: boolean;
}

export interface LicenseCheckResult {
  ok: boolean;
  mode: LicenseMode;
  status: LicenseStatusValue;
  reason: string;
  checkedAt: string;
  license: LicenseSnapshot | null;
}

const ACTIVE_STATUSES = new Set<LicenseStatusValue>(["ACTIVE", "TRIAL"]);
const HARD_BLOCK_STATUSES = new Set<LicenseStatusValue>(["SUSPENDED", "REVOKED"]);
const SIGNATURE_KEYS = ["__signature", "signature", "licenseSignature"] as const;

type SignablePayload = {
  key: string | null;
  plan: string | null;
  status: string;
  expiresAt: string | null;
  graceUntil: string | null;
  maxUsers: number | null;
  features: Record<string, unknown> | null;
};

function normalizeMode(modeRaw: string | undefined): LicenseMode {
  const mode = (modeRaw || "").trim().toLowerCase();
  if (mode === "off" || mode === "warn" || mode === "enforce") {
    return mode;
  }
  return process.env.NODE_ENV === "production" ? "enforce" : "warn";
}

export function getLicenseMode(): LicenseMode {
  return normalizeMode(process.env.LICENSE_ENFORCEMENT_MODE);
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIso(value: unknown): string | null {
  const date = parseDate(value);
  return date ? date.toISOString() : null;
}

function normalizeStatus(value: unknown): LicenseStatusValue {
  const raw = String(value || "").trim().toUpperCase();
  switch (raw) {
    case "ACTIVE":
    case "TRIAL":
    case "GRACE":
    case "EXPIRED":
    case "SUSPENDED":
    case "REVOKED":
      return raw;
    default:
      return "UNKNOWN";
  }
}

function normalizeFeatures(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function getSigningSecret(): string | null {
  const secret = (process.env.LICENSE_SIGNING_SECRET || "").trim();
  return secret || null;
}

function normalizeBooleanEnv(value: string | undefined): boolean | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

function requiresSignature(mode: LicenseMode): boolean {
  const configured = normalizeBooleanEnv(process.env.LICENSE_REQUIRE_SIGNATURE);
  if (configured !== null) return configured;
  return false;
}

function stripSignatureFields(features: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!features) return null;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(features)) {
    if ((SIGNATURE_KEYS as readonly string[]).includes(key)) continue;
    cleaned[key] = value;
  }
  return Object.keys(cleaned).length ? cleaned : null;
}

function normalizeSignatureValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return normalized;
}

function getStoredSignature(features: Record<string, unknown> | null): string | null {
  if (!features) return null;
  for (const key of SIGNATURE_KEYS) {
    const signature = normalizeSignatureValue(features[key]);
    if (signature) return signature;
  }
  return null;
}

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`).join(",")}}`;
  }
  return JSON.stringify(String(value));
}

function secureEqual(leftRaw: string, rightRaw: string): boolean {
  const left = Buffer.from(leftRaw);
  const right = Buffer.from(rightRaw);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function buildSignablePayload(input: SignablePayload): SignablePayload {
  return {
    key: input.key ? input.key.trim() : null,
    plan: input.plan ? input.plan.trim() : null,
    status: String(input.status || "").trim().toUpperCase(),
    expiresAt: toIso(input.expiresAt),
    graceUntil: toIso(input.graceUntil),
    maxUsers: typeof input.maxUsers === "number" && Number.isFinite(input.maxUsers) ? input.maxUsers : null,
    features: stripSignatureFields(normalizeFeatures(input.features)),
  };
}

export function createLicenseSignature(input: SignablePayload, secretOverride?: string): string | null {
  const secret = (secretOverride || getSigningSecret() || "").trim();
  if (!secret) return null;
  const payload = buildSignablePayload(input);
  const canonical = stableSerialize(payload);
  return crypto.createHmac("sha256", secret).update(canonical).digest("hex");
}

function verifyLicenseSignature(
  snapshot: LicenseSnapshot,
  mode: LicenseMode
): { ok: boolean; reason: string } {
  const signatureRequired = requiresSignature(mode);
  const provided = getStoredSignature(snapshot.features);
  const secret = getSigningSecret();

  if (!secret) {
    return signatureRequired
      ? { ok: false, reason: "license-signing-secret-missing" }
      : { ok: true, reason: "license-signature-check-skipped-no-secret" };
  }

  if (!provided) {
    return signatureRequired
      ? { ok: false, reason: "license-signature-missing" }
      : { ok: true, reason: "license-signature-optional-missing" };
  }

  const expected = createLicenseSignature(
    {
      key: snapshot.key,
      plan: snapshot.plan,
      status: snapshot.status,
      expiresAt: snapshot.expiresAt,
      graceUntil: snapshot.graceUntil,
      maxUsers: snapshot.maxUsers,
      features: snapshot.features,
    },
    secret
  );

  if (!expected || !secureEqual(provided, expected)) {
    return { ok: false, reason: "license-signature-invalid" };
  }

  return { ok: true, reason: "license-signature-valid" };
}

function isFeatureAllowed(features: Record<string, unknown> | null, feature?: string): boolean {
  if (!feature) return true;
  if (!features) return true;

  const direct = features[feature];
  if (typeof direct === "boolean") return direct;

  const moduleAccess = features.moduleAccess;
  if (moduleAccess && typeof moduleAccess === "object" && !Array.isArray(moduleAccess)) {
    const scoped = (moduleAccess as Record<string, unknown>)[feature];
    if (typeof scoped === "boolean") return scoped;
  }

  const enabledFeatures = features.enabledFeatures;
  if (Array.isArray(enabledFeatures)) {
    return enabledFeatures.map((item) => String(item)).includes(feature);
  }

  return true;
}

function isMissingLicenseTableError(error: unknown): boolean {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  const message = error instanceof Error ? error.message : String(error);
  return code === "P2021" || code === "P2022" || message.includes("License");
}

function toLicenseSnapshot(raw: any): LicenseSnapshot {
  return {
    id: Number(raw.id),
    key: typeof raw.key === "string" ? raw.key : null,
    plan: typeof raw.plan === "string" ? raw.plan : null,
    status: normalizeStatus(raw.status),
    expiresAt: toIso(raw.expiresAt),
    graceUntil: toIso(raw.graceUntil),
    maxUsers: typeof raw.maxUsers === "number" ? raw.maxUsers : null,
    features: normalizeFeatures(raw.features),
    lastValidatedAt: toIso(raw.lastValidatedAt),
  };
}

async function getLatestLicense(): Promise<LicenseSnapshot | null> {
  const licenseModel = (prisma as any).license;
  if (!licenseModel || typeof licenseModel.findFirst !== "function") {
    return null;
  }

  const activeCandidate = await licenseModel.findFirst({
    where: { status: { in: ["ACTIVE", "TRIAL", "GRACE"] } },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
  });

  if (activeCandidate) {
    return toLicenseSnapshot(activeCandidate);
  }

  const latest = await licenseModel.findFirst({
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
  });

  return latest ? toLicenseSnapshot(latest) : null;
}

function evaluateLicense(
  snapshot: LicenseSnapshot,
  options: LicenseCheckOptions
): { ok: boolean; status: LicenseStatusValue; reason: string } {
  const now = new Date();
  const allowGrace = options.allowGrace !== false;
  const status = snapshot.status;

  if (HARD_BLOCK_STATUSES.has(status)) {
    return { ok: false, status, reason: `license-${status.toLowerCase()}` };
  }

  const expiresAt = parseDate(snapshot.expiresAt);
  const graceUntil = parseDate(snapshot.graceUntil);

  if (status === "GRACE") {
    if (allowGrace && graceUntil && now <= graceUntil) {
      if (!isFeatureAllowed(snapshot.features, options.feature)) {
        return { ok: false, status: "GRACE", reason: "feature-disabled" };
      }
      return { ok: true, status: "GRACE", reason: "grace-period-active" };
    }
    return { ok: false, status: "EXPIRED", reason: "grace-period-ended" };
  }

  if (expiresAt && now > expiresAt) {
    if (allowGrace && graceUntil && now <= graceUntil) {
      if (!isFeatureAllowed(snapshot.features, options.feature)) {
        return { ok: false, status: "GRACE", reason: "feature-disabled" };
      }
      return { ok: true, status: "GRACE", reason: "grace-period-active" };
    }
    return { ok: false, status: "EXPIRED", reason: "license-expired" };
  }

  if (!ACTIVE_STATUSES.has(status)) {
    return { ok: false, status, reason: `license-status-${status.toLowerCase()}` };
  }

  if (!isFeatureAllowed(snapshot.features, options.feature)) {
    return { ok: false, status, reason: "feature-disabled" };
  }

  return { ok: true, status, reason: "license-active" };
}

export async function checkLicense(options: LicenseCheckOptions = {}): Promise<LicenseCheckResult> {
  const mode = getLicenseMode();
  const checkedAt = new Date().toISOString();

  if (mode === "off") {
    return {
      ok: true,
      mode,
      status: "UNKNOWN",
      reason: "license-check-disabled",
      checkedAt,
      license: null,
    };
  }

  try {
    const snapshot = await getLatestLicense();
    if (!snapshot) {
      if (mode === "warn") {
        return {
          ok: true,
          mode,
          status: "NONE",
          reason: "no-license-record-warn-mode",
          checkedAt,
          license: null,
        };
      }
      return {
        ok: false,
        mode,
        status: "NONE",
        reason: "no-license-record",
        checkedAt,
        license: null,
      };
    }

    const signature = verifyLicenseSignature(snapshot, mode);
    if (!signature.ok) {
      if (mode === "warn") {
        return {
          ok: true,
          mode,
          status: "SUSPENDED",
          reason: `warn-mode:${signature.reason}`,
          checkedAt,
          license: snapshot,
        };
      }
      return {
        ok: false,
        mode,
        status: "SUSPENDED",
        reason: signature.reason,
        checkedAt,
        license: snapshot,
      };
    }

    const evaluated = evaluateLicense(snapshot, options);
    if (evaluated.ok) {
      return {
        ok: true,
        mode,
        status: evaluated.status,
        reason: evaluated.reason,
        checkedAt,
        license: snapshot,
      };
    }

    if (mode === "warn") {
      return {
        ok: true,
        mode,
        status: evaluated.status,
        reason: `warn-mode:${evaluated.reason}`,
        checkedAt,
        license: snapshot,
      };
    }

    return {
      ok: false,
      mode,
      status: evaluated.status,
      reason: evaluated.reason,
      checkedAt,
      license: snapshot,
    };
  } catch (error) {
    console.error("License check error:", error);

    if (isMissingLicenseTableError(error)) {
      if (mode === "warn") {
        return {
          ok: true,
          mode,
          status: "UNKNOWN",
          reason: "license-table-missing-warn-mode",
          checkedAt,
          license: null,
        };
      }
      return {
        ok: false,
        mode,
        status: "UNKNOWN",
        reason: "license-table-missing",
        checkedAt,
        license: null,
      };
    }

    return {
      ok: false,
      mode,
      status: "UNKNOWN",
      reason: "license-check-failed",
      checkedAt,
      license: null,
    };
  }
}
