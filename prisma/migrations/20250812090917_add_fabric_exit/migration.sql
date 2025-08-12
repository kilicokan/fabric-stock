/*
  Warnings:

  - You are about to drop the column `exitDate` on the `FabricExit` table. All the data in the column will be lost.
  - You are about to drop the column `meter` on the `FabricExit` table. All the data in the column will be lost.
  - You are about to drop the column `weightKg` on the `FabricExit` table. All the data in the column will be lost.
  - Added the required column `customerId` to the `FabricExit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `layerCount` to the `FabricExit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `modelNo` to the `FabricExit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `orderNo` to the `FabricExit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productWeight` to the `FabricExit` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."FabricExit" DROP COLUMN "exitDate",
DROP COLUMN "meter",
DROP COLUMN "weightKg",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "customerId" TEXT NOT NULL,
ADD COLUMN     "layerCount" INTEGER NOT NULL,
ADD COLUMN     "modelNo" TEXT NOT NULL,
ADD COLUMN     "orderNo" TEXT NOT NULL,
ADD COLUMN     "productWeight" DOUBLE PRECISION NOT NULL;

-- CreateTable
CREATE TABLE "public"."Product" (
    "id" SERIAL NOT NULL,
    "modelNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_modelNo_key" ON "public"."Product"("modelNo");
