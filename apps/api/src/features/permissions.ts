import { PERMISSIONS, type Permission, type UserRole } from '@kafe/contracts';

const OWNER_PERMISSIONS: readonly Permission[] = Object.values(PERMISSIONS);

// OWNER dışındaki roller menüyü ve masa düzenini görür, değiştiremez.
const VIEW_ONLY: readonly Permission[] = [
  PERMISSIONS.VIEW_TABLES,
  PERMISSIONS.VIEW_MENU,
  PERMISSIONS.VIEW_ORDERS,
  PERMISSIONS.VIEW_KITCHEN,
];

const SERVICE_PERMISSIONS: readonly Permission[] = [
  ...VIEW_ONLY,
  PERMISSIONS.MANAGE_ORDERS,
  PERMISSIONS.MANAGE_KITCHEN,
  PERMISSIONS.VIEW_ACCOUNTS,
  PERMISSIONS.MANAGE_ACCOUNTS,
  PERMISSIONS.ADJUST_CHECKS,
  PERMISSIONS.MOVE_TABLES,
  PERMISSIONS.MERGE_TABLES,
  PERMISSIONS.VIEW_REPORTS,
];

const WAITER_PERMISSIONS: readonly Permission[] = [
  ...VIEW_ONLY,
  PERMISSIONS.MANAGE_ORDERS,
  PERMISSIONS.MANAGE_KITCHEN,
  PERMISSIONS.MOVE_TABLES,
];

const KITCHEN_PERMISSIONS: readonly Permission[] = [...VIEW_ONLY, PERMISSIONS.MANAGE_KITCHEN];

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  OWNER: OWNER_PERMISSIONS,
  CASHIER: SERVICE_PERMISSIONS,
  WAITER: WAITER_PERMISSIONS,
  KITCHEN: KITCHEN_PERMISSIONS,
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
