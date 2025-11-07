/*
  Warnings:

  - You are about to drop the column `fabricTypeId` on the `FabricEntry` table. All the data in the column will be lost.
  - Added the required column `fabricId` to the `FabricEntry` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."FabricEntry" DROP CONSTRAINT "FabricEntry_fabricTypeId_fkey";

-- AlterTable
ALTER TABLE "public"."FabricEntry" DROP COLUMN "fabricTypeId",
ADD COLUMN     "fabricId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "fabricTypeId" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_fabricTypeId_fkey" FOREIGN KEY ("fabricTypeId") REFERENCES "public"."FabricType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FabricEntry" ADD CONSTRAINT "FabricEntry_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "public"."Fabric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
