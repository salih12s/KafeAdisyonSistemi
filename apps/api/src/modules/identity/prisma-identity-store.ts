import { Prisma, type PrismaClient, type User } from '@prisma/client';
import type { BusinessSettingsResponse, CurrentUser, StaffMember } from '@kafe/contracts';
import { StoreError } from '../../shared/store';
import {
  isUniqueConstraint,
  isMissingRecord,
  isSerializationConflict,
} from '../../shared/prisma-errors';
import type {
  IdentityStore,
  BootstrapOwnerInput,
  BusinessUpdateInput,
  CreateSessionInput,
  CreateStaffInput,
  SessionIdentity,
  UpdateStaffInput,
  UserWithPassword,
} from './identity-store';

const BUSINESS_ID = 'business';

function toCurrentUser(user: User): CurrentUser {
  return { id: user.id, fullName: user.fullName, username: user.username, role: user.role };
}

function toUserWithPassword(user: User): UserWithPassword {
  return { ...toCurrentUser(user), passwordHash: user.passwordHash, isActive: user.isActive };
}

function toStaffMember(user: User): StaffMember {
  return {
    ...toCurrentUser(user),
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/** Kimlik, oturum, personel ve işletme ayarının Prisma uygulaması. */
export function createPrismaIdentityStore(client: PrismaClient): IdentityStore {
  return {
    async hasActiveOwner(): Promise<boolean> {
      return (await client.user.count({ where: { role: 'OWNER', isActive: true } })) > 0;
    },

    async bootstrapOwner(input: BootstrapOwnerInput): Promise<CurrentUser> {
      try {
        return await client.$transaction(
          async (transaction) => {
            if ((await transaction.user.count({ where: { role: 'OWNER', isActive: true } })) > 0) {
              throw new StoreError('ALREADY_INITIALIZED', 'Aktif işletme sahibi zaten mevcut.');
            }

            const user = await transaction.user.create({
              data: {
                fullName: input.fullName,
                username: input.username,
                passwordHash: input.passwordHash,
                role: 'OWNER',
              },
            });

            await transaction.businessSettings.upsert({
              where: { id: BUSINESS_ID },
              create: { id: BUSINESS_ID, businessName: input.businessName },
              update: { businessName: input.businessName },
            });
            await transaction.auditLog.create({
              data: {
                actorUserId: user.id,
                action: 'OWNER_CREATED',
                entityType: 'User',
                entityId: user.id,
                metadata: { username: user.username },
              },
            });

            return toCurrentUser(user);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new StoreError('CONFLICT', 'Bu kullanıcı adı zaten kullanılıyor.');
        }
        if (isSerializationConflict(error)) {
          throw new StoreError(
            'ALREADY_INITIALIZED',
            'Kurulum durumu aynı anda değişti; komutu yeniden çalıştırın.',
          );
        }
        throw error;
      }
    },

    async findUserByUsername(username: string): Promise<UserWithPassword | null> {
      const user = await client.user.findUnique({ where: { username } });
      return user === null ? null : toUserWithPassword(user);
    },

    async createLoginSession(input: CreateSessionInput): Promise<void> {
      await client.$transaction([
        client.user.update({ where: { id: input.userId }, data: { lastLoginAt: input.now } }),
        client.session.create({
          data: {
            userId: input.userId,
            tokenHash: input.tokenHash,
            expiresAt: input.expiresAt,
            lastSeenAt: input.now,
          },
        }),
      ]);
    },

    async findSession(tokenHash: string): Promise<SessionIdentity | null> {
      const session = await client.session.findUnique({
        where: { tokenHash },
        include: { user: true },
      });
      if (session === null) return null;
      return {
        id: session.id,
        tokenHash: session.tokenHash,
        expiresAt: session.expiresAt,
        user: toUserWithPassword(session.user),
      };
    },

    async touchSession(sessionId: string, now: Date): Promise<void> {
      await client.session.update({ where: { id: sessionId }, data: { lastSeenAt: now } });
    },

    async deleteSession(tokenHash: string): Promise<void> {
      await client.session.deleteMany({ where: { tokenHash } });
    },

    async changePassword(input): Promise<void> {
      await client.$transaction(async (transaction) => {
        await transaction.user.update({
          where: { id: input.actorUserId },
          data: { passwordHash: input.passwordHash },
        });
        await transaction.session.deleteMany({
          where: { userId: input.actorUserId, tokenHash: { not: input.currentTokenHash } },
        });
        await transaction.auditLog.create({
          data: {
            actorUserId: input.actorUserId,
            action: 'PASSWORD_CHANGED',
            entityType: 'User',
            entityId: input.actorUserId,
          },
        });
      });
    },

    async listStaff(): Promise<StaffMember[]> {
      const users = await client.user.findMany({
        orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
      });
      return users.map(toStaffMember);
    },

    async createStaff(input: CreateStaffInput): Promise<StaffMember> {
      try {
        return await client.$transaction(async (transaction) => {
          const user = await transaction.user.create({
            data: {
              fullName: input.fullName,
              username: input.username,
              passwordHash: input.passwordHash,
              role: input.role,
            },
          });
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'STAFF_CREATED',
              entityType: 'User',
              entityId: user.id,
              metadata: { username: user.username, role: user.role },
            },
          });
          return toStaffMember(user);
        });
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new StoreError('CONFLICT', 'Bu kullanıcı adı zaten kullanılıyor.');
        }
        throw error;
      }
    },

    async updateStaff(input: UpdateStaffInput): Promise<StaffMember> {
      try {
        return await client.$transaction(
          async (transaction) => {
            const current = await transaction.user.findUnique({
              where: { id: input.targetUserId },
            });
            if (current === null) throw new StoreError('NOT_FOUND', 'Personel bulunamadı.');
            if (input.actorUserId === current.id && !input.isActive) {
              throw new StoreError('SELF_DEACTIVATE', 'Kendi hesabınızı pasife alamazsınız.');
            }
            if (
              current.role === 'OWNER' &&
              current.isActive &&
              (input.role !== 'OWNER' || !input.isActive)
            ) {
              const ownerCount = await transaction.user.count({
                where: { role: 'OWNER', isActive: true },
              });
              if (ownerCount <= 1) {
                throw new StoreError(
                  'LAST_OWNER',
                  'Son aktif işletme sahibi pasife alınamaz veya rolü değiştirilemez.',
                );
              }
            }

            const user = await transaction.user.update({
              where: { id: input.targetUserId },
              data: { fullName: input.fullName, role: input.role, isActive: input.isActive },
            });
            if (!input.isActive) {
              await transaction.session.deleteMany({ where: { userId: user.id } });
            }
            await transaction.auditLog.create({
              data: {
                actorUserId: input.actorUserId,
                action: 'STAFF_UPDATED',
                entityType: 'User',
                entityId: user.id,
                metadata: { role: user.role, isActive: user.isActive },
              },
            });
            return toStaffMember(user);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (isMissingRecord(error)) throw new StoreError('NOT_FOUND', 'Personel bulunamadı.');
        if (isSerializationConflict(error)) {
          throw new StoreError(
            'CONFLICT',
            'Personel durumu aynı anda değişti; işlemi yeniden deneyin.',
          );
        }
        throw error;
      }
    },

    async resetStaffPassword(input): Promise<void> {
      try {
        await client.$transaction(async (transaction) => {
          await transaction.user.update({
            where: { id: input.targetUserId },
            data: { passwordHash: input.passwordHash },
          });
          await transaction.session.deleteMany({ where: { userId: input.targetUserId } });
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'STAFF_PASSWORD_RESET',
              entityType: 'User',
              entityId: input.targetUserId,
            },
          });
        });
      } catch (error) {
        if (isMissingRecord(error)) throw new StoreError('NOT_FOUND', 'Personel bulunamadı.');
        throw error;
      }
    },

    async getBusinessSettings(): Promise<BusinessSettingsResponse | null> {
      const settings = await client.businessSettings.findUnique({ where: { id: BUSINESS_ID } });
      if (settings === null) return null;
      return {
        id: settings.id,
        businessName: settings.businessName,
        phone: settings.phone,
        address: settings.address,
        updatedAt: settings.updatedAt.toISOString(),
      };
    },

    async updateBusinessSettings(input: BusinessUpdateInput): Promise<BusinessSettingsResponse> {
      const settings = await client.$transaction(async (transaction) => {
        const updated = await transaction.businessSettings.upsert({
          where: { id: BUSINESS_ID },
          create: {
            id: BUSINESS_ID,
            businessName: input.businessName,
            phone: input.phone,
            address: input.address,
          },
          update: { businessName: input.businessName, phone: input.phone, address: input.address },
        });
        await transaction.auditLog.create({
          data: {
            actorUserId: input.actorUserId,
            action: 'BUSINESS_UPDATED',
            entityType: 'BusinessSettings',
            entityId: BUSINESS_ID,
          },
        });
        return updated;
      });
      return {
        id: settings.id,
        businessName: settings.businessName,
        phone: settings.phone,
        address: settings.address,
        updatedAt: settings.updatedAt.toISOString(),
      };
    },
  };
}
