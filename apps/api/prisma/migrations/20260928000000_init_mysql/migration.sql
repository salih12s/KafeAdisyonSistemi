-- MySQL/MariaDB baseline (ADR-026). PostgreSQL migration geçmişi
-- prisma/migrations-postgres-archive altında yalnız kayıt için durur.

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(36) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('OWNER', 'CASHIER', 'WAITER', 'KITCHEN') NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_username_key`(`username`),
    INDEX `User_role_isActive_idx`(`role`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Session_tokenHash_key`(`tokenHash`),
    INDEX `Session_userId_idx`(`userId`),
    INDEX `Session_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BusinessSettings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'business',
    `businessName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `address` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DiningArea` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameKey` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DiningArea_nameKey_key`(`nameKey`),
    INDEX `DiningArea_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CafeTable` (
    `id` VARCHAR(36) NOT NULL,
    `areaId` VARCHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameKey` VARCHAR(191) NOT NULL,
    `capacity` INTEGER NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CafeTable_areaId_isActive_sortOrder_idx`(`areaId`, `isActive`, `sortOrder`),
    UNIQUE INDEX `CafeTable_areaId_nameKey_key`(`areaId`, `nameKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameKey` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Category_nameKey_key`(`nameKey`),
    INDEX `Category_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` VARCHAR(36) NOT NULL,
    `categoryId` VARCHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameKey` VARCHAR(191) NOT NULL,
    `priceKurus` INTEGER NOT NULL,
    `preparationArea` ENUM('KITCHEN', 'BAR') NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Product_categoryId_isActive_sortOrder_idx`(`categoryId`, `isActive`, `sortOrder`),
    UNIQUE INDEX `Product_categoryId_nameKey_key`(`categoryId`, `nameKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductOptionGroup` (
    `id` VARCHAR(36) NOT NULL,
    `productId` VARCHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameKey` VARCHAR(191) NOT NULL,
    `selectionType` ENUM('SINGLE', 'MULTIPLE') NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProductOptionGroup_productId_isActive_sortOrder_idx`(`productId`, `isActive`, `sortOrder`),
    UNIQUE INDEX `ProductOptionGroup_productId_nameKey_key`(`productId`, `nameKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductOptionValue` (
    `id` VARCHAR(36) NOT NULL,
    `groupId` VARCHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameKey` VARCHAR(191) NOT NULL,
    `priceDeltaKurus` INTEGER NOT NULL DEFAULT 0,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProductOptionValue_groupId_isActive_sortOrder_idx`(`groupId`, `isActive`, `sortOrder`),
    UNIQUE INDEX `ProductOptionValue_groupId_nameKey_key`(`groupId`, `nameKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Check` (
    `id` VARCHAR(36) NOT NULL,
    `tableId` VARCHAR(36) NOT NULL,
    `openedByUserId` VARCHAR(36) NOT NULL,
    `guestCount` INTEGER NOT NULL,
    `status` ENUM('OPEN', 'CANCELLED', 'PAID', 'MERGED') NOT NULL DEFAULT 'OPEN',
    `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closedAt` DATETIME(3) NULL,
    `closedByUserId` VARCHAR(36) NULL,
    `mergedIntoCheckId` VARCHAR(36) NULL,
    `totalKurus` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,
    `openTableKey` VARCHAR(36) GENERATED ALWAYS AS (CASE WHEN `status` = 'OPEN' THEN `tableId` END) STORED,

    UNIQUE INDEX `Check_one_open_per_table_key`(`openTableKey`),
    INDEX `Check_tableId_status_idx`(`tableId`, `status`),
    INDEX `Check_status_openedAt_idx`(`status`, `openedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(36) NOT NULL,
    `checkId` VARCHAR(36) NOT NULL,
    `method` ENUM('CASH', 'CARD', 'ACCOUNT') NOT NULL,
    `amountKurus` INTEGER NOT NULL,
    `receivedByUserId` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Payment_checkId_createdAt_idx`(`checkId`, `createdAt`),
    INDEX `Payment_receivedByUserId_createdAt_idx`(`receivedByUserId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CheckDiscount` (
    `id` VARCHAR(36) NOT NULL,
    `checkId` VARCHAR(36) NOT NULL,
    `type` ENUM('PERCENT', 'FIXED') NOT NULL,
    `value` INTEGER NOT NULL,
    `amountKurus` INTEGER NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `appliedByUserId` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CheckDiscount_checkId_createdAt_idx`(`checkId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Customer` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(500) NULL,
    `note` VARCHAR(500) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Customer_isActive_name_idx`(`isActive`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AccountEntry` (
    `id` VARCHAR(36) NOT NULL,
    `customerId` VARCHAR(36) NOT NULL,
    `type` ENUM('DEBT', 'COLLECTION', 'REFUND', 'CORRECTION') NOT NULL,
    `amountKurus` INTEGER NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `checkId` VARCHAR(36) NULL,
    `actorUserId` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AccountEntry_customerId_createdAt_idx`(`customerId`, `createdAt`),
    INDEX `AccountEntry_checkId_idx`(`checkId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderItem` (
    `id` VARCHAR(36) NOT NULL,
    `checkId` VARCHAR(36) NOT NULL,
    `productId` VARCHAR(36) NOT NULL,
    `productNameSnapshot` VARCHAR(191) NOT NULL,
    `categoryIdSnapshot` VARCHAR(36) NOT NULL,
    `categoryNameSnapshot` VARCHAR(191) NOT NULL,
    `unitPriceKurusSnapshot` INTEGER NOT NULL,
    `preparationAreaSnapshot` ENUM('KITCHEN', 'BAR') NOT NULL,
    `preparationStatus` ENUM('SENT', 'PREPARING', 'READY', 'SERVED') NOT NULL DEFAULT 'SENT',
    `quantity` INTEGER NOT NULL,
    `note` VARCHAR(500) NULL,
    `lineTotalKurus` INTEGER NOT NULL,
    `createdByUserId` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `cancellationReason` VARCHAR(500) NULL,
    `cancelledByUserId` VARCHAR(36) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `complimentaryReason` VARCHAR(500) NULL,
    `complimentaryByUserId` VARCHAR(36) NULL,
    `complimentaryAt` DATETIME(3) NULL,

    INDEX `OrderItem_checkId_createdAt_idx`(`checkId`, `createdAt`),
    INDEX `OrderItem_preparationAreaSnapshot_preparationStatus_create_idx`(`preparationAreaSnapshot`, `preparationStatus`, `createdAt`),
    INDEX `OrderItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderItemOption` (
    `id` VARCHAR(36) NOT NULL,
    `orderItemId` VARCHAR(36) NOT NULL,
    `optionGroupId` VARCHAR(36) NOT NULL,
    `optionValueId` VARCHAR(36) NOT NULL,
    `groupNameSnapshot` VARCHAR(191) NOT NULL,
    `valueNameSnapshot` VARCHAR(191) NOT NULL,
    `priceDeltaKurusSnapshot` INTEGER NOT NULL,

    INDEX `OrderItemOption_optionGroupId_idx`(`optionGroupId`),
    INDEX `OrderItemOption_optionValueId_idx`(`optionValueId`),
    UNIQUE INDEX `OrderItemOption_orderItemId_optionValueId_key`(`orderItemId`, `optionValueId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(36) NOT NULL,
    `actorUserId` VARCHAR(36) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_actorUserId_createdAt_idx`(`actorUserId`, `createdAt`),
    INDEX `AuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CashSession` (
    `id` VARCHAR(36) NOT NULL,
    `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `openedByUserId` VARCHAR(36) NOT NULL,
    `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `openingCashKurus` INTEGER NOT NULL,
    `openingNote` VARCHAR(500) NULL,
    `closedByUserId` VARCHAR(36) NULL,
    `closedAt` DATETIME(3) NULL,
    `countedCashKurus` INTEGER NULL,
    `expectedCashKurus` INTEGER NULL,
    `closingNote` VARCHAR(500) NULL,
    `openKey` VARCHAR(4) GENERATED ALWAYS AS (CASE WHEN `status` = 'OPEN' THEN 'OPEN' END) STORED,

    UNIQUE INDEX `CashSession_one_open_key`(`openKey`),
    INDEX `CashSession_status_openedAt_idx`(`status`, `openedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CashMovement` (
    `id` VARCHAR(36) NOT NULL,
    `sessionId` VARCHAR(36) NOT NULL,
    `type` ENUM('IN', 'OUT') NOT NULL,
    `amountKurus` INTEGER NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `actorUserId` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CashMovement_sessionId_createdAt_idx`(`sessionId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockItem` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameKey` VARCHAR(191) NOT NULL,
    `unit` ENUM('PIECE', 'GRAM', 'MILLILITER') NOT NULL,
    `lowStockThreshold` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StockItem_nameKey_key`(`nameKey`),
    INDEX `StockItem_isActive_name_idx`(`isActive`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductStockUsage` (
    `id` VARCHAR(36) NOT NULL,
    `productId` VARCHAR(36) NOT NULL,
    `stockItemId` VARCHAR(36) NOT NULL,
    `quantityPerUnit` INTEGER NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProductStockUsage_stockItemId_idx`(`stockItemId`),
    UNIQUE INDEX `ProductStockUsage_productId_stockItemId_key`(`productId`, `stockItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockMovement` (
    `id` VARCHAR(36) NOT NULL,
    `stockItemId` VARCHAR(36) NOT NULL,
    `type` ENUM('PURCHASE', 'SALE', 'WASTE', 'ADJUSTMENT') NOT NULL,
    `quantityDelta` INTEGER NOT NULL,
    `reason` VARCHAR(500) NULL,
    `checkId` VARCHAR(36) NULL,
    `actorUserId` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StockMovement_stockItemId_createdAt_idx`(`stockItemId`, `createdAt`),
    INDEX `StockMovement_checkId_idx`(`checkId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CafeTable` ADD CONSTRAINT `CafeTable_areaId_fkey` FOREIGN KEY (`areaId`) REFERENCES `DiningArea`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductOptionGroup` ADD CONSTRAINT `ProductOptionGroup_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductOptionValue` ADD CONSTRAINT `ProductOptionValue_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `ProductOptionGroup`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Check` ADD CONSTRAINT `Check_tableId_fkey` FOREIGN KEY (`tableId`) REFERENCES `CafeTable`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Check` ADD CONSTRAINT `Check_openedByUserId_fkey` FOREIGN KEY (`openedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Check` ADD CONSTRAINT `Check_closedByUserId_fkey` FOREIGN KEY (`closedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Check` ADD CONSTRAINT `Check_mergedIntoCheckId_fkey` FOREIGN KEY (`mergedIntoCheckId`) REFERENCES `Check`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_checkId_fkey` FOREIGN KEY (`checkId`) REFERENCES `Check`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_receivedByUserId_fkey` FOREIGN KEY (`receivedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CheckDiscount` ADD CONSTRAINT `CheckDiscount_checkId_fkey` FOREIGN KEY (`checkId`) REFERENCES `Check`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CheckDiscount` ADD CONSTRAINT `CheckDiscount_appliedByUserId_fkey` FOREIGN KEY (`appliedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccountEntry` ADD CONSTRAINT `AccountEntry_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccountEntry` ADD CONSTRAINT `AccountEntry_checkId_fkey` FOREIGN KEY (`checkId`) REFERENCES `Check`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccountEntry` ADD CONSTRAINT `AccountEntry_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_checkId_fkey` FOREIGN KEY (`checkId`) REFERENCES `Check`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_cancelledByUserId_fkey` FOREIGN KEY (`cancelledByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_complimentaryByUserId_fkey` FOREIGN KEY (`complimentaryByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `OrderItemOption` ADD CONSTRAINT `OrderItemOption_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `OrderItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItemOption` ADD CONSTRAINT `OrderItemOption_optionGroupId_fkey` FOREIGN KEY (`optionGroupId`) REFERENCES `ProductOptionGroup`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItemOption` ADD CONSTRAINT `OrderItemOption_optionValueId_fkey` FOREIGN KEY (`optionValueId`) REFERENCES `ProductOptionValue`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashSession` ADD CONSTRAINT `CashSession_openedByUserId_fkey` FOREIGN KEY (`openedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashSession` ADD CONSTRAINT `CashSession_closedByUserId_fkey` FOREIGN KEY (`closedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashMovement` ADD CONSTRAINT `CashMovement_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `CashSession`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashMovement` ADD CONSTRAINT `CashMovement_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductStockUsage` ADD CONSTRAINT `ProductStockUsage_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductStockUsage` ADD CONSTRAINT `ProductStockUsage_stockItemId_fkey` FOREIGN KEY (`stockItemId`) REFERENCES `StockItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_stockItemId_fkey` FOREIGN KEY (`stockItemId`) REFERENCES `StockItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_checkId_fkey` FOREIGN KEY (`checkId`) REFERENCES `Check`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Backend doğrulamasına ek olarak sayısal ve iptal/ikram bütünlüğü veritabanında da korunur
-- (PostgreSQL migration'larındaki CHECK kısıtlarının aynısı).
ALTER TABLE `Check` ADD CONSTRAINT `Check_guestCount_check` CHECK (`guestCount` BETWEEN 1 AND 50);
ALTER TABLE `Check` ADD CONSTRAINT `Check_totalKurus_check` CHECK (`totalKurus` >= 0);
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_quantity_check` CHECK (`quantity` BETWEEN 1 AND 100);
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_prices_check` CHECK (`unitPriceKurusSnapshot` >= 0 AND `lineTotalKurus` >= 0);
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_cancellation_check` CHECK (
    (`cancelledAt` IS NULL AND `cancelledByUserId` IS NULL AND `cancellationReason` IS NULL)
    OR
    (`cancelledAt` IS NOT NULL AND `cancelledByUserId` IS NOT NULL AND `cancellationReason` IS NOT NULL)
);
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_complimentary_check` CHECK (
    (`complimentaryAt` IS NULL AND `complimentaryByUserId` IS NULL AND `complimentaryReason` IS NULL)
    OR
    (`complimentaryAt` IS NOT NULL AND `complimentaryByUserId` IS NOT NULL AND `complimentaryReason` IS NOT NULL)
);
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_amountKurus_positive` CHECK (`amountKurus` > 0);
ALTER TABLE `CheckDiscount` ADD CONSTRAINT `CheckDiscount_value_positive` CHECK (`value` > 0 AND `amountKurus` >= 0);
ALTER TABLE `AccountEntry` ADD CONSTRAINT `AccountEntry_amountKurus_positive` CHECK (`amountKurus` > 0);
ALTER TABLE `CashSession` ADD CONSTRAINT `CashSession_openingCashKurus_check` CHECK (`openingCashKurus` >= 0);
ALTER TABLE `CashSession` ADD CONSTRAINT `CashSession_countedCashKurus_check` CHECK (`countedCashKurus` IS NULL OR `countedCashKurus` >= 0);
ALTER TABLE `CashMovement` ADD CONSTRAINT `CashMovement_amountKurus_check` CHECK (`amountKurus` > 0);
ALTER TABLE `StockItem` ADD CONSTRAINT `StockItem_lowStockThreshold_check` CHECK (`lowStockThreshold` >= 0);
ALTER TABLE `ProductStockUsage` ADD CONSTRAINT `ProductStockUsage_quantityPerUnit_check` CHECK (`quantityPerUnit` > 0);
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_quantityDelta_check` CHECK (`quantityDelta` <> 0);
