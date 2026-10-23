jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    license: {
      findFirst: jest.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { checkLicense, createLicenseSignature } from "@/lib/license";

const mockFindFirst = (prisma as any).license.findFirst as jest.Mock;

function buildActiveRecord(overrides: Record<string, unknown> = {}) {
  const expiresAt = new Date(Date.now() + 15 * 86400000);
  return {
    id: 1,
    key: "LIC-TEST-0001",
    plan: "PRO",
    status: "ACTIVE",
    expiresAt,
    graceUntil: null,
    maxUsers: 25,
    features: {
      stock: true,
      fason: true,
      mobile: true,
    },
    lastValidatedAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("license signature", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.LICENSE_ENFORCEMENT_MODE = "enforce";
    process.env.LICENSE_REQUIRE_SIGNATURE = "true";
    process.env.LICENSE_SIGNING_SECRET = "unit-test-license-secret";
  });

  it("creates deterministic signature", () => {
    const payload = {
      key: "LIC-TEST-0001",
      plan: "PRO",
      status: "ACTIVE",
      expiresAt: "2030-01-01T00:00:00.000Z",
      graceUntil: null,
      maxUsers: 25,
      features: {
        stock: true,
        mobile: true,
      },
    };

    const first = createLicenseSignature(payload);
    const second = createLicenseSignature(payload);
    expect(first).toBeTruthy();
    expect(first).toBe(second);
  });

  it("allows valid signed license in enforce mode", async () => {
    const base = buildActiveRecord();
    const signature = createLicenseSignature({
      key: base.key,
      plan: base.plan,
      status: base.status,
      expiresAt: base.expiresAt.toISOString(),
      graceUntil: null,
      maxUsers: base.maxUsers,
      features: base.features,
    });

    mockFindFirst.mockResolvedValue({
      ...base,
      features: {
        ...(base.features as Record<string, unknown>),
        __signature: signature,
      },
    });

    const result = await checkLicense();
    expect(result.ok).toBe(true);
    expect(result.reason).toBe("license-active");
  });

  it("blocks tampered signed license in enforce mode", async () => {
    const base = buildActiveRecord();
    const signature = createLicenseSignature({
      key: base.key,
      plan: base.plan,
      status: base.status,
      expiresAt: base.expiresAt.toISOString(),
      graceUntil: null,
      maxUsers: base.maxUsers,
      features: {
        stock: true,
        fason: true,
        mobile: true,
      },
    });

    mockFindFirst.mockResolvedValue({
      ...base,
      features: {
        stock: false,
        fason: true,
        mobile: true,
        __signature: signature,
      },
    });

    const result = await checkLicense();
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("license-signature-invalid");
    expect(result.status).toBe("SUSPENDED");
  });

  it("warn mode does not block on invalid signature", async () => {
    process.env.LICENSE_ENFORCEMENT_MODE = "warn";

    const base = buildActiveRecord();
    mockFindFirst.mockResolvedValue({
      ...base,
      features: {
        stock: true,
        mobile: true,
        __signature: "deadbeef",
      },
    });

    const result = await checkLicense();
    expect(result.ok).toBe(true);
    expect(result.reason).toBe("warn-mode:license-signature-invalid");
  });
});
