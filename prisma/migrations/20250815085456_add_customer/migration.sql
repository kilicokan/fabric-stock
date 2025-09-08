/*
  Warnings:

  - You are about to drop the column `address` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `contact` on the `Customer` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Customer" DROP COLUMN "address",
DROP COLUMN "contact",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT;
