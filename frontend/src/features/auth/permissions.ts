import type { AuthUser } from "./types";

export type PermissionName =
  | "clinic:manage"
  | "crm:manage"
  | "dashboard:read"
  | "finance:manage"
  | "integrations:manage"
  | "inventory:manage"
  | "performance:manage";

export function isAdmin(user: AuthUser | null) {
  return Boolean(user?.is_superuser);
}

export function hasPermission(user: AuthUser | null, permissionName: PermissionName) {
  if (!user) {
    return false;
  }

  if (user.is_superuser) {
    return true;
  }

  return user.roles.some((role) =>
    role.permissions.some((permission) => permission.name === permissionName),
  );
}
