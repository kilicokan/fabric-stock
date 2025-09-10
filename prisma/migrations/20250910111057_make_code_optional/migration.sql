/*
  Warnings:

  - You are about to drop the column `color` on the `Fabric` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `Fabric` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[code]` on the table `Fabric` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Fabric" DROP COLUMN "color",
DROP COLUMN "quantity",
ADD COLUMN     "code" TEXT,
ADD COLUMN     "depot" TEXT,
ADD COLUMN     "length" DOUBLE PRECISION,
ADD COLUMN     "property" TEXT,
ADD COLUMN     "stockQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "unit" TEXT,
ADD COLUMN     "width" DOUBLE PRECISION;

-- CreateIndex
CREATE UNIQUE INDEX "Fabric_code_key" ON "public"."Fabric"("code");
