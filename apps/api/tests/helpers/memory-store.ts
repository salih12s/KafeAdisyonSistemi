import { randomUUID } from 'node:crypto';
import type {
  BusinessSettingsResponse,
  CafeTableResponse,
  CurrentUser,
  DiningAreaResponse,
  FloorPlanResponse,
  StaffMember,
  UserRole,
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
} from '../../src/features/store';
import type { MemoryAuditEntry } from './memory-menu-store';
import { MemoryOrderStore } from './memory-order-store';

interface MemoryUser extends UserWithPassword {
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MemorySession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  lastSeenAt: Date;
}

interface MemoryArea extends DiningAreaResponse {
  nameKey: string;
}

interface MemoryTable extends CafeTableResponse {
  nameKey: string;
}

/** Audit kaydı biçimi menü store'u ile ortaktır; iki yerde ayrı tanım tutulmaz. */
export type MemoryAudit = MemoryAuditEntry;

/**
 * Kimlik/salon/masa store'u. Menü işlemleri `MemoryMenuStore` içindedir ve
 * buradan miras alınır; böylece tek bir `AppStore` uygulaması elde edilir.
 */
export class MemoryStore extends MemoryOrderStore implements AppStore {
  public readonly sessions: MemorySession[] = [];
  private readonly users: MemoryUser[] = [];
  private readonly areas: MemoryArea[] = [];
  private readonly tables: MemoryTable[] = [];
  private business: BusinessSettingsResponse | null = null;

  seedUser(input: {
    fullName: string;
    username: string;
    passwordHash: string;
    role: UserRole;
    isActive?: boolean;
  }): CurrentUser {
    const now = new Date('2026-08-12T08:00:00.000Z');
    const user: MemoryUser = {
      id: randomUUID(),
      fullName: input.fullName,
      username: input.username,
      passwordHash: input.passwordHash,
      role: input.role,
      isActive: input.isActive ?? true,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.users.push(user);
    return this.safeUser(user);
  }

  seedSession(userId: string, tokenHash: string, expiresAt: Date): void {
    this.sessions.push({ id: randomUUID(), userId, tokenHash, expiresAt, lastSeenAt: new Date() });
  }

  getUser(username: string): MemoryUser | undefined {
    return this.users.find((user) => user.username === username);
  }

  async hasActiveOwner(): Promise<boolean> {
    return this.users.some((user) => user.role === 'OWNER' && user.isActive);
  }

  async bootstrapOwner(input: BootstrapOwnerInput): Promise<CurrentUser> {
    if (await this.hasActiveOwner()) {
      throw new StoreError('ALREADY_INITIALIZED', 'Aktif işletme sahibi zaten mevcut.');
    }
    const user = this.seedUser({ ...input, role: 'OWNER' });
    this.business = {
      id: 'business',
      businessName: input.businessName,
      phone: null,
      address: null,
      updatedAt: new Date().toISOString(),
    };
    this.audits.push({
      actorUserId: user.id,
      action: 'OWNER_CREATED',
      entityType: 'User',
      entityId: user.id,
    });
    return user;
  }

  async findUserByUsername(username: string): Promise<UserWithPassword | null> {
    return this.users.find((user) => user.username === username) ?? null;
  }

  async createLoginSession(input: CreateSessionInput): Promise<void> {
    const user = this.requireUser(input.userId);
    user.lastLoginAt = input.now;
    this.sessions.push({
      id: randomUUID(),
      userId: user.id,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      lastSeenAt: input.now,
    });
  }

  async findSession(tokenHash: string): Promise<SessionIdentity | null> {
    const session = this.sessions.find((entry) => entry.tokenHash === tokenHash);
    if (session === undefined) return null;
    return { ...session, user: this.requireUser(session.userId) };
  }

  async touchSession(sessionId: string, now: Date): Promise<void> {
    const session = this.sessions.find((entry) => entry.id === sessionId);
    if (session !== undefined) session.lastSeenAt = now;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    this.removeSessions((session) => session.tokenHash === tokenHash);
  }

  async changePassword(input: {
    actorUserId: string;
    passwordHash: string;
    currentTokenHash: string;
  }): Promise<void> {
    const user = this.requireUser(input.actorUserId);
    user.passwordHash = input.passwordHash;
    this.removeSessions(
      (session) => session.userId === user.id && session.tokenHash !== input.currentTokenHash,
    );
    this.audits.push({
      actorUserId: user.id,
      action: 'PASSWORD_CHANGED',
      entityType: 'User',
      entityId: user.id,
    });
  }

  async listStaff(): Promise<StaffMember[]> {
    return this.users.map((user) => this.staff(user));
  }

  async createStaff(input: CreateStaffInput): Promise<StaffMember> {
    if (this.users.some((user) => user.username === input.username)) {
      throw new StoreError('CONFLICT', 'Bu kullanıcı adı zaten kullanılıyor.');
    }
    const user = this.seedUser(input);
    this.audits.push({
      actorUserId: input.actorUserId,
      action: 'STAFF_CREATED',
      entityType: 'User',
      entityId: user.id,
    });
    return this.staff(this.requireUser(user.id));
  }

  async updateStaff(input: UpdateStaffInput): Promise<StaffMember> {
    const user = this.requireUser(input.targetUserId);
    if (user.id === input.actorUserId && !input.isActive) {
      throw new StoreError('SELF_DEACTIVATE', 'Kendi hesabınızı pasife alamazsınız.');
    }
    if (user.role === 'OWNER' && user.isActive && (input.role !== 'OWNER' || !input.isActive)) {
      const ownerCount = this.users.filter(
        (entry) => entry.role === 'OWNER' && entry.isActive,
      ).length;
      if (ownerCount <= 1) {
        throw new StoreError(
          'LAST_OWNER',
          'Son aktif işletme sahibi pasife alınamaz veya rolü değiştirilemez.',
        );
      }
    }
    user.fullName = input.fullName;
    user.role = input.role;
    user.isActive = input.isActive;
    user.updatedAt = new Date();
    if (!user.isActive) this.removeSessions((session) => session.userId === user.id);
    this.audits.push({
      actorUserId: input.actorUserId,
      action: 'STAFF_UPDATED',
      entityType: 'User',
      entityId: user.id,
    });
    return this.staff(user);
  }

  async resetStaffPassword(input: {
    actorUserId: string;
    targetUserId: string;
    passwordHash: string;
  }): Promise<void> {
    const user = this.requireUser(input.targetUserId);
    user.passwordHash = input.passwordHash;
    this.removeSessions((session) => session.userId === user.id);
    this.audits.push({
      actorUserId: input.actorUserId,
      action: 'STAFF_PASSWORD_RESET',
      entityType: 'User',
      entityId: user.id,
    });
  }

  async getBusinessSettings(): Promise<BusinessSettingsResponse | null> {
    return this.business;
  }

  async updateBusinessSettings(input: BusinessUpdateInput): Promise<BusinessSettingsResponse> {
    this.business = {
      id: 'business',
      businessName: input.businessName,
      phone: input.phone,
      address: input.address,
      updatedAt: new Date().toISOString(),
    };
    this.audits.push({
      actorUserId: input.actorUserId,
      action: 'BUSINESS_UPDATED',
      entityType: 'BusinessSettings',
      entityId: 'business',
    });
    return this.business;
  }

  async listAreas(includeInactive: boolean): Promise<DiningAreaResponse[]> {
    return this.areas
      .filter((area) => includeInactive || area.isActive)
      .sort(sortItems)
      .map(this.publicArea);
  }

  async createArea(input: AreaWriteInput): Promise<DiningAreaResponse> {
    if (this.areas.some((area) => area.nameKey === input.nameKey)) {
      throw new StoreError('CONFLICT', 'Bu salon adı zaten kullanılıyor.');
    }
    const area: MemoryArea = {
      id: randomUUID(),
      name: input.name,
      nameKey: input.nameKey,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    };
    this.areas.push(area);
    this.audits.push({
      actorUserId: input.actorUserId,
      action: 'AREA_CREATED',
      entityType: 'DiningArea',
      entityId: area.id,
    });
    return this.publicArea(area);
  }

  async updateArea(id: string, input: AreaWriteInput): Promise<DiningAreaResponse> {
    const area = this.areas.find((entry) => entry.id === id);
    if (area === undefined) throw new StoreError('NOT_FOUND', 'Salon bulunamadı.');
    if (this.areas.some((entry) => entry.id !== id && entry.nameKey === input.nameKey)) {
      throw new StoreError('CONFLICT', 'Bu salon adı zaten kullanılıyor.');
    }
    Object.assign(area, {
      name: input.name,
      nameKey: input.nameKey,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    });
    this.audits.push({
      actorUserId: input.actorUserId,
      action: 'AREA_UPDATED',
      entityType: 'DiningArea',
      entityId: area.id,
    });
    return this.publicArea(area);
  }

  async listTables(
    areaId: string | undefined,
    includeInactive: boolean,
  ): Promise<CafeTableResponse[]> {
    return this.tables
      .filter(
        (table) =>
          (areaId === undefined || table.areaId === areaId) && (includeInactive || table.isActive),
      )
      .sort(sortItems)
      .map(this.publicTable);
  }

  async createTable(input: TableWriteInput): Promise<CafeTableResponse> {
    if (!this.areas.some((area) => area.id === input.areaId)) {
      throw new StoreError('NOT_FOUND', 'Salon bulunamadı.');
    }
    if (
      this.tables.some((table) => table.areaId === input.areaId && table.nameKey === input.nameKey)
    ) {
      throw new StoreError('CONFLICT', 'Bu salonda aynı masa adı zaten kullanılıyor.');
    }
    const table: MemoryTable = {
      id: randomUUID(),
      areaId: input.areaId,
      name: input.name,
      nameKey: input.nameKey,
      capacity: input.capacity,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    };
    this.tables.push(table);
    this.audits.push({
      actorUserId: input.actorUserId,
      action: 'TABLE_CREATED',
      entityType: 'CafeTable',
      entityId: table.id,
    });
    return this.publicTable(table);
  }

  async updateTable(id: string, input: TableWriteInput): Promise<CafeTableResponse> {
    const table = this.tables.find((entry) => entry.id === id);
    if (table === undefined) throw new StoreError('NOT_FOUND', 'Masa bulunamadı.');
    if (
      this.tables.some(
        (entry) =>
          entry.id !== id && entry.areaId === input.areaId && entry.nameKey === input.nameKey,
      )
    ) {
      throw new StoreError('CONFLICT', 'Bu salonda aynı masa adı zaten kullanılıyor.');
    }
    Object.assign(table, input);
    this.audits.push({
      actorUserId: input.actorUserId,
      action: 'TABLE_UPDATED',
      entityType: 'CafeTable',
      entityId: table.id,
    });
    return this.publicTable(table);
  }

  async getFloorPlan(): Promise<FloorPlanResponse> {
    const areas = this.areas.filter((area) => area.isActive).sort(sortItems);
    return {
      areas: areas.map((area) => ({
        id: area.id,
        name: area.name,
        sortOrder: area.sortOrder,
        tables: this.tables
          .filter((table) => table.areaId === area.id && table.isActive)
          .sort(sortItems)
          .map((table) => ({
            id: table.id,
            name: table.name,
            capacity: table.capacity,
            sortOrder: table.sortOrder,
          })),
      })),
    };
  }

  private requireUser(id: string): MemoryUser {
    const user = this.users.find((entry) => entry.id === id);
    if (user === undefined) throw new StoreError('NOT_FOUND', 'Personel bulunamadı.');
    return user;
  }

  protected findOrderTable(id: string) {
    const table = this.tables.find((entry) => entry.id === id);
    if (table === undefined) return null;
    const area = this.areas.find((entry) => entry.id === table.areaId);
    return {
      id: table.id,
      name: table.name,
      isActive: table.isActive,
      areaIsActive: area?.isActive ?? false,
    };
  }

  protected findOrderUserName(id: string): string {
    return this.requireUser(id).fullName;
  }

  protected orderFloorPlan(): FloorPlanResponse {
    const areas = this.areas.filter((area) => area.isActive).sort(sortItems);
    return {
      areas: areas.map((area) => ({
        id: area.id,
        name: area.name,
        sortOrder: area.sortOrder,
        tables: this.tables
          .filter((table) => table.areaId === area.id && table.isActive)
          .sort(sortItems)
          .map((table) => ({
            id: table.id,
            name: table.name,
            capacity: table.capacity,
            sortOrder: table.sortOrder,
          })),
      })),
    };
  }

  private removeSessions(predicate: (session: MemorySession) => boolean): void {
    for (let index = this.sessions.length - 1; index >= 0; index -= 1) {
      const session = this.sessions[index];
      if (session !== undefined && predicate(session)) this.sessions.splice(index, 1);
    }
  }

  private safeUser(user: MemoryUser): CurrentUser {
    return { id: user.id, fullName: user.fullName, username: user.username, role: user.role };
  }

  private staff(user: MemoryUser): StaffMember {
    return {
      ...this.safeUser(user),
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private readonly publicArea = (area: MemoryArea): DiningAreaResponse => ({
    id: area.id,
    name: area.name,
    sortOrder: area.sortOrder,
    isActive: area.isActive,
  });
  private readonly publicTable = (table: MemoryTable): CafeTableResponse => ({
    id: table.id,
    areaId: table.areaId,
    name: table.name,
    capacity: table.capacity,
    sortOrder: table.sortOrder,
    isActive: table.isActive,
  });
}

function sortItems(
  left: { sortOrder: number; name: string },
  right: { sortOrder: number; name: string },
): number {
  return left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'tr');
}
