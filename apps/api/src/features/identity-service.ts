import { createHash, randomBytes } from 'node:crypto';
import type { CurrentUser, UserRole } from '@kafe/contracts';
import { ConflictError, NotFoundError, UnauthorizedError } from '../errors/app-error';
import { hashPassword, verifyPassword } from './password';
import { StoreError, type AppStore } from './store';

export const SESSION_COOKIE_NAME = 'kafe_session';
export const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

export interface AuthenticatedIdentity {
  user: CurrentUser;
  tokenHash: string;
}

export interface LoginResult extends AuthenticatedIdentity {
  token: string;
  expiresAt: Date;
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeNameKey(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toCurrentUser(user: {
  id: string;
  fullName: string;
  username: string;
  role: UserRole;
}): CurrentUser {
  return { id: user.id, fullName: user.fullName, username: user.username, role: user.role };
}

function translateStoreError(error: unknown): never {
  if (error instanceof StoreError) {
    if (error.code === 'NOT_FOUND') throw new NotFoundError(error.message);
    throw new ConflictError(error.message);
  }
  throw error;
}

export class IdentityService {
  constructor(private readonly store: AppStore) {}

  setupStatus(): Promise<boolean> {
    return this.store.hasActiveOwner();
  }

  async login(usernameInput: string, password: string, now = new Date()): Promise<LoginResult> {
    const username = normalizeUsername(usernameInput);
    const user = await this.store.findUserByUsername(username);

    if (user === null) {
      await hashPassword(password);
      throw new UnauthorizedError('Kullanıcı adı veya şifre hatalı.');
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid || !user.isActive) throw new UnauthorizedError('Kullanıcı adı veya şifre hatalı.');

    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
    await this.store.createLoginSession({ userId: user.id, tokenHash, expiresAt, now });

    return { token, tokenHash, expiresAt, user: toCurrentUser(user) };
  }

  async authenticate(token: string | undefined, now = new Date()): Promise<AuthenticatedIdentity> {
    if (token === undefined || token.length === 0) throw new UnauthorizedError();
    const tokenHash = hashSessionToken(token);
    const session = await this.store.findSession(tokenHash);
    if (session === null || !session.user.isActive) throw new UnauthorizedError();
    if (session.expiresAt.getTime() <= now.getTime()) {
      await this.store.deleteSession(tokenHash);
      throw new UnauthorizedError('Oturumunuzun süresi doldu.');
    }
    await this.store.touchSession(session.id, now);
    return { tokenHash, user: toCurrentUser(session.user) };
  }

  logout(token: string | undefined): Promise<void> {
    return token === undefined
      ? Promise.resolve()
      : this.store.deleteSession(hashSessionToken(token));
  }

  async changePassword(
    identity: AuthenticatedIdentity,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.store.findUserByUsername(identity.user.username);
    if (user === null || !(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new UnauthorizedError('Mevcut şifre hatalı.');
    }
    await this.store.changePassword({
      actorUserId: identity.user.id,
      passwordHash: await hashPassword(newPassword),
      currentTokenHash: identity.tokenHash,
    });
  }

  async createStaff(input: {
    actorUserId: string;
    fullName: string;
    username: string;
    password: string;
    role: UserRole;
  }) {
    try {
      return await this.store.createStaff({
        actorUserId: input.actorUserId,
        fullName: input.fullName.trim(),
        username: normalizeUsername(input.username),
        passwordHash: await hashPassword(input.password),
        role: input.role,
      });
    } catch (error) {
      translateStoreError(error);
    }
  }

  async updateStaff(input: {
    actorUserId: string;
    targetUserId: string;
    fullName: string;
    role: UserRole;
    isActive: boolean;
  }) {
    try {
      return await this.store.updateStaff({ ...input, fullName: input.fullName.trim() });
    } catch (error) {
      translateStoreError(error);
    }
  }

  async resetStaffPassword(
    actorUserId: string,
    targetUserId: string,
    password: string,
  ): Promise<void> {
    try {
      await this.store.resetStaffPassword({
        actorUserId,
        targetUserId,
        passwordHash: await hashPassword(password),
      });
    } catch (error) {
      translateStoreError(error);
    }
  }

  bootstrapOwner(input: {
    businessName: string;
    fullName: string;
    username: string;
    password: string;
  }): Promise<CurrentUser> {
    return hashPassword(input.password).then((passwordHash) =>
      this.store.bootstrapOwner({
        businessName: input.businessName.trim(),
        fullName: input.fullName.trim(),
        username: normalizeUsername(input.username),
        passwordHash,
      }),
    );
  }
}
