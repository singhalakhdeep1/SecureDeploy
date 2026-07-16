import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async register(registerDto: any) {
    const { email, password, name, role = 'DEVELOPER', services = [] } = registerDto;

    // Check if user exists
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new Error('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        services,
      },
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async login(loginDto: any) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT token (simplified - use proper JWT service in production)
    const token = this.generateToken(user);

    const { password: _, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      token,
    };
  }

  private generateToken(user: any): string {
    // Simplified token generation - use proper JWT in production
    return Buffer.from(JSON.stringify({ userId: user.id, role: user.role })).toString('base64');
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async getAllUsers() {
    const users = await this.prisma.user.findMany();
    return users.map((user) => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  }

  async assignServices(userId: string, services: string[]) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { services },
    });
  }

  async canViewFindings(userId: string, service?: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return false;

    // Admin and Security Lead can view all
    if (user.role === 'ADMIN' || user.role === 'SECURITY_LEAD') {
      return true;
    }

    // Auditor can view all (read-only)
    if (user.role === 'AUDITOR') {
      return true;
    }

    // Developer can only view their services
    if (service) {
      return user.services.includes(service);
    }

    return false;
  }

  async canApproveDeployment(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return false;

    return user.role === 'ADMIN' || user.role === 'SECURITY_LEAD';
  }
}
