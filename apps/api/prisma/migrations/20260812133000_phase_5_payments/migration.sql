-- Phase 5: additive immutable payment ledger and paid-check lifecycle.
ALTER TYPE "CheckStatus" ADD VALUE 'PAID';

CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD');

ALTER TABLE "Check"
ADD COLUMN "closedAt" TIMESTAMP(3),
ADD COLUMN "closedByUserId" UUID;

CREATE TABLE "Payment" (
  "id" UUID NOT NULL,
  "checkId" UUID NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "amountKurus" INTEGER NOT NULL,
  "receivedByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Payment_amountKurus_positive" CHECK ("amountKurus" > 0)
);

CREATE INDEX "Payment_checkId_createdAt_idx" ON "Payment"("checkId", "createdAt");
CREATE INDEX "Payment_receivedByUserId_createdAt_idx" ON "Payment"("receivedByUserId", "createdAt");

ALTER TABLE "Check"
ADD CONSTRAINT "Check_closedByUserId_fkey"
FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_checkId_fkey"
FOREIGN KEY ("checkId") REFERENCES "Check"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_receivedByUserId_fkey"
FOREIGN KEY ("receivedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
