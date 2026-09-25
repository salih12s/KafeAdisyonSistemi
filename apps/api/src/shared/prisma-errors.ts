import { Prisma } from '@prisma/client';

/** Prisma'nın bilinen hata kodlarını store katmanında anlamlı sorulara çevirir. */

/** P2002: unique kısıtı ihlali (aynı ad, aynı kayıt). */
export function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** P2025: güncellenecek veya okunacak kayıt yok. */
export function isMissingRecord(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

/** P2034: serializable transaction çakışması; istemci yeniden denemelidir. */
export function isSerializationConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}
