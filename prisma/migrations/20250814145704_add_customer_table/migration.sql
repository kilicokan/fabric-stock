-- CreateTable
CREATE TABLE "public"."Customer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "address" TEXT,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);
