import { createMocks } from "node-mocks-http";

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    license: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    licenseEvent: {
      create: jest.fn(),
    },
  },
}));

jest.mock("@/lib/cors", () => ({
  withCors: (handler: any) => handler,
}));

jest.mock("@/lib/api-auth", () => ({
  requireApiAuth: jest.fn(async () => ({
    token: { id: 99, role: "ADMIN" },
  })),
}));

jest.mock("@/lib/license", () => ({
  checkLicense: jest.fn(async () => ({
    ok: true,
    mode: "enforce",
    status: "ACTIVE",
    reason: "license-active",
    checkedAt: new Date().toISOString(),
    license: null,
  })),
  createLicenseSignature: jest.fn(() => "signed-test"),
}));

import prisma from "@/lib/prisma";
import renewHandler from "@/pages/api/license/renew";

const mockPrisma = prisma as any;

describe("POST /api/license/renew", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.LICENSE_REQUIRE_SIGNATURE = "true";
  });

  it("returns 405 for non-POST methods", async () => {
    const { req, res } = createMocks({ method: "GET" });
    await renewHandler(req as any, res as any);
    expect(res._getStatusCode()).toBe(405);
  });

  it("returns 400 when key is missing", async () => {
    const { req, res } = createMocks({
      method: "POST",
      body: { extendDays: 30 },
    });
    await renewHandler(req as any, res as any);
    expect(res._getStatusCode()).toBe(400);
  });

  it("renews license with extendDays and logs event", async () => {
    const existing = {
      id: 1,
      key: "LIC-TEST-0001",
      plan: "PRO",
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 3 * 86400000),
      graceUntil: null,
      maxUsers: 25,
      features: { stock: true, fason: true, mobile: true },
    };

    mockPrisma.license.findUnique.mockResolvedValue(existing);
    mockPrisma.license.update.mockImplementation(async ({ data }: any) => ({
      ...existing,
      ...data,
    }));
    mockPrisma.licenseEvent.create.mockResolvedValue({ id: 10 });

    const { req, res } = createMocks({
      method: "POST",
      body: {
        key: "LIC-TEST-0001",
        extendDays: 30,
        graceDays: 7,
        status: "ACTIVE",
      },
    });

    await renewHandler(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    expect(mockPrisma.license.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "LIC-TEST-0001" },
        data: expect.objectContaining({
          status: "ACTIVE",
          features: expect.objectContaining({
            __signature: "signed-test",
          }),
        }),
      })
    );
    expect(mockPrisma.licenseEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "RENEW",
          createdBy: 99,
        }),
      })
    );
  });
});
