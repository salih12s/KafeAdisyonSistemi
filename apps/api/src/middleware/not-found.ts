import type { RequestHandler } from 'express';
import { NotFoundError } from '../errors/app-error';

/** Eşleşmeyen istekleri merkezî hata yönetimine devreder. */
export function createNotFoundHandler(): RequestHandler {
  return (req, _res, next) => {
    next(new NotFoundError(`İstenen kaynak bulunamadı: ${req.method} ${req.originalUrl}`));
  };
}
