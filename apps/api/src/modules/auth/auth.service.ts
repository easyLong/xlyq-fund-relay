import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { DemoAccount } from '@xlyq/shared';
import { PrismaService } from '../prisma/prisma.service';
import { verifyPassword } from './password';
import { issueSessionToken } from './session';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(username: string, password: string): Promise<DemoAccount> {
    const user = await this.prisma.user.findUnique({ where: { username }, include: { fundProduct: { select: { id: true } } } });
    if (!user || user.status !== 'ACTIVE' || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('账号或密码错误');
    }

    const role = user.role === 'OPERATOR' ? 'operator' : user.role === 'FUND' ? 'fund' : 'executor';
    return {
      id: user.id.toString(),
      name: user.displayName,
      username: user.username ?? username,
      role,
      fundProductId: user.fundProductId?.toString() ?? null,
      token: issueSessionToken(user.id.toString(), user.role as 'OPERATOR' | 'EXECUTOR' | 'FUND'),
    };
  }
}
