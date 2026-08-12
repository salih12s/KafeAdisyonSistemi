export const USER_ROLES = ['OWNER', 'CASHIER', 'WAITER', 'KITCHEN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  OWNER: 'İşletme Sahibi',
  CASHIER: 'Kasiyer',
  WAITER: 'Garson',
  KITCHEN: 'Mutfak',
};

export const PERMISSIONS = {
  VIEW_TABLES: 'VIEW_TABLES',
  MANAGE_STAFF: 'MANAGE_STAFF',
  MANAGE_BUSINESS: 'MANAGE_BUSINESS',
  MANAGE_AREAS: 'MANAGE_AREAS',
  MANAGE_TABLES: 'MANAGE_TABLES',
  VIEW_MENU: 'VIEW_MENU',
  MANAGE_MENU: 'MANAGE_MENU',
  VIEW_ORDERS: 'VIEW_ORDERS',
  MANAGE_ORDERS: 'MANAGE_ORDERS',
  VIEW_KITCHEN: 'VIEW_KITCHEN',
  MANAGE_KITCHEN: 'MANAGE_KITCHEN',
  VIEW_ACCOUNTS: 'VIEW_ACCOUNTS',
  MANAGE_ACCOUNTS: 'MANAGE_ACCOUNTS',
  ADJUST_CHECKS: 'ADJUST_CHECKS',
  MOVE_TABLES: 'MOVE_TABLES',
  MERGE_TABLES: 'MERGE_TABLES',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export interface CurrentUser {
  id: string;
  fullName: string;
  username: string;
  role: UserRole;
}

export interface StaffMember extends CurrentUser {
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessSettingsResponse {
  id: string;
  businessName: string;
  phone: string | null;
  address: string | null;
  updatedAt: string;
}

export interface DiningAreaResponse {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface CafeTableResponse {
  id: string;
  areaId: string;
  name: string;
  capacity: number | null;
  sortOrder: number;
  isActive: boolean;
}

export interface FloorPlanResponse {
  areas: Array<{
    id: string;
    name: string;
    sortOrder: number;
    tables: Array<{
      id: string;
      name: string;
      capacity: number | null;
      sortOrder: number;
    }>;
  }>;
}
