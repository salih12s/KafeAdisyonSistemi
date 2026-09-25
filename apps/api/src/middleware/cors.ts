import type { NextFunction, Request, RequestHandler, Response } from 'express';

const ALLOWED_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
const ALLOWED_HEADERS = 'Content-Type,Accept';
const MAX_AGE_SECONDS = '600';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Origin, API'nin kendi adresi mi? Tarayıcı aynı origin POST isteklerinde de
 * `Origin` gönderir; bu istekler izin listesinde olmasa bile güvenilirdir.
 */
function isSameOrigin(origin: string, host: string | undefined): boolean {
  if (host === undefined) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    // "null" gibi ayrıştırılamayan origin değerleri hiçbir zaman aynı origin değildir.
    return false;
  }
}

/**
 * Çerezli bir isteğin geldiği origin güvenilir mi? `Origin` taşımayan istekler
 * (curl, sunucu-sunucu, eski tarayıcıların aynı origin GET'leri) tarayıcı
 * kaynaklı siteler arası istek olamayacağı için güvenilir sayılır.
 */
export function isTrustedOrigin(
  origin: string | undefined,
  host: string | undefined,
  allowlist: ReadonlySet<string>,
): boolean {
  if (origin === undefined) return true;
  return allowlist.has(origin) || isSameOrigin(origin, host);
}

/**
 * Arayüz API'den ayrı barındırıldığında kullanılan dar kapsamlı CORS katmanı.
 *
 * Yalnız `CORS_ORIGIN` içinde birebir yazılı origin'lere izin verilir; joker (`*`)
 * kullanılmaz. Oturum çerezi taşınabilmesi için `Allow-Credentials` gerekir ve
 * bu, joker origin ile birlikte kullanılamaz. İzin verilmeyen origin'e CORS
 * başlığı hiç yazılmaz.
 *
 * Bu kurulumda çerez `SameSite=None` olduğu için tarayıcı, başka bir sitedeki
 * düz HTML formundan gelen isteğe de çerezi ekler. CORS yalnız yanıtın
 * okunmasını engeller; isteğin işlenmesini engellemez. Bu yüzden izinsiz
 * origin'den gelen durum değiştiren istekler burada 403 ile reddedilir (CSRF).
 */
export function createCorsHandler(allowedOrigins: readonly string[]): RequestHandler {
  const allowlist = new Set(allowedOrigins);

  return function corsHandler(req: Request, res: Response, next: NextFunction): void {
    const origin = req.headers.origin;

    // Yanıt origin'e göre değiştiği için ara önbellekler bunu her yanıtta ayırmalıdır.
    res.vary('Origin');

    if (typeof origin !== 'string' || !allowlist.has(origin)) {
      const trusted = isTrustedOrigin(origin, req.headers.host, allowlist);
      if (req.method === 'OPTIONS' || (!trusted && !SAFE_METHODS.has(req.method))) {
        res.status(403).end();
        return;
      }
      next();
      return;
    }

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');

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
