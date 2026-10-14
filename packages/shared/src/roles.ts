export const USER_ROLES = ['OWNER', 'ADMIN', 'AGENT'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Roles que pueden modificar la configuración del comercio. */
export const MANAGER_ROLES: readonly UserRole[] = ['OWNER', 'ADMIN'];
