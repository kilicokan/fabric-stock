-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OPERATOR', 'STOCK_MANAGER', 'FASON_TRACKER');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('TRIAL', 'ACTIVE', 'GRACE', 'EXPIRED', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "WorkshopType" AS ENUM ('DIKIM', 'BASKI_NAKIS', 'UTU', 'KESIM', 'TUM');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('BEKLIYOR', 'ALINDI', 'ATÖLYEDE', 'HAZIR', 'TESLIM_EDILDI', 'SORUN_VAR');

-- CreateEnum
CREATE TYPE "RecipeResourceType" AS ENUM ('FABRIC', 'ACCESSORY');

-- CreateEnum
CREATE TYPE "SalesDocumentType" AS ENUM ('INVOICE', 'DISPATCH');

-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('CUSTOMER', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "TransactionDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('MANUAL', 'PAYMENT', 'DOCUMENT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ProcessType" AS ENUM ('KESIM', 'DIKIM', 'BASKI_NAKIS', 'UTU');

-- CreateEnum
CREATE TYPE "ProcessStatus" AS ENUM ('BEKLIYOR', 'ALINDI', 'ATÖLYEDE', 'HAZIR', 'TESLIM_EDILDI', 'SORUN_VAR', 'IPTAL_EDILDI');

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "modelNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "materialTypeId" INTEGER,
    "fabricId" INTEGER,
    "groupId" INTEGER,
    "taxRateId" INTEGER,
    "description" TEXT,
    "image" TEXT,
    "backImage" TEXT,
    "frontImages" JSONB,
    "backImages" JSONB,
    "criticalNotes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "warehouseId" INTEGER,
    "sewingNotes" TEXT,
    "averageGrammage" DOUBLE PRECISION,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductRecipe" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "resourceType" "RecipeResourceType" NOT NULL,
    "fabricId" INTEGER,
    "accessoryId" INTEGER,
    "quantityPerUnit" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRate" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0.18,

    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FabricType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FabricType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Color" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,

    CONSTRAINT "Color_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuttingTable" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CuttingTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpreadingMachine" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cuttingTableId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpreadingMachine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fabric_entries" (
    "id" SERIAL NOT NULL,
    "fabricId" INTEGER NOT NULL,
    "colorId" INTEGER NOT NULL,
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "lengthMeter" DOUBLE PRECISION,
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fabric_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fabric_exits" (
    "id" SERIAL NOT NULL,
    "modelNo" TEXT NOT NULL,
    "modelName" TEXT,
    "orderNo" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "layerCount" INTEGER NOT NULL DEFAULT 1,
    "productWeightKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "productLengthMeter" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grammage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "externalProductId" TEXT,
    "unitType" TEXT NOT NULL,
    "fabricType" TEXT,
    "color" TEXT,
    "cuttingTableId" INTEGER NOT NULL,
    "reportNumber" TEXT,
    "plannedLayers" TEXT,
    "actualLayers" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fabricEntryId" INTEGER,
    "pastelEni" DOUBLE PRECISION DEFAULT 0,
    "pastelBoyu" DOUBLE PRECISION DEFAULT 0,
    "metreKareAgirlik" DOUBLE PRECISION DEFAULT 0,
    "pastelAgirlik" DOUBLE PRECISION DEFAULT 0,

    CONSTRAINT "fabric_exits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OPERATOR',
    "name" TEXT,
    "phone" TEXT,
    "stockAccess" BOOLEAN NOT NULL DEFAULT false,
    "fasonAccess" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expoPushToken" TEXT,
    "mobileAccess" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerOrder" (
    "id" SERIAL NOT NULL,
    "orderNo" TEXT NOT NULL,
    "customerId" INTEGER NOT NULL,
    "documentType" "SalesDocumentType" NOT NULL DEFAULT 'INVOICE',
    "documentDate" TIMESTAMP(3),
    "documentNo" TEXT,
    "dispatchDate" TIMESTAMP(3),
    "dispatchNo" TEXT,
    "inWarehouseCode" TEXT,
    "outWarehouseCode" TEXT,
    "currencyCode" TEXT,
    "currencyRate" DOUBLE PRECISION,
    "note" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerOrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productCode" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "deliveryDate" TIMESTAMP(3),
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "virtualTryOnImage" TEXT,
    "personImage" TEXT,
    "garmentType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fabric" (
    "id" SERIAL NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "property" TEXT,
    "width" DOUBLE PRECISION,
    "length" DOUBLE PRECISION,
    "depot" TEXT,
    "unit" TEXT,
    "stockQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "defectiveQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageGrammage" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "warehouseId" INTEGER,

    CONSTRAINT "Fabric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FabricReturn" (
    "id" SERIAL NOT NULL,
    "fabricId" INTEGER NOT NULL,
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "relatedDocumentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,

    CONSTRAINT "FabricReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FabricPattern" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FabricPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FabricOrder" (
    "id" SERIAL NOT NULL,
    "orderNumber" INTEGER NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplierId" INTEGER NOT NULL,
    "fabricId" INTEGER NOT NULL,
    "colorId" INTEGER NOT NULL,
    "patternId" INTEGER,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitType" TEXT NOT NULL,
    "arrivalDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Beklemede',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FabricOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Accessory" (
    "id" SERIAL NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "warehouseId" INTEGER,
    "unit" TEXT NOT NULL,
    "stockQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Accessory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessoryOrder" (
    "id" SERIAL NOT NULL,
    "orderNumber" INTEGER NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplierId" INTEGER NOT NULL,
    "accessoryId" INTEGER NOT NULL,
    "colorId" INTEGER NOT NULL,
    "patternId" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitType" TEXT NOT NULL,
    "arrivalDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Beklemede',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessoryOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessoryDocument" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "customer" TEXT NOT NULL,
    "warehouse" TEXT NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "fgType" TEXT,
    "fgNumber" TEXT,
    "orderNo" TEXT,
    "supplierCode" TEXT,
    "supplierName" TEXT,
    "entryWarehouseCode" TEXT,
    "exitWarehouseCode" TEXT,
    "accessoryOrderId" INTEGER,
    "accessoryId" INTEGER,
    "colorId" INTEGER,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessoryDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FabricDocument" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "customer" TEXT NOT NULL,
    "warehouse" TEXT NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "fgType" TEXT,
    "fgNumber" TEXT,
    "orderNo" TEXT,
    "supplierCode" TEXT,
    "supplierName" TEXT,
    "entryWarehouseCode" TEXT,
    "exitWarehouseCode" TEXT,
    "fabricOrderId" INTEGER,
    "fabricId" INTEGER,
    "colorId" INTEGER,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FabricDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FasonWorkshop" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "specialization" "WorkshopType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "capacity" DOUBLE PRECISION,
    "capacityType" TEXT NOT NULL DEFAULT 'TL',
    "maxCapacity" DOUBLE PRECISION NOT NULL DEFAULT 500000,
    "totalEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPayments" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "FasonWorkshop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" SERIAL NOT NULL,
    "orderNo" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "productName" TEXT,
    "quantity" INTEGER NOT NULL,
    "customerName" TEXT,
    "deliveryDate" TIMESTAMP(3),
    "notes" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'BEKLIYOR',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "assignedToMobile" BOOLEAN NOT NULL DEFAULT false,
    "mobile_assignment_date" TIMESTAMP(3),
    "assignedUserId" INTEGER,
    "externalErpId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sewingNotes" TEXT,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityInspection" (
    "id" SERIAL NOT NULL,
    "workOrderId" INTEGER NOT NULL,
    "inspectorId" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "checklist" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualityInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FasonTracking" (
    "id" SERIAL NOT NULL,
    "workOrderId" INTEGER NOT NULL,
    "workshopId" INTEGER,
    "userId" INTEGER NOT NULL,
    "processType" "ProcessType" NOT NULL,
    "status" "ProcessStatus" NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "pickupDate" TIMESTAMP(3),
    "deliveryDate" TIMESTAMP(3),
    "notes" TEXT,
    "problemNotes" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assignedQuantity" INTEGER,
    "receivedQuantity" INTEGER,
    "totalPrice" DOUBLE PRECISION,
    "unitPrice" DOUBLE PRECISION,

    CONSTRAINT "FasonTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpreadingRun" (
    "id" SERIAL NOT NULL,
    "externalRunId" TEXT NOT NULL,
    "machine" TEXT NOT NULL,
    "workOrderNo" TEXT,
    "pastelNo" TEXT,
    "fabricCode" TEXT,
    "color" TEXT,
    "operator" TEXT,
    "status" TEXT NOT NULL,
    "layerSet" INTEGER,
    "currentLayer" INTEGER,
    "pastelPositionMeter" DOUBLE PRECISION,
    "pastelMeter" DOUBLE PRECISION,
    "widthCm" DOUBLE PRECISION,
    "tension" DOUBLE PRECISION,
    "forwardSpeed" DOUBLE PRECISION,
    "reverseSpeed" DOUBLE PRECISION,
    "wasteMeter" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "sourceUpdatedAt" TIMESTAMP(3),
    "rawPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workOrderId" INTEGER,
    "machineId" INTEGER,
    "cuttingTableId" INTEGER,

    CONSTRAINT "SpreadingRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpreadingLayer" (
    "id" SERIAL NOT NULL,
    "spreadingRunId" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "layerNumber" INTEGER NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "pieceCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpreadingLayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" SERIAL NOT NULL,
    "licensePlate" TEXT NOT NULL,
    "model" TEXT,
    "color" TEXT,
    "capacity" DOUBLE PRECISION,
    "assignedUserId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_locations" (
    "id" SERIAL NOT NULL,
    "vehicleId" INTEGER NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "address" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" SERIAL NOT NULL,
    "senderId" INTEGER NOT NULL,
    "recipientId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialTransaction" (
    "id" SERIAL NOT NULL,
    "partyType" "PartyType" NOT NULL,
    "customerId" INTEGER,
    "supplierId" INTEGER,
    "direction" "TransactionDirection" NOT NULL,
    "source" "TransactionSource" NOT NULL DEFAULT 'MANUAL',
    "documentType" TEXT,
    "referenceNo" TEXT,
    "referenceId" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "description" TEXT,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "License" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "plan" TEXT,
    "status" "LicenseStatus" NOT NULL DEFAULT 'TRIAL',
    "expiresAt" TIMESTAMP(3),
    "graceUntil" TIMESTAMP(3),
    "maxUsers" INTEGER,
    "features" JSONB,
    "lastValidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseActivation" (
    "id" SERIAL NOT NULL,
    "licenseId" INTEGER NOT NULL,
    "deviceId" TEXT,
    "deviceName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LicenseActivation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseEvent" (
    "id" SERIAL NOT NULL,
    "licenseId" INTEGER,
    "eventType" TEXT NOT NULL,
    "message" TEXT,
    "payload" JSONB,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicenseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_modelNo_key" ON "Product"("modelNo");

-- CreateIndex
CREATE INDEX "Product_warehouseId_idx" ON "Product"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialType_name_key" ON "MaterialType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Group_name_key" ON "Group"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRate_name_key" ON "TaxRate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FabricType_name_key" ON "FabricType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Color_name_key" ON "Color"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Color_code_key" ON "Color"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CuttingTable_name_key" ON "CuttingTable"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SpreadingMachine_code_key" ON "SpreadingMachine"("code");

-- CreateIndex
CREATE INDEX "SpreadingMachine_cuttingTableId_idx" ON "SpreadingMachine"("cuttingTableId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "CustomerOrder_documentType_documentDate_idx" ON "CustomerOrder"("documentType", "documentDate");

-- CreateIndex
CREATE UNIQUE INDEX "Fabric_code_key" ON "Fabric"("code");

-- CreateIndex
CREATE INDEX "Fabric_warehouseId_idx" ON "Fabric"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "FabricPattern_name_key" ON "FabricPattern"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FabricOrder_orderNumber_key" ON "FabricOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "FabricOrder_supplierId_idx" ON "FabricOrder"("supplierId");

-- CreateIndex
CREATE INDEX "FabricOrder_fabricId_idx" ON "FabricOrder"("fabricId");

-- CreateIndex
CREATE INDEX "FabricOrder_colorId_idx" ON "FabricOrder"("colorId");

-- CreateIndex
CREATE INDEX "FabricOrder_patternId_idx" ON "FabricOrder"("patternId");

-- CreateIndex
CREATE UNIQUE INDEX "Accessory_code_key" ON "Accessory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Accessory_name_key" ON "Accessory"("name");

-- CreateIndex
CREATE INDEX "Accessory_warehouseId_idx" ON "Accessory"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessoryOrder_orderNumber_key" ON "AccessoryOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "AccessoryOrder_supplierId_idx" ON "AccessoryOrder"("supplierId");

-- CreateIndex
CREATE INDEX "AccessoryOrder_accessoryId_idx" ON "AccessoryOrder"("accessoryId");

-- CreateIndex
CREATE INDEX "AccessoryOrder_colorId_idx" ON "AccessoryOrder"("colorId");

-- CreateIndex
CREATE INDEX "AccessoryOrder_patternId_idx" ON "AccessoryOrder"("patternId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessoryDocument_number_key" ON "AccessoryDocument"("number");

-- CreateIndex
CREATE INDEX "AccessoryDocument_orderNo_idx" ON "AccessoryDocument"("orderNo");

-- CreateIndex
CREATE INDEX "AccessoryDocument_accessoryOrderId_idx" ON "AccessoryDocument"("accessoryOrderId");

-- CreateIndex
CREATE INDEX "AccessoryDocument_accessoryId_idx" ON "AccessoryDocument"("accessoryId");

-- CreateIndex
CREATE INDEX "AccessoryDocument_colorId_idx" ON "AccessoryDocument"("colorId");

-- CreateIndex
CREATE UNIQUE INDEX "FabricDocument_number_key" ON "FabricDocument"("number");

-- CreateIndex
CREATE INDEX "FabricDocument_orderNo_idx" ON "FabricDocument"("orderNo");

-- CreateIndex
CREATE INDEX "FabricDocument_fabricOrderId_idx" ON "FabricDocument"("fabricOrderId");

-- CreateIndex
CREATE INDEX "FabricDocument_fabricId_idx" ON "FabricDocument"("fabricId");

-- CreateIndex
CREATE INDEX "FabricDocument_colorId_idx" ON "FabricDocument"("colorId");

-- CreateIndex
CREATE UNIQUE INDEX "FasonWorkshop_name_key" ON "FasonWorkshop"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_orderNo_key" ON "WorkOrder"("orderNo");

-- CreateIndex
CREATE INDEX "QualityInspection_workOrderId_createdAt_idx" ON "QualityInspection"("workOrderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SpreadingRun_externalRunId_key" ON "SpreadingRun"("externalRunId");

-- CreateIndex
CREATE INDEX "SpreadingRun_machine_status_idx" ON "SpreadingRun"("machine", "status");

-- CreateIndex
CREATE INDEX "SpreadingRun_workOrderId_idx" ON "SpreadingRun"("workOrderId");

-- CreateIndex
CREATE INDEX "SpreadingRun_sourceUpdatedAt_idx" ON "SpreadingRun"("sourceUpdatedAt");

-- CreateIndex
CREATE INDEX "SpreadingLayer_spreadingRunId_color_idx" ON "SpreadingLayer"("spreadingRunId", "color");

-- CreateIndex
CREATE UNIQUE INDEX "SpreadingLayer_spreadingRunId_color_layerNumber_key" ON "SpreadingLayer"("spreadingRunId", "color", "layerNumber");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_licensePlate_key" ON "vehicles"("licensePlate");

-- CreateIndex
CREATE INDEX "vehicle_locations_vehicleId_timestamp_idx" ON "vehicle_locations"("vehicleId", "timestamp");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "Message_recipientId_idx" ON "Message"("recipientId");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE INDEX "FinancialTransaction_partyType_transactionDate_idx" ON "FinancialTransaction"("partyType", "transactionDate");

-- CreateIndex
CREATE INDEX "FinancialTransaction_customerId_transactionDate_idx" ON "FinancialTransaction"("customerId", "transactionDate");

-- CreateIndex
CREATE INDEX "FinancialTransaction_supplierId_transactionDate_idx" ON "FinancialTransaction"("supplierId", "transactionDate");

-- CreateIndex
CREATE INDEX "FinancialTransaction_source_documentType_idx" ON "FinancialTransaction"("source", "documentType");

-- CreateIndex
CREATE UNIQUE INDEX "License_key_key" ON "License"("key");

-- CreateIndex
CREATE INDEX "LicenseActivation_licenseId_idx" ON "LicenseActivation"("licenseId");

-- CreateIndex
CREATE INDEX "LicenseActivation_deviceId_idx" ON "LicenseActivation"("deviceId");

-- CreateIndex
CREATE INDEX "LicenseEvent_licenseId_createdAt_idx" ON "LicenseEvent"("licenseId", "createdAt");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "Fabric"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_materialTypeId_fkey" FOREIGN KEY ("materialTypeId") REFERENCES "MaterialType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "TaxRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRecipe" ADD CONSTRAINT "ProductRecipe_accessoryId_fkey" FOREIGN KEY ("accessoryId") REFERENCES "Accessory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRecipe" ADD CONSTRAINT "ProductRecipe_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "Fabric"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRecipe" ADD CONSTRAINT "ProductRecipe_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpreadingMachine" ADD CONSTRAINT "SpreadingMachine_cuttingTableId_fkey" FOREIGN KEY ("cuttingTableId") REFERENCES "CuttingTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_entries" ADD CONSTRAINT "fabric_entries_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "Color"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_entries" ADD CONSTRAINT "fabric_entries_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "Fabric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_exits" ADD CONSTRAINT "fabric_exits_cuttingTableId_fkey" FOREIGN KEY ("cuttingTableId") REFERENCES "CuttingTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_exits" ADD CONSTRAINT "fabric_exits_fabricEntryId_fkey" FOREIGN KEY ("fabricEntryId") REFERENCES "fabric_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerOrder" ADD CONSTRAINT "CustomerOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerOrderItem" ADD CONSTRAINT "CustomerOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CustomerOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fabric" ADD CONSTRAINT "Fabric_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricReturn" ADD CONSTRAINT "FabricReturn_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "Fabric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricReturn" ADD CONSTRAINT "FabricReturn_relatedDocumentId_fkey" FOREIGN KEY ("relatedDocumentId") REFERENCES "FabricDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricOrder" ADD CONSTRAINT "FabricOrder_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "Color"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricOrder" ADD CONSTRAINT "FabricOrder_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "Fabric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricOrder" ADD CONSTRAINT "FabricOrder_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "FabricPattern"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricOrder" ADD CONSTRAINT "FabricOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accessory" ADD CONSTRAINT "Accessory_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoryOrder" ADD CONSTRAINT "AccessoryOrder_accessoryId_fkey" FOREIGN KEY ("accessoryId") REFERENCES "Accessory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoryOrder" ADD CONSTRAINT "AccessoryOrder_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "Color"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoryOrder" ADD CONSTRAINT "AccessoryOrder_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "FabricPattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoryOrder" ADD CONSTRAINT "AccessoryOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoryDocument" ADD CONSTRAINT "AccessoryDocument_accessoryId_fkey" FOREIGN KEY ("accessoryId") REFERENCES "Accessory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoryDocument" ADD CONSTRAINT "AccessoryDocument_accessoryOrderId_fkey" FOREIGN KEY ("accessoryOrderId") REFERENCES "AccessoryOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoryDocument" ADD CONSTRAINT "AccessoryDocument_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "Color"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricDocument" ADD CONSTRAINT "FabricDocument_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "Color"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricDocument" ADD CONSTRAINT "FabricDocument_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "Fabric"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricDocument" ADD CONSTRAINT "FabricDocument_fabricOrderId_fkey" FOREIGN KEY ("fabricOrderId") REFERENCES "FabricOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityInspection" ADD CONSTRAINT "QualityInspection_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FasonTracking" ADD CONSTRAINT "FasonTracking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FasonTracking" ADD CONSTRAINT "FasonTracking_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FasonTracking" ADD CONSTRAINT "FasonTracking_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "FasonWorkshop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpreadingRun" ADD CONSTRAINT "SpreadingRun_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpreadingRun" ADD CONSTRAINT "SpreadingRun_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "SpreadingMachine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpreadingRun" ADD CONSTRAINT "SpreadingRun_cuttingTableId_fkey" FOREIGN KEY ("cuttingTableId") REFERENCES "CuttingTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpreadingLayer" ADD CONSTRAINT "SpreadingLayer_spreadingRunId_fkey" FOREIGN KEY ("spreadingRunId") REFERENCES "SpreadingRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_locations" ADD CONSTRAINT "vehicle_locations_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseActivation" ADD CONSTRAINT "LicenseActivation_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseEvent" ADD CONSTRAINT "LicenseEvent_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE SET NULL ON UPDATE CASCADE;
