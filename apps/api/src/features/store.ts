import type {
  BusinessSettingsResponse,
  CafeTableResponse,
  CurrentUser,
  DiningAreaResponse,
  FloorPlanResponse,
  StaffMember,
  UserRole,
} from '@kafe/contracts';
import type { MenuStore } from './menu-store';

export * from './menu-store';

export interface UserWithPassword extends CurrentUser {
  passwordHash: string;
  isActive: boolean;
}

export interface SessionIdentity {
  id: string;
  tokenHash: string;
  expiresAt: Date;
  user: UserWithPassword;
}

export interface BootstrapOwnerInput {
  businessName: string;
  fullName: string;
  username: string;
  passwordHash: string;
}

export interface CreateSessionInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  now: Date;
}

export interface CreateStaffInput {
  actorUserId: string;
  fullName: string;
  username: string;
  passwordHash: string;
  role: UserRole;
}

export interface UpdateStaffInput {
  actorUserId: string;
  targetUserId: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
}

export interface BusinessUpdateInput {
  actorUserId: string;
  businessName: string;
  phone: string | null;
  address: string | null;
}

export interface AreaWriteInput {
  actorUserId: string;
  name: string;
  nameKey: string;
  sortOrder: number;
  isActive: boolean;
}

export interface TableWriteInput {
  actorUserId: string;
  areaId: string;
  name: string;
  nameKey: string;
  capacity: number | null;
  sortOrder: number;
  isActive: boolean;
}

export type StoreErrorCode =
  'NOT_FOUND' | 'CONFLICT' | 'LAST_OWNER' | 'SELF_DEACTIVATE' | 'ALREADY_INITIALIZED';

export class StoreError extends Error {
  constructor(
    public readonly code: StoreErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'StoreError';
  }
}

export interface AppStore extends MenuStore {
  hasActiveOwner(): Promise<boolean>;
  bootstrapOwner(input: BootstrapOwnerInput): Promise<CurrentUser>;
  findUserByUsername(username: string): Promise<UserWithPassword | null>;
  createLoginSession(input: CreateSessionInput): Promise<void>;
  findSession(tokenHash: string): Promise<SessionIdentity | null>;
  touchSession(sessionId: string, now: Date): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;
  changePassword(input: {
    actorUserId: string;
    passwordHash: string;
    currentTokenHash: string;
  }): Promise<void>;
  listStaff(): Promise<StaffMember[]>;
  createStaff(input: CreateStaffInput): Promise<StaffMember>;
  updateStaff(input: UpdateStaffInput): Promise<StaffMember>;
  resetStaffPassword(input: {
    actorUserId: string;
    targetUserId: string;
    passwordHash: string;
  }): Promise<void>;
  getBusinessSettings(): Promise<BusinessSettingsResponse | null>;
  updateBusinessSettings(input: BusinessUpdateInput): Promise<BusinessSettingsResponse>;
  listAreas(includeInactive: boolean): Promise<DiningAreaResponse[]>;
  createArea(input: AreaWriteInput): Promise<DiningAreaResponse>;
  updateArea(id: string, input: AreaWriteInput): Promise<DiningAreaResponse>;
  listTables(areaId: string | undefined, includeInactive: boolean): Promise<CafeTableResponse[]>;
  createTable(input: TableWriteInput): Promise<CafeTableResponse>;
  updateTable(id: string, input: TableWriteInput): Promise<CafeTableResponse>;
  getFloorPlan(): Promise<FloorPlanResponse>;
}
