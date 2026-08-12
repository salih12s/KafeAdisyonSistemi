-- Geçmiş kategori satışlarının ürün daha sonra taşınsa bile değişmemesi için
-- sipariş anındaki kategori kimliği ve adı kalemde saklanır.
ALTER TABLE "OrderItem"
ADD COLUMN "categoryIdSnapshot" UUID,
ADD COLUMN "categoryNameSnapshot" TEXT;

UPDATE "OrderItem" AS item
SET
  "categoryIdSnapshot" = category."id",
  "categoryNameSnapshot" = category."name"
FROM "Product" AS product
JOIN "Category" AS category ON category."id" = product."categoryId"
WHERE item."productId" = product."id";

ALTER TABLE "OrderItem"
ALTER COLUMN "categoryIdSnapshot" SET NOT NULL,
ALTER COLUMN "categoryNameSnapshot" SET NOT NULL;
