import { Injectable, NotFoundException } from '@nestjs/common';
import type { PointSummary } from '@xlyq/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PointsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(userId: string): Promise<PointSummary> {
    const account = await this.prisma.userPointAccount.findUnique({ where: { userId: BigInt(userId) } });
    if (!account) throw new NotFoundException('积分账户不存在');
    return {
      availablePoints: account.availablePoints,
      frozenPoints: account.frozenPoints,
      withdrawnPoints: account.withdrawnPoints,
      cashValue: Number((account.availablePoints * 0.1).toFixed(2)),
    };
  }
}
