import type { PrismaClient } from '@prisma/client';
import type { AppStore } from './store';
import { createPrismaIdentityStore } from '../modules/identity/prisma-identity-store';
import { createPrismaFloorStore } from '../modules/floor/prisma-floor-store';
import { createPrismaMenuStore } from '../modules/menu/prisma-menu-store';
import { createPrismaOrderStore } from '../modules/orders/prisma-order-store';
import { createPrismaAccountStore } from '../modules/accounts/prisma-account-store';
import { createPrismaReportStore } from '../modules/reports/prisma-report-store';
import { createPrismaCashStore } from '../modules/cash/prisma-cash-store';
import { createPrismaStockStore } from '../modules/stock/prisma-stock-store';

/** Üretim store'u: her modülün Prisma uygulamasını tek AppStore'da birleştirir. */
export function createPrismaStore(client: PrismaClient): AppStore {
  return {
    ...createPrismaIdentityStore(client),
    ...createPrismaFloorStore(client),
    ...createPrismaMenuStore(client),
    ...createPrismaOrderStore(client),
    ...createPrismaAccountStore(client),
    ...createPrismaReportStore(client),
    ...createPrismaCashStore(client),
    ...createPrismaStockStore(client),
  };
}
