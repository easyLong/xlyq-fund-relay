import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CLAIM_STATUS, TASK_STATUS, type TaskDetail, type TaskListItem } from '@xlyq/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ClaimTaskDto } from './dto/claim-task.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { ReviewSubmissionDto } from './dto/review-submission.dto';
import { SubmitTaskDto } from './dto/submit-task.dto';
import { RemindTaskDto } from './dto/remind-task.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';
import { toTaskListItem } from './tasks.mapper';

const taskInclude = {
  organization: true,
  fundProduct: true,
} as const;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  private async getViewer(viewerId?: string, viewerRole?: string) {
    if (!viewerId || !/^\d+$/.test(viewerId) || !['operator', 'executor'].includes(viewerRole ?? '')) return null;
    return this.prisma.user.findUnique({
      where: { id: BigInt(viewerId) },
      select: { role: true, status: true },
    });
  }

  private sanitizeExecutorItem(item: TaskListItem): TaskListItem {
    return {
      ...item,
      title: `${item.platform}内容发布任务`,
      description: null,
      campaignName: null,
      organization: { id: '', name: '任务信息' },
      fundProduct: null,
    };
  }

  async list(pageNo = 1, pageSize = 20) {
    const skip = (pageNo - 1) * pageSize;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.task.count(),
      this.prisma.task.findMany({
        include: taskInclude,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    return {
      rows: rows.map(toTaskListItem),
      total,
    };
  }

  async market(pageNo = 1, pageSize = 20, viewerId?: string, viewerRole?: string) {
    const viewer = await this.getViewer(viewerId, viewerRole);
    const isExecutor = viewerRole === 'executor' && viewer?.role === 'EXECUTOR' && viewer.status === 'ACTIVE';
    const now = new Date();
    const where = {
      status: { in: [TASK_STATUS.PUBLISHED, TASK_STATUS.IN_PROGRESS] },
      dueAt: { gt: now },
      claimedCount: { lt: this.prisma.task.fields.quota },
    };
    const skip = (pageNo - 1) * pageSize;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.task.count({ where }),
      this.prisma.task.findMany({
        where,
        include: taskInclude,
        orderBy: { dueAt: 'asc' },
        skip,
        take: pageSize,
      }),
    ]);

    const items = rows.map(toTaskListItem);
    return {
      rows: isExecutor ? items.map((item) => this.sanitizeExecutorItem(item)) : items,
      total,
    };
  }

  async recent(limit = 5): Promise<TaskListItem[]> {
    const rows = await this.prisma.task.findMany({
      include: taskInclude,
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
    return rows.map(toTaskListItem);
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: BigInt(id) },
      include: taskInclude,
    });
    if (!task) {
      throw new NotFoundException('任务不存在');
    }
    return toTaskListItem(task);
  }

  async detail(id: string, viewerId?: string, viewerRole?: string): Promise<TaskDetail> {
    const task = await this.prisma.task.findUnique({
      where: { id: BigInt(id) },
      include: {
        ...taskInclude,
        claims: {
          include: { user: true, submissions: { orderBy: { createdAt: 'desc' }, take: 1 } },
          orderBy: { claimedAt: 'desc' },
        },
      },
    });
    if (!task) throw new NotFoundException('任务不存在');
    const viewer = await this.getViewer(viewerId, viewerRole);
    const isOperator = viewerRole === 'operator' && viewer?.role === 'OPERATOR' && viewer.status === 'ACTIVE';
    const isExecutor = viewerRole === 'executor' && viewer?.role === 'EXECUTOR' && viewer.status === 'ACTIVE';
    const viewerBigIntId = viewerId && /^\d+$/.test(viewerId) ? BigInt(viewerId) : undefined;
    const viewerClaim = isExecutor && viewerBigIntId ? task.claims.find((claim) => claim.userId === viewerBigIntId) : undefined;
    const item = toTaskListItem(task);
    const visibleClaims = isOperator ? task.claims : viewerClaim ? [viewerClaim] : [];
    const claims = visibleClaims.map((claim) => ({
      id: claim.id.toString(),
      userId: claim.userId.toString(),
      userName: claim.user.displayName,
      status: claim.status,
      claimedAt: claim.claimedAt.toISOString(),
      submission: claim.submissions[0]
        ? {
            id: claim.submissions[0].id.toString(),
            linkUrl: claim.submissions[0].linkUrl,
            textContent: claim.submissions[0].textContent,
            screenshots: ((claim.submissions[0].content as { screenshots?: string[] } | null)?.screenshots ?? []),
            status: claim.submissions[0].status,
            reviewComment: claim.submissions[0].reviewComment,
            submittedAt: claim.submissions[0].submittedAt.toISOString(),
          }
        : null,
    }));
    const canViewOriginal = isOperator || Boolean(viewerClaim);
    return {
      ...(isExecutor ? this.sanitizeExecutorItem(item) : item),
      originalText: canViewOriginal ? task.originalText : null,
      originalTextVisible: canViewOriginal,
      submitRequirements: (task.submitRequirements as Record<string, unknown> | null) ?? null,
      complianceRequirements: task.complianceRequirements,
      claims,
    };
  }

  async create(input: CreateTaskDto) {
    const operator = await this.prisma.user.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { id: 'asc' },
    });
    if (!operator) {
      throw new BadRequestException('请先初始化至少一个用户，才能创建任务');
    }

    const task = await this.prisma.task.create({
      data: {
        title: input.title,
        description: input.description,
        originalText: input.originalText,
        taskType: input.taskType,
        platform: input.platform,
        campaignName: input.campaignName,
        organizationId: BigInt(input.organizationId),
        fundProductId: input.fundProductId ? BigInt(input.fundProductId) : null,
        quota: input.quota,
        rewardPoints: 10,
        dueAt: new Date(input.dueAt),
        createdBy: operator.id,
      },
      include: taskInclude,
    });

    return toTaskListItem(task);
  }

  async publish(id: string) {
    const task = await this.prisma.task.update({
      where: { id: BigInt(id) },
      data: { status: TASK_STATUS.PUBLISHED, publishedAt: new Date() },
      include: taskInclude,
    });
    return toTaskListItem(task);
  }

  async unpublish(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id: BigInt(id) } });
    if (!task) throw new NotFoundException('任务不存在');
    if ([TASK_STATUS.COMPLETED, TASK_STATUS.CLOSED].includes(task.status as typeof TASK_STATUS.COMPLETED)) {
      throw new ConflictException('已完成或已关闭任务不能下架');
    }
    const updated = await this.prisma.task.update({
      where: { id: task.id },
      data: { status: TASK_STATUS.UNPUBLISHED, closedAt: new Date() },
      include: taskInclude,
    });
    return toTaskListItem(updated);
  }

  async remind(id: string, input: RemindTaskDto) {
    const taskId = BigInt(id);
    const task = await this.prisma.task.findUnique({ where: { id: taskId }, include: { claims: true } });
    if (!task) throw new NotFoundException('任务不存在');
    const recipients = task.claims.filter((claim) => claim.activeFlag === 1 && ![CLAIM_STATUS.APPROVED, CLAIM_STATUS.ABANDONED].includes(claim.status as typeof CLAIM_STATUS.APPROVED));
    const message = input.message?.trim() || `任务“${task.title}”即将截止，请及时完成并提交结果。`;
    if (recipients.length > 0) {
      await this.prisma.taskReminder.createMany({
        data: recipients.map((claim) => ({ taskId, senderId: BigInt(input.operatorId), recipientId: claim.userId, message })),
      });
    }
    return { taskId: id, recipientCount: recipients.length, message, sentAt: new Date().toISOString() };
  }

  async claim(id: string, input: ClaimTaskDto) {
    const taskId = BigInt(id);
    const userId = BigInt(input.userId);
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.findUnique({ where: { id: taskId } });
      if (!task) throw new NotFoundException('任务不存在');
      if (![TASK_STATUS.PUBLISHED, TASK_STATUS.IN_PROGRESS].includes(task.status as typeof TASK_STATUS.PUBLISHED)) {
        throw new ConflictException('任务当前不可领取');
      }
      if (task.dueAt <= new Date()) throw new ConflictException('任务已截止');
      if (task.claimedCount >= task.quota) throw new ConflictException('任务名额已满');
      const oldClaim = await tx.taskClaim.findFirst({ where: { taskId, userId, activeFlag: 1 } });
      if (oldClaim) throw new ConflictException('你已经领取过该任务');
      const claim = await tx.taskClaim.create({
        data: { taskId, userId, rewardPoints: task.rewardPoints },
      });
      await tx.task.update({
        where: { id: taskId },
        data: { claimedCount: { increment: 1 }, status: TASK_STATUS.IN_PROGRESS },
      });
      return { id: claim.id.toString(), status: claim.status, rewardPoints: task.rewardPoints };
    });
  }

  async submit(input: SubmitTaskDto) {
    const claimId = BigInt(input.claimId);
    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.taskClaim.findUnique({ include: { task: true }, where: { id: claimId } });
      if (!claim || claim.userId !== BigInt(input.userId)) throw new NotFoundException('领取记录不存在');
      if (claim.status !== CLAIM_STATUS.PENDING_SUBMIT && claim.status !== CLAIM_STATUS.REWORKING) {
        throw new ConflictException('当前状态不能提交');
      }
      const submission = await tx.taskSubmission.create({
        data: {
          taskId: claim.taskId,
          claimId: claim.id,
          userId: claim.userId,
          submitVersion: claim.version,
          linkUrl: input.linkUrl,
          textContent: input.textContent,
          content: { screenshots: input.screenshots },
          status: CLAIM_STATUS.PENDING_REVIEW,
        },
      });
      await tx.taskClaim.update({
        where: { id: claim.id },
        data: { status: CLAIM_STATUS.PENDING_REVIEW, submittedAt: new Date(), version: { increment: 1 } },
      });
      return { id: submission.id.toString(), status: submission.status };
    });
  }

  async updateSubmission(submissionId: string, input: UpdateSubmissionDto) {
    const id = BigInt(submissionId);
    return this.prisma.$transaction(async (tx) => {
      const submission = await tx.taskSubmission.findUnique({ include: { claim: true }, where: { id } });
      if (!submission || submission.userId !== BigInt(input.userId)) throw new NotFoundException('提交记录不存在');
      if (![CLAIM_STATUS.PENDING_REVIEW, CLAIM_STATUS.REWORKING].includes(submission.status as typeof CLAIM_STATUS.PENDING_REVIEW)) {
        throw new ConflictException('当前提交状态不允许修改');
      }
      const updated = await tx.taskSubmission.update({
        where: { id },
        data: {
          linkUrl: input.linkUrl,
          textContent: input.textContent,
          content: { screenshots: input.screenshots },
          submitVersion: { increment: 1 },
          status: CLAIM_STATUS.PENDING_REVIEW,
          reviewComment: null,
          reviewedAt: null,
          reviewedBy: null,
          submittedAt: new Date(),
        },
      });
      await tx.taskClaim.update({ where: { id: submission.claimId }, data: { status: CLAIM_STATUS.PENDING_REVIEW, submittedAt: new Date(), version: { increment: 1 } } });
      return { id: updated.id.toString(), status: updated.status };
    });
  }

  async review(submissionId: string, input: ReviewSubmissionDto) {
    const submissionIdValue = BigInt(submissionId);
    return this.prisma.$transaction(async (tx) => {
      const submission = await tx.taskSubmission.findUnique({ include: { task: true, claim: true }, where: { id: submissionIdValue } });
      if (!submission) throw new NotFoundException('提交记录不存在');
      if (submission.status !== CLAIM_STATUS.PENDING_REVIEW) throw new ConflictException('提交记录已审核');
      const status = input.approved ? CLAIM_STATUS.APPROVED : CLAIM_STATUS.REWORKING;
      await tx.taskSubmission.update({ where: { id: submission.id }, data: { status, reviewComment: input.comment, reviewedAt: new Date(), reviewedBy: BigInt(input.reviewerId) } });
      await tx.taskClaim.update({ where: { id: submission.claimId }, data: { status, reviewedAt: new Date(), reviewerId: BigInt(input.reviewerId) } });
      if (input.approved) {
        await tx.task.update({ where: { id: submission.taskId }, data: { approvedCount: { increment: 1 } } });
        const account = await tx.userPointAccount.upsert({ where: { userId: submission.userId }, update: { availablePoints: { increment: submission.task.rewardPoints } }, create: { userId: submission.userId, availablePoints: submission.task.rewardPoints } });
        await tx.pointLedger.create({ data: { userId: submission.userId, taskId: submission.taskId, claimId: submission.claimId, entryType: 'TASK_REWARD', points: submission.task.rewardPoints, balanceAfter: account.availablePoints, remark: '任务审核通过奖励' } });
      }
      return { id: submission.id.toString(), status };
    });
  }
}
