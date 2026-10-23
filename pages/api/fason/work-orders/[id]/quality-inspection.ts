import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";

type CheckStatus = "pass" | "fail" | "na";

type InspectionCheck = {
  id: string;
  title: string;
  value: CheckStatus;
  note: string;
  photos: string[];
};

const MAX_CHECKS = 20;
const MAX_PHOTOS = 6;
const MAX_PHOTO_LENGTH = 1_000_000;
const MAX_PHOTO_BODY_LENGTH = 7_000_000;
const eligibleStatuses = ["BEKLIYOR", "ALINDI", "ATÖLYEDE", "HAZIR", "SORUN_VAR"];
const requiredCheckIds = [
  "appearance",
  "stitching",
  "measurements",
  "color-model",
  "accessories-label",
];
const photoDataUrl = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "8mb",
    },
  },
};

function isInspectionCheck(value: unknown): value is InspectionCheck {
  if (!value || typeof value !== "object") return false;
  const check = value as Record<string, unknown>;
  return (
    typeof check.id === "string" &&
    check.id.length > 0 &&
    typeof check.title === "string" &&
    check.title.trim().length > 0 &&
    check.title.length <= 240 &&
    ["pass", "fail", "na"].includes(String(check.value)) &&
    typeof check.note === "string" &&
    check.note.length <= 1000 &&
    Array.isArray(check.photos) &&
    check.photos.length <= 3 &&
    check.photos.every(
      (photo) =>
        typeof photo === "string" &&
        photoDataUrl.test(photo) &&
        photo.length <= MAX_PHOTO_LENGTH,
    )
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  const auth = await requireApiAuth(req, res, {
    requiredAccess: "mobile",
    requireLicense: true,
    feature: "mobile",
  });
  if (!auth) return;

  const workOrderId = Number(req.query.id);
  if (!Number.isInteger(workOrderId) || workOrderId <= 0) {
    return res.status(400).json({ message: "Geçersiz iş emri numarası." });
  }

  if (req.method === "GET") {
    try {
      const workOrder = await prisma.workOrder.findUnique({
        where: { id: workOrderId },
        select: { id: true },
      });
      if (!workOrder) return res.status(404).json({ message: "İş emri bulunamadı." });

      const inspections = await prisma.qualityInspection.findMany({
        where: { workOrderId },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      return res.status(200).json({ inspections });
    } catch (error) {
      console.error("Quality inspection history could not be loaded:", error);
      return res.status(500).json({ message: "Kontrol geçmişi yüklenemedi." });
    }
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST", "OPTIONS"]);
    return res.status(405).json({ message: "Method not allowed" });
  }

  const body = req.body;
  if (
    !body ||
    !Array.isArray(body.checklist) ||
    body.checklist.length === 0 ||
    body.checklist.length > MAX_CHECKS ||
    !body.checklist.every(isInspectionCheck) ||
    (body.notes !== undefined && (typeof body.notes !== "string" || body.notes.length > 2000))
  ) {
    return res.status(400).json({ message: "Kontrol adımları geçersiz veya eksik." });
  }

  const checkIds = body.checklist.map((check: InspectionCheck) => check.id);
  const photoCount = body.checklist.reduce(
    (count: number, check: InspectionCheck) => count + check.photos.length,
    0,
  );
  const photoBodyLength = body.checklist.reduce(
    (length: number, check: InspectionCheck) =>
      length + check.photos.reduce((sum, photo) => sum + photo.length, 0),
    0,
  );
  if (
    new Set(checkIds).size !== checkIds.length ||
    requiredCheckIds.some((id) => !checkIds.includes(id)) ||
    checkIds.some((id) => !requiredCheckIds.includes(id) && !/^product-instruction-[1-8]$/.test(id)) ||
    photoCount > MAX_PHOTOS ||
    photoBodyLength > MAX_PHOTO_BODY_LENGTH ||
    body.checklist.some((check: InspectionCheck) => check.value === "fail" && !check.note.trim())
  ) {
    return res.status(400).json({
      message: "Kontrol adımlarını doğrulayın; her sorun açıklanmalı ve en fazla 6 fotoğraf eklenebilir.",
    });
  }

  const result = body.checklist.some((check: InspectionCheck) => check.value === "fail")
    ? "FAIL"
    : "PASS";
  const nextStatus = result === "FAIL" ? "SORUN_VAR" : "HAZIR";

  try {
    const saved = await prisma.$transaction(async (transaction) => {
      const workOrder = await transaction.workOrder.findUnique({
        where: { id: workOrderId },
        select: { id: true, status: true },
      });
      if (!workOrder) throw new Error("NOT_FOUND");
      if (!eligibleStatuses.includes(workOrder.status)) throw new Error("INVALID_STATUS");

      const inspection = await transaction.qualityInspection.create({
        data: {
          workOrderId,
          inspectorId: auth.token.id,
          result,
          checklist: body.checklist,
          notes: body.notes?.trim() || null,
        },
      });
      await transaction.workOrder.update({
        where: { id: workOrderId, status: workOrder.status },
        data: { status: nextStatus },
      });
      return inspection;
    });

    return res.status(201).json({ inspection: saved, workOrderStatus: nextStatus });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return res.status(404).json({ message: "İş emri bulunamadı." });
    }
    if (error instanceof Error && error.message === "INVALID_STATUS") {
      return res.status(409).json({ message: "Teslim edilen iş emirlerinde kalite kontrolü yapılamaz." });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return res.status(409).json({ message: "İş emri durumu değişti; kalite kontrolünü yenileyip tekrar deneyin." });
    }
    console.error("Quality inspection could not be saved:", error);
    return res.status(500).json({ message: "Kalite kontrolü kaydedilemedi." });
  }
}
