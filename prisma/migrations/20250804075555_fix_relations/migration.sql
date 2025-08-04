/*
  Warnings:

  - You are about to drop the column `createdAt` on the `FabricEntry` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `FabricExit` table. All the data in the column will be lost.
  - You are about to drop the column `cutCode` on the `FabricExit` table. All the data in the column will be lost.
  - You are about to drop the column `cuttingTable` on the `FabricExit` table. All the data in the column will be lost.
  - You are about to drop the column `fabricTypeId` on the `FabricExit` table. All the data in the column will be lost.
  - You are about to drop the column `color` on the `FabricType` table. All the data in the column will be lost.
  - Added the required column `colorId` to the `FabricEntry` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cuttingTableId` to the `FabricExit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fabricEntryId` to the `FabricExit` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "FabricExit" DROP CONSTRAINT "FabricExit_fabricTypeId_fkey";

-- AlterTable
ALTER TABLE "FabricEntry" DROP COLUMN "createdAt",
ADD COLUMN     "colorId" INTEGER NOT NULL,
ADD COLUMN     "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lengthMeter" DOUBLE PRECISION,
ALTER COLUMN "weightKg" DROP NOT NULL;

-- AlterTable
ALTER TABLE "FabricExit" DROP COLUMN "createdAt",
DROP COLUMN "cutCode",
DROP COLUMN "cuttingTable",
DROP COLUMN "fabricTypeId",
ADD COLUMN     "cuttingTableId" INTEGER NOT NULL,
ADD COLUMN     "exitDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "fabricEntryId" INTEGER NOT NULL,
ADD COLUMN     "meter" DOUBLE PRECISION,
ALTER COLUMN "weightKg" DROP NOT NULL;

-- AlterTable
ALTER TABLE "FabricType" DROP COLUMN "color";

-- CreateTable
CREATE TABLE "Color" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Color_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuttingTable" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "CuttingTable_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FabricEntry" ADD CONSTRAINT "FabricEntry_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "Color"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricExit" ADD CONSTRAINT "FabricExit_fabricEntryId_fkey" FOREIGN KEY ("fabricEntryId") REFERENCES "FabricEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricExit" ADD CONSTRAINT "FabricExit_cuttingTableId_fkey" FOREIGN KEY ("cuttingTableId") REFERENCES "CuttingTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
