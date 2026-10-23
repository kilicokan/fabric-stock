-- AlterEnum
ALTER TYPE "ProcessType" ADD VALUE IF NOT EXISTS 'OZEL';

-- AlterTable
ALTER TABLE "FasonTracking" ADD COLUMN IF NOT EXISTS "stepName" TEXT;
