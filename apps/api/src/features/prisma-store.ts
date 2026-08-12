import { Prisma, type PrismaClient, type User } from '@prisma/client';
import type {
  BusinessSettingsResponse,
  CafeTableResponse,
  CurrentUser,
  DiningAreaResponse,
  FloorPlanResponse,
  StaffMember,
} from '@kafe/contracts';
import {
  StoreError,
  type AppStore,
  type AreaWriteInput,
  type BootstrapOwnerInput,
  type BusinessUpdateInput,
  type CreateSessionInput,
  type CreateStaffInput,
  type SessionIdentity,
  type TableWriteInput,
  type UpdateStaffInput,
  type UserWithPassword,
} from './store';
import { createPrismaMenuStore } from './prisma-menu-store';
import { createPrismaOrderStore } from './prisma-order-store';
import { createPrismaAccountStore } from './prisma-account-store';
import { createPrismaReportStore } from './prisma-report-store';

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

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function isMissingRecord(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

function isSerializationConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

export function createPrismaStore(client: PrismaClient): AppStore {
  return {
    // Phase 2 menü işlemleri ayrı dosyada tutulur; sınır aynı AppStore'dur.
    ...createPrismaMenuStore(client),
    ...createPrismaOrderStore(client),
    ...createPrismaAccountStore(client),
    ...createPrismaReportStore(client),

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

    async listAreas(includeInactive: boolean): Promise<DiningAreaResponse[]> {
      const areas = await client.diningArea.findMany({
        where: includeInactive ? {} : { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
      return areas.map(({ id, name, sortOrder, isActive }) => ({ id, name, sortOrder, isActive }));
    },

    async createArea(input: AreaWriteInput): Promise<DiningAreaResponse> {
      try {
        const area = await client.$transaction(async (transaction) => {
          const created = await transaction.diningArea.create({
            data: {
              name: input.name,
              nameKey: input.nameKey,
              sortOrder: input.sortOrder,
              isActive: input.isActive,
            },
          });
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'AREA_CREATED',
              entityType: 'DiningArea',
              entityId: created.id,
              metadata: { name: created.name },
            },
          });
          return created;
        });
        return { id: area.id, name: area.name, sortOrder: area.sortOrder, isActive: area.isActive };
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new StoreError('CONFLICT', 'Bu salon adı zaten kullanılıyor.');
        }
        throw error;
      }
    },

    async updateArea(id: string, input: AreaWriteInput): Promise<DiningAreaResponse> {
      try {
        const area = await client.$transaction(async (transaction) => {
          const updated = await transaction.diningArea.update({
            where: { id },
            data: {
              name: input.name,
              nameKey: input.nameKey,
              sortOrder: input.sortOrder,
              isActive: input.isActive,
            },
          });
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'AREA_UPDATED',
              entityType: 'DiningArea',
              entityId: updated.id,
              metadata: { name: updated.name, isActive: updated.isActive },
            },
          });
          return updated;
        });
        return { id: area.id, name: area.name, sortOrder: area.sortOrder, isActive: area.isActive };
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new StoreError('CONFLICT', 'Bu salon adı zaten kullanılıyor.');
        }
        if (isMissingRecord(error)) throw new StoreError('NOT_FOUND', 'Salon bulunamadı.');
        throw error;
      }
    },

    async listTables(areaId, includeInactive): Promise<CafeTableResponse[]> {
      const tables = await client.cafeTable.findMany({
        where: {
          ...(areaId === undefined ? {} : { areaId }),
          ...(includeInactive ? {} : { isActive: true }),
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
      return tables.map(({ id, areaId: tableAreaId, name, capacity, sortOrder, isActive }) => ({
        id,
        areaId: tableAreaId,
        name,
        capacity,
        sortOrder,
        isActive,
      }));
    },

    async createTable(input: TableWriteInput): Promise<CafeTableResponse> {
      try {
        const table = await client.$transaction(async (transaction) => {
          const area = await transaction.diningArea.findUnique({ where: { id: input.areaId } });
          if (area === null) throw new StoreError('NOT_FOUND', 'Salon bulunamadı.');
          const created = await transaction.cafeTable.create({
            data: {
              areaId: input.areaId,
              name: input.name,
              nameKey: input.nameKey,
              capacity: input.capacity,
              sortOrder: input.sortOrder,
              isActive: input.isActive,
            },
          });
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'TABLE_CREATED',
              entityType: 'CafeTable',
              entityId: created.id,
              metadata: { name: created.name, areaId: created.areaId },
            },
          });
          return created;
        });
        return {
          id: table.id,
          areaId: table.areaId,
          name: table.name,
          capacity: table.capacity,
          sortOrder: table.sortOrder,
          isActive: table.isActive,
        };
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new StoreError('CONFLICT', 'Bu salonda aynı masa adı zaten kullanılıyor.');
        }
        throw error;
      }
    },

    async updateTable(id: string, input: TableWriteInput): Promise<CafeTableResponse> {
      try {
        const table = await client.$transaction(async (transaction) => {
          const area = await transaction.diningArea.findUnique({ where: { id: input.areaId } });
          if (area === null) throw new StoreError('NOT_FOUND', 'Salon bulunamadı.');
          const updated = await transaction.cafeTable.update({
            where: { id },
            data: {
              areaId: input.areaId,
              name: input.name,
              nameKey: input.nameKey,
              capacity: input.capacity,
              sortOrder: input.sortOrder,
              isActive: input.isActive,
            },
          });
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'TABLE_UPDATED',
              entityType: 'CafeTable',
              entityId: updated.id,
              metadata: { name: updated.name, areaId: updated.areaId, isActive: updated.isActive },
            },
          });
          return updated;
        });
        return {
          id: table.id,
          areaId: table.areaId,
          name: table.name,
          capacity: table.capacity,
          sortOrder: table.sortOrder,
          isActive: table.isActive,
        };
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new StoreError('CONFLICT', 'Bu salonda aynı masa adı zaten kullanılıyor.');
        }
        if (isMissingRecord(error)) throw new StoreError('NOT_FOUND', 'Masa bulunamadı.');
        throw error;
      }
    },

    async getFloorPlan(): Promise<FloorPlanResponse> {
      const areas = await client.diningArea.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          tables: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
        },
      });
      return {
        areas: areas.map((area) => ({
          id: area.id,
          name: area.name,
          sortOrder: area.sortOrder,
          tables: area.tables.map((table) => ({
            id: table.id,
            name: table.name,
            capacity: table.capacity,
            sortOrder: table.sortOrder,
          })),
        })),
      };
    },
  };
}
