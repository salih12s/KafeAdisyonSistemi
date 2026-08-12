import type { RequestHandler } from 'express';
import type { Logger } from '../lib/logger';

/** Geliştirme sırasında istek/yanıt akışını görünür kılar. Üretimde devreye alınmaz. */
export function createRequestLogger(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

      logger.debug('İstek tamamlandı.', {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs),
      });
    });

    next();
  };
}
