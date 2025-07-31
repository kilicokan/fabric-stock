-- CreateTable
CREATE TABLE "FabricType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,

    CONSTRAINT "FabricType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FabricEntry" (
    "id" SERIAL NOT NULL,
    "fabricTypeId" INTEGER NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FabricEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FabricExit" (
    "id" SERIAL NOT NULL,
    "fabricTypeId" INTEGER NOT NULL,
    "cuttingTable" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "cutCode" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FabricExit_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FabricEntry" ADD CONSTRAINT "FabricEntry_fabricTypeId_fkey" FOREIGN KEY ("fabricTypeId") REFERENCES "FabricType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricExit" ADD CONSTRAINT "FabricExit_fabricTypeId_fkey" FOREIGN KEY ("fabricTypeId") REFERENCES "FabricType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
