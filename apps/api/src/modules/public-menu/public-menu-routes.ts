import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { PublicMenuResponse } from '@kafe/contracts';
import type { AppStore } from '../../shared/store';

const FALLBACK_BUSINESS_NAME = 'Menü';

/**
 * Oturum gerektirmeyen uçlar. Yalnız okuma yapar ve yalnız müşteriye zaten
 * açık olan bilgiyi (aktif menü, fiyat, işletme adı, telefon, adres) döndürür.
 * QR menü içindir.
 */
export function createPublicMenuRouter(store: AppStore): Router {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
  });

  router.get('/menu', limiter, async (_req, res) => {
    const [menu, business] = await Promise.all([store.getMenu(), store.getBusinessSettings()]);
    const body: PublicMenuResponse = {
      businessName: business?.businessName ?? FALLBACK_BUSINESS_NAME,
      phone: business?.phone ?? null,
      address: business?.address ?? null,
      categories: menu.categories.filter((category) => category.products.length > 0),
    };
    // Menü sık değişmez; kısa önbellek aynı masadaki telefonların yükünü azaltır.
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(body);
  });

  return router;
}
