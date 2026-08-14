import { Injectable } from '@nestjs/common';
import type { MyTaskItem } from '@xlyq/shared';
import { PrismaService } from '../prisma/prisma.service';
import { toTaskListItem } from './tasks.mapper';

@Injectable()
export class UserTasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<MyTaskItem[]> {
    const claims = await this.prisma.taskClaim.findMany({
      where: { userId: BigInt(userId), activeFlag: 1 },
      include: { executorAccount: true, task: { include: { organization: true, fundProduct: true } }, submissions: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    return claims.map((claim) => ({
      ...toTaskListItem(claim.task),
      title: `${claim.task.platform}内容发布任务`,
      description: null,
      campaignName: null,
      claimId: claim.id.toString(),
      executorAccountId: claim.executorAccountId?.toString() ?? null,
      executorAccountName: claim.executorAccount?.accountName ?? null,
      claimStatus: claim.status as MyTaskItem['claimStatus'],
      claimedAt: claim.claimedAt.toISOString(),
      submittedAt: claim.submittedAt?.toISOString() ?? null,
      reviewComment: claim.submissions[0]?.reviewComment ?? null,
    }));
  }
}
