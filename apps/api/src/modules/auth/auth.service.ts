import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { DemoAccount } from '@xlyq/shared';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword } from './password';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(username: string, password: string): Promise<DemoAccount> {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || user.status !== 'ACTIVE' || !user.passwordHash || user.passwordHash !== hashPassword(password)) {
      throw new UnauthorizedException('账号或密码错误');
    }

    return {
      id: user.id.toString(),
      name: user.displayName,
      username: user.username ?? username,
      role: user.role === 'OPERATOR' ? 'operator' : 'executor',
    };
  }
}
