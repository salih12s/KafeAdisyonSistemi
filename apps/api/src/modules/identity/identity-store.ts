import type { BusinessSettingsResponse, CurrentUser, StaffMember, UserRole } from '@kafe/contracts';

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

/** Kimlik, oturum, personel ve işletme ayarı kalıcılığı. */
export interface IdentityStore {
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
}
