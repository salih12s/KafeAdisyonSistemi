-- CreateEnum
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "StockUnit" AS ENUM ('PIECE', 'GRAM', 'MILLILITER');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE', 'SALE', 'WASTE', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "CashSession" (
    "id" UUID NOT NULL,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openedByUserId" UUID NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openingCashKurus" INTEGER NOT NULL,
    "openingNote" TEXT,
    "closedByUserId" UUID,
    "closedAt" TIMESTAMP(3),
    "countedCashKurus" INTEGER,
    "expectedCashKurus" INTEGER,
    "closingNote" TEXT,

    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashMovement" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "amountKurus" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "actorUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockItem" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "unit" "StockUnit" NOT NULL,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductStockUsage" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "stockItemId" UUID NOT NULL,
    "quantityPerUnit" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductStockUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" UUID NOT NULL,
    "stockItemId" UUID NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "reason" TEXT,
    "checkId" UUID,
    "actorUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashSession_status_openedAt_idx" ON "CashSession"("status", "openedAt");

-- CreateIndex
CREATE INDEX "CashMovement_sessionId_createdAt_idx" ON "CashMovement"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockItem_nameKey_key" ON "StockItem"("nameKey");

-- CreateIndex
CREATE INDEX "StockItem_isActive_name_idx" ON "StockItem"("isActive", "name");

-- CreateIndex
CREATE INDEX "ProductStockUsage_stockItemId_idx" ON "ProductStockUsage"("stockItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductStockUsage_productId_stockItemId_key" ON "ProductStockUsage"("productId", "stockItemId");

-- CreateIndex
CREATE INDEX "StockMovement_stockItemId_createdAt_idx" ON "StockMovement"("stockItemId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_checkId_idx" ON "StockMovement"("checkId");

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CashSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStockUsage" ADD CONSTRAINT "ProductStockUsage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStockUsage" ADD CONSTRAINT "ProductStockUsage_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "Check"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Aynı anda yalnız bir açık kasa oturumu olabilir (Check_one_open_per_table_key ile aynı desen).
CREATE UNIQUE INDEX "CashSession_one_open_key" ON "CashSession"("status") WHERE "status" = 'OPEN';

-- Tutarlar ve reçete miktarları veritabanı seviyesinde de korunur.
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_openingCashKurus_check" CHECK ("openingCashKurus" >= 0);
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_countedCashKurus_check" CHECK ("countedCashKurus" IS NULL OR "countedCashKurus" >= 0);
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_amountKurus_check" CHECK ("amountKurus" > 0);
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_lowStockThreshold_check" CHECK ("lowStockThreshold" >= 0);
ALTER TABLE "ProductStockUsage" ADD CONSTRAINT "ProductStockUsage_quantityPerUnit_check" CHECK ("quantityPerUnit" > 0);
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_quantityDelta_check" CHECK ("quantityDelta" <> 0);
