/*
  Warnings:

  - You are about to drop the column `entryDate` on the `FabricEntry` table. All the data in the column will be lost.
  - You are about to drop the column `lengthMeter` on the `FabricEntry` table. All the data in the column will be lost.
  - You are about to drop the column `weightKg` on the `FabricEntry` table. All the data in the column will be lost.
  - Added the required column `quantity` to the `FabricEntry` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."FabricEntry" DROP COLUMN "entryDate",
DROP COLUMN "lengthMeter",
DROP COLUMN "weightKg",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "quantity" DOUBLE PRECISION NOT NULL;
