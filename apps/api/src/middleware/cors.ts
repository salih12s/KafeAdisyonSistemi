import type { NextFunction, Request, RequestHandler, Response } from 'express';

const ALLOWED_METHODS = 'GET,POST,PATCH,DELETE,OPTIONS';
const ALLOWED_HEADERS = 'Content-Type,Accept';
const MAX_AGE_SECONDS = '600';

/**
 * Arayüz API'den ayrı barındırıldığında kullanılan dar kapsamlı CORS katmanı.
 *
 * Yalnız `CORS_ORIGIN` içinde birebir yazılı origin'lere izin verilir; joker (`*`)
 * kullanılmaz. Oturum çerezi taşınabilmesi için `Allow-Credentials` gerekir ve
 * bu, joker origin ile birlikte kullanılamaz. İzin verilmeyen origin'e CORS
 * başlığı hiç yazılmaz; tarayıcı isteği kendisi engeller.
 */
export function createCorsHandler(allowedOrigins: readonly string[]): RequestHandler {
  const allowlist = new Set(allowedOrigins);

  return function corsHandler(req: Request, res: Response, next: NextFunction): void {
    const origin = req.headers.origin;

    // Origin başlığı taşımayan istekler (aynı origin, curl, sunucu-sunucu)
    // CORS kapsamında değildir; olduğu gibi geçer.
    if (typeof origin !== 'string' || !allowlist.has(origin)) {
      if (req.method === 'OPTIONS') {
        res.setHeader('Vary', 'Origin');
        res.status(403).end();
        return;
      }
      next();
      return;
    }

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    // Yanıt origin'e göre değiştiği için ara önbellekler bunu ayırmalıdır.
    res.setHeader('Vary', 'Origin');

    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
      res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
      res.setHeader('Access-Control-Max-Age', MAX_AGE_SECONDS);
      res.status(204).end();
      return;
    }

    next();
  };
}
