/*
  Warnings:

  - You are about to drop the column `exitDate` on the `FabricExit` table. All the data in the column will be lost.
  - You are about to drop the column `lengthMeter` on the `FabricExit` table. All the data in the column will be lost.
  - You are about to drop the column `weightKg` on the `FabricExit` table. All the data in the column will be lost.
  - Added the required column `unitType` to the `FabricExit` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."WorkshopType" AS ENUM ('DIKIM', 'BASKI_NAKIS', 'UTU');

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('KESIM', 'DIKIM', 'BASKI_NAKIS', 'UTU', 'TESLIM_EDILDI', 'IPTAL', 'FABRIKAYA_DONDU');

-- CreateEnum
CREATE TYPE "public"."ProcessType" AS ENUM ('KESIM', 'DIKIM', 'BASKI_NAKIS', 'UTU');

-- CreateEnum
CREATE TYPE "public"."ProcessStatus" AS ENUM ('BEKLIYOR', 'ALINDI', 'ATÖLYEDE', 'HAZIR', 'TESLIM_EDILDI', 'SORUN_VAR', 'IPTAL_EDILDI');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."Role" ADD VALUE 'STOCK_MANAGER';
ALTER TYPE "public"."Role" ADD VALUE 'FASON_TRACKER';

-- DropForeignKey
ALTER TABLE "public"."FabricExit" DROP CONSTRAINT "FabricExit_fabricEntryId_fkey";

-- AlterTable
ALTER TABLE "public"."FabricExit" DROP COLUMN "exitDate",
DROP COLUMN "lengthMeter",
DROP COLUMN "weightKg",
ADD COLUMN     "color" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "externalProductId" TEXT,
ADD COLUMN     "fabricType" TEXT,
ADD COLUMN     "grammage" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "productLengthMeter" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "unitType" TEXT NOT NULL,
ALTER COLUMN "fabricEntryId" DROP NOT NULL,
ALTER COLUMN "layerCount" SET DEFAULT 1,
ALTER COLUMN "productWeightKg" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "fasonAccess" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "stockAccess" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."FasonWorkshop" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "specialization" "public"."WorkshopType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FasonWorkshop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkOrder" (
    "id" SERIAL NOT NULL,
    "orderNo" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "productName" TEXT,
    "quantity" INTEGER NOT NULL,
    "customerName" TEXT,
    "deliveryDate" TIMESTAMP(3),
    "notes" TEXT,
    "status" "public"."OrderStatus" NOT NULL DEFAULT 'KESIM',
    "externalErpId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FasonTracking" (
    "id" SERIAL NOT NULL,
    "workOrderId" INTEGER NOT NULL,
    "workshopId" INTEGER,
    "userId" INTEGER NOT NULL,
    "processType" "public"."ProcessType" NOT NULL,
    "status" "public"."ProcessStatus" NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "pickupDate" TIMESTAMP(3),
    "deliveryDate" TIMESTAMP(3),
    "notes" TEXT,
    "problemNotes" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FasonTracking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FasonWorkshop_name_key" ON "public"."FasonWorkshop"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_orderNo_key" ON "public"."WorkOrder"("orderNo");

-- AddForeignKey
ALTER TABLE "public"."FabricExit" ADD CONSTRAINT "FabricExit_fabricEntryId_fkey" FOREIGN KEY ("fabricEntryId") REFERENCES "public"."FabricEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FasonTracking" ADD CONSTRAINT "FasonTracking_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "public"."WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FasonTracking" ADD CONSTRAINT "FasonTracking_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "public"."FasonWorkshop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FasonTracking" ADD CONSTRAINT "FasonTracking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
