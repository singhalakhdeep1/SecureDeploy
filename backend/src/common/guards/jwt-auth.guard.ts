import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IS_PUBLIC, ROLES, type AuthUser } from '../auth/decorators';
import { StructuredLoggingService } from '../services/structured-logging/structured-logging.service';

/**
 * Global guard: verifies the Bearer JWT, loads the user (so role/service changes apply
 * immediately and deleted users lose access) and enforces @Roles.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly logging: StructuredLoggingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = this.extractTokenFromHeader(request);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, services: true },
    });
    if (!user) throw new UnauthorizedException('User no longer exists');
    request.user = user;
    this.logging.setContext({ userId: user.id, userEmail: user.email });

    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, targets);
    if (roles?.length && !roles.includes(user.role)) {
      throw new ForbiddenException(`Requires role: ${roles.join(' or ')}`);
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
