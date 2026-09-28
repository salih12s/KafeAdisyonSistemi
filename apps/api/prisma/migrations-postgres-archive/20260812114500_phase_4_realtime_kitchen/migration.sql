-- Phase 4: additive kitchen/bar routing snapshot and preparation workflow.
CREATE TYPE "OrderItemStatus" AS ENUM ('SENT', 'PREPARING', 'READY', 'SERVED');

ALTER TABLE "OrderItem"
ADD COLUMN "preparationAreaSnapshot" "PreparationArea",
ADD COLUMN "preparationStatus" "OrderItemStatus" NOT NULL DEFAULT 'SENT';

-- Existing Phase 3 items inherit the product's current station once. Future product
-- changes cannot reroute an already-created order item because this column is a snapshot.
UPDATE "OrderItem" AS item
SET "preparationAreaSnapshot" = product."preparationArea"
FROM "Product" AS product
WHERE product."id" = item."productId";

ALTER TABLE "OrderItem"
ALTER COLUMN "preparationAreaSnapshot" SET NOT NULL;

CREATE INDEX "OrderItem_preparationAreaSnapshot_preparationStatus_create_idx"
ON "OrderItem"("preparationAreaSnapshot", "preparationStatus", "createdAt");
