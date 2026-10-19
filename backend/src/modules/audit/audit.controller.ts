import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CacheService } from '../../common/services/cache/cache.service';
import { Public, Roles } from '../../common/auth/decorators';

@ApiTags('audit')
@Controller()
export class AuditController {
  constructor(private readonly prisma: PrismaService, private readonly cache: CacheService) {}

  @Get('audit')
  @ApiBearerAuth()
  @Roles('ADMIN', 'AUDITOR', 'SECURITY_LEAD')
  @ApiOperation({ summary: 'Audit trail (filter by entity, action, actor)' })
  async list(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('actor') actor?: string,
    @Query('limit') limit?: string,
  ) {
    const where: Prisma.AuditEventWhereInput = {
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(action ? { action: { startsWith: action } } : {}),
      ...(actor ? { actor: { contains: actor } } : {}),
    };
    return this.prisma.auditEvent.findMany({ where, orderBy: { createdAt: 'desc' }, take: Math.min(Number(limit) || 100, 500) });
  }

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness/readiness: database and Redis status' })
  async health() {
    const db = await this.prisma.$queryRaw`SELECT 1`.then(() => 'connected').catch(() => 'disconnected');
    return { status: db === 'connected' ? 'ok' : 'degraded', database: db, redis: await this.cache.ping(), timestamp: new Date().toISOString() };
  }
}
