import type { AuthenticatedIdentity } from '../modules/identity/identity-service';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedIdentity;
    }
  }
}

export {};
