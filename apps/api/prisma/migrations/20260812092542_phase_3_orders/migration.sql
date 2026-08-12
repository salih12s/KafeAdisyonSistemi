-- CreateEnum
CREATE TYPE "CheckStatus" AS ENUM ('OPEN', 'CANCELLED');

-- CreateTable
CREATE TABLE "Check" (
    "id" UUID NOT NULL,
    "tableId" UUID NOT NULL,
    "openedByUserId" UUID NOT NULL,
    "guestCount" INTEGER NOT NULL,
    "status" "CheckStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalKurus" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Check_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL,
    "checkId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "unitPriceKurusSnapshot" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "lineTotalKurus" INTEGER NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancellationReason" TEXT,
    "cancelledByUserId" UUID,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemOption" (
    "id" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "optionGroupId" UUID NOT NULL,
    "optionValueId" UUID NOT NULL,
    "groupNameSnapshot" TEXT NOT NULL,
    "valueNameSnapshot" TEXT NOT NULL,
    "priceDeltaKurusSnapshot" INTEGER NOT NULL,

    CONSTRAINT "OrderItemOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Check_tableId_status_idx" ON "Check"("tableId", "status");

-- CreateIndex
CREATE INDEX "Check_status_openedAt_idx" ON "Check"("status", "openedAt");

-- Aynı masada eş zamanlı yalnız bir OPEN adisyon bulunabilir.
CREATE UNIQUE INDEX "Check_one_open_per_table_key" ON "Check"("tableId") WHERE "status" = 'OPEN';

-- CreateIndex
CREATE INDEX "OrderItem_checkId_createdAt_idx" ON "OrderItem"("checkId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "OrderItemOption_optionGroupId_idx" ON "OrderItemOption"("optionGroupId");

-- CreateIndex
CREATE INDEX "OrderItemOption_optionValueId_idx" ON "OrderItemOption"("optionValueId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItemOption_orderItemId_optionValueId_key" ON "OrderItemOption"("orderItemId", "optionValueId");

-- AddForeignKey
ALTER TABLE "Check" ADD CONSTRAINT "Check_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "CafeTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Check" ADD CONSTRAINT "Check_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "Check"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemOption" ADD CONSTRAINT "OrderItemOption_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemOption" ADD CONSTRAINT "OrderItemOption_optionGroupId_fkey" FOREIGN KEY ("optionGroupId") REFERENCES "ProductOptionGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemOption" ADD CONSTRAINT "OrderItemOption_optionValueId_fkey" FOREIGN KEY ("optionValueId") REFERENCES "ProductOptionValue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backend doğrulamasına ek olarak temel sayısal ve iptal bütünlüğünü veritabanında da koru.
ALTER TABLE "Check" ADD CONSTRAINT "Check_guestCount_check" CHECK ("guestCount" BETWEEN 1 AND 50);
ALTER TABLE "Check" ADD CONSTRAINT "Check_totalKurus_check" CHECK ("totalKurus" >= 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quantity_check" CHECK ("quantity" BETWEEN 1 AND 100);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_prices_check" CHECK ("unitPriceKurusSnapshot" >= 0 AND "lineTotalKurus" >= 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_cancellation_check" CHECK (
    ("cancelledAt" IS NULL AND "cancelledByUserId" IS NULL AND "cancellationReason" IS NULL)
    OR
    ("cancelledAt" IS NOT NULL AND "cancelledByUserId" IS NOT NULL AND "cancellationReason" IS NOT NULL)
);
