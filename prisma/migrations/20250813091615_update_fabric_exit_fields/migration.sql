/*
  Warnings:

  - You are about to drop the column `createdAt` on the `FabricEntry` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `FabricEntry` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `FabricExit` table. All the data in the column will be lost.
  - You are about to drop the column `productWeight` on the `FabricExit` table. All the data in the column will be lost.
  - Added the required column `quantityKg` to the `FabricEntry` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productWeightKg` to the `FabricExit` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."FabricEntry" DROP COLUMN "createdAt",
DROP COLUMN "quantity",
ADD COLUMN     "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lengthMeter" DOUBLE PRECISION,
ADD COLUMN     "quantityKg" DOUBLE PRECISION NOT NULL;

-- AlterTable
ALTER TABLE "public"."FabricExit" DROP COLUMN "createdAt",
DROP COLUMN "productWeight",
ADD COLUMN     "exitDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lengthMeter" DOUBLE PRECISION,
ADD COLUMN     "productWeightKg" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "weightKg" DOUBLE PRECISION;
