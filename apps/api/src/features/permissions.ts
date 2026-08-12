import { PERMISSIONS, type Permission, type UserRole } from '@kafe/contracts';

const OWNER_PERMISSIONS: readonly Permission[] = Object.values(PERMISSIONS);

// OWNER dışındaki roller menüyü ve masa düzenini görür, değiştiremez.
const VIEW_ONLY: readonly Permission[] = [PERMISSIONS.VIEW_TABLES, PERMISSIONS.VIEW_MENU];

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  OWNER: OWNER_PERMISSIONS,
  CASHIER: VIEW_ONLY,
  WAITER: VIEW_ONLY,
  KITCHEN: VIEW_ONLY,
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
