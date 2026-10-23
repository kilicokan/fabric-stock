ALTER TABLE "CuttingTable"
ADD COLUMN "assignedUserId" INTEGER;

ALTER TABLE "FasonTracking"
ADD COLUMN "cuttingTableId" INTEGER;

CREATE INDEX "CuttingTable_assignedUserId_idx" ON "CuttingTable"("assignedUserId");
CREATE INDEX "FasonTracking_cuttingTableId_idx" ON "FasonTracking"("cuttingTableId");

ALTER TABLE "CuttingTable"
ADD CONSTRAINT "CuttingTable_assignedUserId_fkey"
FOREIGN KEY ("assignedUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FasonTracking"
ADD CONSTRAINT "FasonTracking_cuttingTableId_fkey"
FOREIGN KEY ("cuttingTableId") REFERENCES "CuttingTable"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
