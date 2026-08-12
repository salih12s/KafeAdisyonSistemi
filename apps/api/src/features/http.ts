import type { RequestHandler } from 'express';
import type { Permission } from '@kafe/contracts';
import { ForbiddenError, UnauthorizedError, ValidationError } from '../errors/app-error';
import type { IdentityService } from './identity-service';
import { hasPermission } from './permissions';

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (header === undefined) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function requireAuthentication(
  identityService: IdentityService,
  cookieName: string,
): RequestHandler {
  return async (req, _res, next) => {
    req.auth = await identityService.authenticate(readCookie(req.headers.cookie, cookieName));
    next();
  };
}

export function requirePermission(permission: Permission): RequestHandler {
  return (req, _res, next) => {
    if (req.auth === undefined) throw new UnauthorizedError();
    if (!hasPermission(req.auth.user.role, permission)) throw new ForbiddenError();
    next();
  };
}

export function requireAuth(req: Express.Request) {
  if (req.auth === undefined) throw new UnauthorizedError();
  return req.auth;
}

export function validationDetails(error: {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}): ValidationError {
  const details = error.issues.map((issue) => {
    const path = issue.path.map(String).join('.');
    return path.length === 0 ? issue.message : `${path}: ${issue.message}`;
  });
  return new ValidationError('Gönderilen bilgiler geçersiz.', details);
}
