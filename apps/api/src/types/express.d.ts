import type { AuthenticatedIdentity } from '../features/identity-service';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedIdentity;
    }
  }
}

export {};
