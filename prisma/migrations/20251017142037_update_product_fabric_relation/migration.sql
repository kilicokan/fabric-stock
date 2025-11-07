/*
  Warnings:

  - You are about to drop the column `fabricTypeId` on the `Product` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Product" DROP CONSTRAINT "Product_fabricTypeId_fkey";

-- AlterTable
ALTER TABLE "public"."Product" DROP COLUMN "fabricTypeId",
ADD COLUMN     "fabricId" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "public"."Fabric"("id") ON DELETE SET NULL ON UPDATE CASCADE;
