import { UserRole } from '@prisma/client';

/** Usuario autenticado tal como lo expone `req.user` tras pasar `JwtAuthGuard`. */
export interface AuthUser {
  id: string;
  email: string;
  tenantId: string;
  role: UserRole;
}
