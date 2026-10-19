import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { Role, User } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StructuredLoggingService } from '../../common/services/structured-logging/structured-logging.service';
import type { AuthUser } from '../../common/auth/decorators';
import type { RegisterDto } from './dto/users.dto';

const publicUser = ({ password: _password, ...rest }: User) => rest;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly logging: StructuredLoggingService,
  ) {}

  private issue(user: User) {
    return { user: publicUser(user), token: this.jwt.sign({ sub: user.id, email: user.email, role: user.role }) };
  }

  /**
   * Self-service registration creates DEVELOPER accounts. The very first account becomes ADMIN so a
   * fresh install can be bootstrapped; afterwards only admins change roles.
   */
  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('User already exists');
    const isFirst = (await this.prisma.user.count()) === 0;
    const user = await this.prisma.user.create({
      data: { email, password: await bcrypt.hash(dto.password, 12), name: dto.name, role: isFirst ? 'ADMIN' : 'DEVELOPER' },
    });
    await this.logging.logAuditEvent('user.registered', `User ${email} registered`, { actor: email, entityType: 'user', entityId: user.id, role: user.role });
    return this.issue(user);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      await this.logging.logAuditEvent('user.login_failed', `Failed login for ${email}`, { actor: email, entityType: 'user' });
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.logging.logAuditEvent('user.login', `User ${user.email} logged in`, { actor: user.email, entityType: 'user', entityId: user.id });
    return this.issue(user);
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return publicUser(user);
  }

  async updateProfile(userId: string, name?: string) {
    return publicUser(await this.prisma.user.update({ where: { id: userId }, data: { ...(name ? { name } : {}) } }));
  }

  async changePassword(userId: string, current: string, next: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(current, user.password))) throw new UnauthorizedException('Current password is wrong');
    await this.prisma.user.update({ where: { id: userId }, data: { password: await bcrypt.hash(next, 12) } });
    await this.logging.logAuditEvent('user.password_changed', `Password changed for ${user.email}`, { entityType: 'user', entityId: user.id });
    return { success: true };
  }

  async getAllUsers() {
    const users = await this.prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
    return users.map(publicUser);
  }

  async updateRole(actor: AuthUser, userId: string, role: Role) {
    if (actor.id === userId && role !== 'ADMIN') throw new BadRequestException('Admins cannot demote themselves');
    const user = await this.prisma.user.update({ where: { id: userId }, data: { role } });
    await this.logging.logAuditEvent('user.role_changed', `${user.email} is now ${role}`, { entityType: 'user', entityId: userId, role });
    return publicUser(user);
  }

  async assignServices(userId: string, services: string[]) {
    const unique = [...new Set(services.map((s) => s.trim()).filter(Boolean))];
    const user = await this.prisma.user.update({ where: { id: userId }, data: { services: unique } });
    await this.logging.logAuditEvent('user.services_assigned', `${user.email} owns ${unique.join(', ') || 'no services'}`, { entityType: 'user', entityId: userId, services: unique });
    return publicUser(user);
  }

  async canViewFindings(userId: string, service?: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return false;
    if (user.role !== 'DEVELOPER') return true;
    return service ? user.services.includes(service) : false;
  }

  async canApproveDeployment(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return Boolean(user && (user.role === 'ADMIN' || user.role === 'SECURITY_LEAD'));
  }
}
