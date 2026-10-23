ALTER TABLE "WorkOrder"
ADD COLUMN "central_warehouse_stained_quantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "central_warehouse_defective_quantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "central_warehouse_repair_quantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "central_warehouse_lost_quantity" INTEGER NOT NULL DEFAULT 0;
