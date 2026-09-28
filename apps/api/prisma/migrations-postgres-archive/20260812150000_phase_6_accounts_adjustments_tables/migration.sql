-- Phase 6: additive customer ledger, discounts, complimentary items and check merge lifecycle.
ALTER TYPE "CheckStatus" ADD VALUE 'MERGED';
ALTER TYPE "PaymentMethod" ADD VALUE 'ACCOUNT';
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED');
CREATE TYPE "AccountEntryType" AS ENUM ('DEBT', 'COLLECTION', 'REFUND', 'CORRECTION');

ALTER TABLE "Check" ADD COLUMN "mergedIntoCheckId" UUID;
ALTER TABLE "OrderItem" ADD COLUMN "complimentaryReason" TEXT,
ADD COLUMN "complimentaryByUserId" UUID,
ADD COLUMN "complimentaryAt" TIMESTAMP(3);

CREATE TABLE "CheckDiscount" (
  "id" UUID NOT NULL, "checkId" UUID NOT NULL, "type" "DiscountType" NOT NULL,
  "value" INTEGER NOT NULL, "amountKurus" INTEGER NOT NULL, "reason" TEXT NOT NULL,
  "appliedByUserId" UUID NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CheckDiscount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CheckDiscount_value_positive" CHECK ("value" > 0 AND "amountKurus" >= 0)
);

CREATE TABLE "Customer" (
  "id" UUID NOT NULL, "name" TEXT NOT NULL, "phone" TEXT, "note" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountEntry" (
  "id" UUID NOT NULL, "customerId" UUID NOT NULL, "type" "AccountEntryType" NOT NULL,
  "amountKurus" INTEGER NOT NULL, "description" TEXT NOT NULL, "checkId" UUID,
  "actorUserId" UUID NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountEntry_amountKurus_positive" CHECK ("amountKurus" > 0)
);

CREATE INDEX "CheckDiscount_checkId_createdAt_idx" ON "CheckDiscount"("checkId", "createdAt");
CREATE INDEX "Customer_isActive_name_idx" ON "Customer"("isActive", "name");
CREATE INDEX "AccountEntry_customerId_createdAt_idx" ON "AccountEntry"("customerId", "createdAt");
CREATE INDEX "AccountEntry_checkId_idx" ON "AccountEntry"("checkId");

ALTER TABLE "Check" ADD CONSTRAINT "Check_mergedIntoCheckId_fkey" FOREIGN KEY ("mergedIntoCheckId") REFERENCES "Check"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_complimentaryByUserId_fkey" FOREIGN KEY ("complimentaryByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CheckDiscount" ADD CONSTRAINT "CheckDiscount_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "Check"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CheckDiscount" ADD CONSTRAINT "CheckDiscount_appliedByUserId_fkey" FOREIGN KEY ("appliedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountEntry" ADD CONSTRAINT "AccountEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountEntry" ADD CONSTRAINT "AccountEntry_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "Check"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountEntry" ADD CONSTRAINT "AccountEntry_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_complimentary_check" CHECK (
  ("complimentaryAt" IS NULL AND "complimentaryByUserId" IS NULL AND "complimentaryReason" IS NULL)
  OR ("complimentaryAt" IS NOT NULL AND "complimentaryByUserId" IS NOT NULL AND "complimentaryReason" IS NOT NULL)
);
