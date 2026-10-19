import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  services: string[];
}

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';

/** Skips JWT authentication (login, register, health, webhooks with their own guard). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Restricts a route to the listed roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user);

export const PRIVILEGED: Role[] = ['ADMIN', 'SECURITY_LEAD'];

/** Admins, security leads and auditors see every service; developers only the services they own. */
export function canSeeService(user: AuthUser, service: string): boolean {
  return user.role !== 'DEVELOPER' || user.services.includes(service);
}
