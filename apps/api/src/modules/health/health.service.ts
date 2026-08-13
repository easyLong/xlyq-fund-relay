import { Injectable } from '@nestjs/common';
import type { HealthStatus } from '@xlyq/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'ok',
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'degraded',
        database: 'error',
        checkedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : '数据库连接异常',
      };
    }
  }
}
