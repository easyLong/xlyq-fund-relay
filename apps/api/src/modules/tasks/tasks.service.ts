import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { CLAIM_STATUS, TASK_STATUS, type TaskDetail, type TaskListItem } from '@xlyq/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ClaimTaskDto } from './dto/claim-task.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { ReviewSubmissionDto } from './dto/review-submission.dto';
import { SubmitTaskDto } from './dto/submit-task.dto';
import { RemindTaskDto } from './dto/remind-task.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';
import { toTaskListItem, withFundNamePrefix } from './tasks.mapper';

const taskInclude = {
  organization: true,
  fundProduct: true,
  fundTaskPost: true,
} as const;

type TaskRow = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

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

  private linkedTaskWhere(task: { id: bigint; fundTaskId: bigint | null }) {
    return task.fundTaskId ? { fundTaskId: task.fundTaskId } : { id: task.id };
  }

  private mergeTaskStatus(rows: TaskRow[]) {
    const statuses = rows.map((row) => row.status);
    if (statuses.every((status) => status === TASK_STATUS.COMPLETED)) return TASK_STATUS.COMPLETED;
    if (statuses.some((status) => status === TASK_STATUS.IN_PROGRESS)) return TASK_STATUS.IN_PROGRESS;
    if (statuses.some((status) => status === TASK_STATUS.PUBLISHED)) return TASK_STATUS.PUBLISHED;
    if (statuses.some((status) => status === TASK_STATUS.PENDING_PUBLISH)) return TASK_STATUS.PENDING_PUBLISH;
    if (statuses.some((status) => status === TASK_STATUS.DRAFT)) return TASK_STATUS.DRAFT;
    if (statuses.some((status) => status === TASK_STATUS.UNPUBLISHED)) return TASK_STATUS.UNPUBLISHED;
    return rows[0]?.status ?? TASK_STATUS.DRAFT;
  }

  private normalizeFundTaskRows(rows: TaskRow[]) {
    const keys: string[] = [];
    const groups = new Map<string, TaskRow[]>();
    for (const row of rows) {
      const key = row.fundTaskId ? `fund-task-${row.fundTaskId}` : `task-${row.id}`;
      if (!groups.has(key)) {
        keys.push(key);
        groups.set(key, []);
      }
      groups.get(key)!.push(row);
    }

    return keys.map((key) => {
      const group = groups.get(key)!;
      const first = group[0];
      const taskName = first.fundTaskPost?.taskName;
      if (group.length === 1) {
        return taskName ? { ...first, title: taskName } : first;
      }
      return {
        ...first,
        title: taskName ?? first.title,
        quota: group.reduce((sum, row) => sum + row.quota, 0),
        claimedCount: group.reduce((sum, row) => sum + row.claimedCount, 0),
        approvedCount: group.reduce((sum, row) => sum + row.approvedCount, 0),
        status: this.mergeTaskStatus(group),
        dueAt: new Date(Math.min(...group.map((row) => row.dueAt.getTime()))),
      };
    });
  }

  async list(pageNo = 1, pageSize = 20) {
    const skip = (pageNo - 1) * pageSize;
    const allRows = await this.prisma.task.findMany({
      include: taskInclude,
      orderBy: { updatedAt: 'desc' },
    });
    const rows = this.normalizeFundTaskRows(allRows);

    return {
      rows: rows.slice(skip, skip + pageSize).map(toTaskListItem),
      total: rows.length,
    };
  }

  async market(pageNo = 1, pageSize = 20, viewerId?: string, viewerRole?: string) {
    const viewer = await this.getViewer(viewerId, viewerRole);
    const isExecutor = viewerRole === 'executor' && viewer?.role === 'EXECUTOR' && viewer.status === 'ACTIVE';
    const now = new Date();
    const baseWhere: Prisma.TaskWhereInput = {
      status: { in: [TASK_STATUS.PUBLISHED, TASK_STATUS.IN_PROGRESS] },
      dueAt: { gt: now },
      claimedCount: { lt: this.prisma.task.fields.quota },
    };
    let where = baseWhere;
    if (isExecutor && viewerId) {
      const userId = BigInt(viewerId);
      const claimedScopes = await this.prisma.taskClaim.findMany({
        where: { userId, activeFlag: 1 },
        select: { task: { select: { fundTaskId: true } } },
      });
      const claimedFundTaskIds = claimedScopes.map((claim) => claim.task.fundTaskId).filter((id): id is bigint => Boolean(id));
      where = {
        ...baseWhere,
        AND: [
          { claims: { none: { userId, activeFlag: 1 } } },
          ...(claimedFundTaskIds.length > 0 ? [{ OR: [{ fundTaskId: null }, { fundTaskId: { notIn: claimedFundTaskIds } }] }] : []),
        ],
      };
    }
    const skip = (pageNo - 1) * pageSize;
    const allRows = await this.prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: { dueAt: 'asc' },
    });
    const rows = this.normalizeFundTaskRows(allRows);

    const items = rows.slice(skip, skip + pageSize).map(toTaskListItem);
    return {
      rows: isExecutor ? items.map((item) => this.sanitizeExecutorItem(item)) : items,
      total: rows.length,
    };
  }

  async recent(limit = 5): Promise<TaskListItem[]> {
    const rows = await this.prisma.task.findMany({
      include: taskInclude,
      orderBy: { updatedAt: 'desc' },
      take: limit * 4,
    });
    return this.normalizeFundTaskRows(rows).slice(0, limit).map(toTaskListItem);
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
          include: { user: true, executorAccount: true, submissions: { orderBy: { createdAt: 'desc' }, take: 1 } },
          orderBy: { claimedAt: 'desc' },
        },
      },
    });
    if (!task) throw new NotFoundException('任务不存在');
    const viewer = await this.getViewer(viewerId, viewerRole);
    const isOperator = viewerRole === 'operator' && viewer?.role === 'OPERATOR' && viewer.status === 'ACTIVE';
    const isExecutor = viewerRole === 'executor' && viewer?.role === 'EXECUTOR' && viewer.status === 'ACTIVE';
    const viewerBigIntId = viewerId && /^\d+$/.test(viewerId) ? BigInt(viewerId) : undefined;
    const viewerClaims = isExecutor && viewerBigIntId ? task.claims.filter((claim) => claim.userId === viewerBigIntId) : [];
    const viewerClaim = viewerClaims[0];
    const item = toTaskListItem(task);
    const visibleClaims = isOperator ? task.claims : viewerClaims;
    const claims = visibleClaims.map((claim) => ({
      id: claim.id.toString(),
      userId: claim.userId.toString(),
      userName: claim.user.displayName,
      executorAccountId: claim.executorAccountId?.toString() ?? null,
      executorAccountName: claim.executorAccount?.accountName ?? null,
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
    const dueAt = new Date(input.dueAt);
    if (Number.isNaN(dueAt.getTime()) || dueAt <= new Date()) {
      throw new BadRequestException('截止时间必须晚于当前时间');
    }
    const operator = await this.prisma.user.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { id: 'asc' },
    });
    if (!operator) {
      throw new BadRequestException('请先初始化至少一个用户，才能创建任务');
    }

    if (input.fundTaskPostId) {
      const post = await this.prisma.fundTaskPost.findUnique({ where: { id: BigInt(input.fundTaskPostId) } });
      if (!post || post.status !== 'ACTIVE' || post.fundProductId !== BigInt(input.fundProductId ?? '0') || post.platform !== input.platform) {
        throw new BadRequestException('所选基金帖子配置无效或与任务平台不一致');
      }
    }

    const fundTask = input.fundTaskId ? await this.prisma.fundTask.findUnique({ where: { id: BigInt(input.fundTaskId) }, include: { fundProduct: true, posts: { where: { status: 'ACTIVE' } } } }) : null;
    if (input.fundTaskId && (!fundTask || fundTask.status !== 'ACTIVE' || fundTask.fundProductId !== BigInt(input.fundProductId ?? '0') || fundTask.platform !== input.platform || fundTask.posts.length === 0)) {
      throw new BadRequestException('所选基金任务无效，或没有有效帖子');
    }

    const commonData = {
      description: input.description,
      originalText: input.originalText,
      taskType: input.taskType,
      platform: input.platform,
      campaignName: input.campaignName,
      organizationId: BigInt(input.organizationId),
      fundProductId: input.fundProductId ? BigInt(input.fundProductId) : null,
      fundTaskId: input.fundTaskId ? BigInt(input.fundTaskId) : null,
      rewardPoints: 10,
      dueAt,
      createdBy: operator.id,
    };

    if (fundTask) {
      return this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM fund_tasks WHERE id = ${fundTask.id} FOR UPDATE`;
        const lockedFundTask = await tx.fundTask.findUnique({ where: { id: fundTask.id }, include: { fundProduct: true, posts: { where: { status: 'ACTIVE' } } } });
        if (!lockedFundTask || lockedFundTask.status !== 'ACTIVE' || lockedFundTask.fundProductId !== BigInt(input.fundProductId ?? '0') || lockedFundTask.platform !== input.platform || lockedFundTask.posts.length === 0) {
          throw new BadRequestException('所选基金任务无效，或没有有效帖子');
        }
        const existing = await tx.task.findFirst({ where: { fundTaskId: lockedFundTask.id }, include: taskInclude });
        if (existing) return toTaskListItem(existing);
        const orderedPosts = [...lockedFundTask.posts].sort((left, right) => Number(left.id - right.id));
        const postText = orderedPosts
          .map((post, index) => `帖子 ${index + 1}：${post.postTitle?.trim() || '未命名帖子'}\n${post.postContent?.trim() || ''}`.trim())
          .join('\n\n');
        const task = await tx.task.create({
          data: {
            ...commonData,
            title: withFundNamePrefix(lockedFundTask.taskName, lockedFundTask.fundProduct.name),
            description: postText || input.description,
            originalText: postText || input.originalText,
            platform: lockedFundTask.platform,
            campaignName: lockedFundTask.taskName,
            fundTaskPostId: null,
            quota: orderedPosts.length,
            submitRequirements: {
              note: '请按领取到的发布账号完成内容发布，并提交公开链接与截图。',
              posts: orderedPosts.map((post, index) => ({
                id: post.id.toString(),
                index: index + 1,
                title: post.postTitle?.trim() || `帖子 ${index + 1}`,
                url: post.postUrl,
              })),
            },
          },
          include: taskInclude,
        });
        return toTaskListItem(task);
      });
    }

    const task = await this.prisma.task.create({
      data: { ...commonData, title: input.title, fundTaskPostId: input.fundTaskPostId ? BigInt(input.fundTaskPostId) : null, quota: input.quota },
      include: taskInclude,
    });
    return toTaskListItem(task);
  }

  async publish(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.findUnique({ where: { id: BigInt(id) } });
      if (!task) throw new NotFoundException('任务不存在');
      const now = new Date();
      await tx.task.updateMany({
        where: {
          ...this.linkedTaskWhere(task),
          status: { in: [TASK_STATUS.DRAFT, TASK_STATUS.PENDING_PUBLISH, TASK_STATUS.UNPUBLISHED] },
        },
        data: { status: TASK_STATUS.PUBLISHED, publishedAt: now, closedAt: null },
      });
      const updated = await tx.task.findUnique({ where: { id: task.id }, include: taskInclude });
      return toTaskListItem(updated!);
    });
  }

  async unpublish(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.findUnique({ where: { id: BigInt(id) } });
      if (!task) throw new NotFoundException('任务不存在');
      if ([TASK_STATUS.COMPLETED, TASK_STATUS.CLOSED].includes(task.status as typeof TASK_STATUS.COMPLETED)) {
        throw new ConflictException('已完成或已关闭任务不能下架');
      }
      const now = new Date();
      await tx.task.updateMany({
        where: {
          ...this.linkedTaskWhere(task),
          status: { in: [TASK_STATUS.DRAFT, TASK_STATUS.PENDING_PUBLISH, TASK_STATUS.PUBLISHED, TASK_STATUS.IN_PROGRESS] },
        },
        data: { status: TASK_STATUS.UNPUBLISHED, closedAt: now },
      });
      const updated = await tx.task.findUnique({ where: { id: task.id }, include: taskInclude });
      return toTaskListItem(updated!);
    });
  }

  async remind(id: string, input: RemindTaskDto) {
    const taskId = BigInt(id);
    const task = await this.prisma.task.findUnique({ where: { id: taskId }, include: { claims: true } });
    if (!task) throw new NotFoundException('任务不存在');
    const recipients = task.claims.filter((claim) => claim.activeFlag === 1 && ![CLAIM_STATUS.APPROVED, CLAIM_STATUS.ABANDONED].includes(claim.status as typeof CLAIM_STATUS.APPROVED));
    const message = input.message?.trim() || `任务“${task.title}”即将截止，请及时完成并提交结果。`;
    if (recipients.length > 0) {
      const now = new Date();
      await this.prisma.$transaction([
        this.prisma.taskReminder.createMany({
          data: recipients.map((claim) => ({ taskId, senderId: BigInt(input.operatorId), recipientId: claim.userId, message })),
        }),
        ...recipients.map((claim) => this.prisma.notification.upsert({
          where: {
            eventId_recipientId_templateCode: {
              eventId: taskId,
              recipientId: claim.userId,
              templateCode: 'TASK_REMIND',
            },
          },
          create: {
            recipientId: claim.userId,
            eventId: taskId,
            templateCode: 'TASK_REMIND',
            title: '任务提醒',
            content: message,
            status: 'UNREAD',
            createdAt: now,
          },
          update: {
            title: '任务提醒',
            content: message,
            status: 'UNREAD',
            readAt: null,
            createdAt: now,
          },
        })),
      ]);
    }
    return { taskId: id, recipientCount: recipients.length, message, sentAt: new Date().toISOString() };
  }

  async claim(id: string, input: ClaimTaskDto) {
    const taskId = BigInt(id);
    const userId = BigInt(input.userId);
    return this.prisma.$transaction(async (tx) => {
      const task = (await tx.task.findUnique({ where: { id: taskId } }))!;
      if (!task) throw new NotFoundException('任务不存在');
      if (![TASK_STATUS.PUBLISHED, TASK_STATUS.IN_PROGRESS].includes(task.status as typeof TASK_STATUS.PUBLISHED)) {
        throw new ConflictException('任务当前不可领取');
      }
      if (task.dueAt <= new Date()) throw new ConflictException('任务已截止');
      if (task.claimedCount >= task.quota) throw new ConflictException('任务名额已满');
      const executor = await tx.user.findUnique({ where: { id: userId }, select: { role: true, status: true } });
      if (!executor || executor.role !== 'EXECUTOR' || executor.status !== 'ACTIVE') throw new ConflictException('兼职账号不可领取任务');
      const taskScopeWhere = this.linkedTaskWhere(task);
      if (task.fundTaskId) await tx.$queryRaw`SELECT id FROM fund_tasks WHERE id = ${task.fundTaskId} FOR UPDATE`;
      const oldClaim = await tx.taskClaim.findFirst({ where: { userId, activeFlag: 1, task: taskScopeWhere } });
      if (oldClaim) throw new ConflictException('已领取过该任务');
      const accounts = await tx.executorAccount.findMany({
        where: {
          userId,
          platform: task.platform,
          status: 'ACTIVE',
          claims: { none: { activeFlag: 1, task: taskScopeWhere } },
        },
        orderBy: { id: 'asc' },
        take: 1,
      });
      if (accounts.length === 0) throw new ConflictException(`请先完善${task.platform}发布账号信息，或该平台账号已领取过该任务`);
      const account = accounts[0];

      const lockedAccount = await tx.executorAccount.updateMany({
        where: {
          id: account.id,
          userId,
          platform: task.platform,
          status: 'ACTIVE',
        },
        data: { updatedAt: new Date() },
      });
      if (lockedAccount.count !== 1) throw new ConflictException('发布账号状态已变化，请刷新后重试');

      const reserved = await tx.task.updateMany({
        where: {
          id: taskId,
          status: { in: [TASK_STATUS.PUBLISHED, TASK_STATUS.IN_PROGRESS] },
          dueAt: { gt: new Date() },
          claimedCount: { lt: task.quota },
        },
        data: { claimedCount: { increment: 1 }, status: TASK_STATUS.IN_PROGRESS },
      });
      if (reserved.count !== 1) throw new ConflictException('任务名额已满');

      const created = await tx.taskClaim.createMany({
        data: [{ taskId, userId, executorAccountId: account.id, rewardPoints: task.rewardPoints }],
        skipDuplicates: true,
      });
      if (created.count !== 1) throw new ConflictException('已领取过该任务');
      const claim = await tx.taskClaim.findFirstOrThrow({ where: { taskId, userId, executorAccountId: account.id, activeFlag: 1 }, orderBy: { id: 'desc' } });
      return { ids: [claim.id.toString()], count: 1, status: CLAIM_STATUS.PENDING_SUBMIT, rewardPoints: task.rewardPoints };
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
      const now = new Date();
      const transitioned = await tx.taskClaim.updateMany({
        where: { id: claim.id, userId: claim.userId, activeFlag: 1, status: { in: [CLAIM_STATUS.PENDING_SUBMIT, CLAIM_STATUS.REWORKING] } },
        data: { status: CLAIM_STATUS.PENDING_REVIEW, submittedAt: now, version: { increment: 1 } },
      });
      if (transitioned.count !== 1) throw new ConflictException('当前状态不能提交，请刷新后重试');
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
      const operators = await tx.user.findMany({ where: { role: 'OPERATOR', status: 'ACTIVE' }, select: { id: true } });
      if (operators.length > 0) {
        await tx.notification.createMany({
          data: operators.map((operator) => ({
            recipientId: operator.id,
            eventId: submission.id,
            templateCode: 'SUBMISSION_PENDING_REVIEW',
            title: '有新的任务待审核',
            content: `${claim.task.platform}任务已提交结果，请及时审核。`,
          })),
          skipDuplicates: true,
        });
      }
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
      const now = new Date();
      const updatedSubmission = await tx.taskSubmission.updateMany({
        where: { id, userId: submission.userId, status: { in: [CLAIM_STATUS.PENDING_REVIEW, CLAIM_STATUS.REWORKING] } },
        data: {
          linkUrl: input.linkUrl,
          textContent: input.textContent,
          content: { screenshots: input.screenshots },
          submitVersion: { increment: 1 },
          status: CLAIM_STATUS.PENDING_REVIEW,
          reviewComment: null,
          reviewedAt: null,
          reviewedBy: null,
          submittedAt: now,
        },
      });
      if (updatedSubmission.count !== 1) throw new ConflictException('提交状态已变化，请刷新后重试');
      const updatedClaim = await tx.taskClaim.updateMany({ where: { id: submission.claimId, activeFlag: 1, status: { in: [CLAIM_STATUS.PENDING_REVIEW, CLAIM_STATUS.REWORKING] } }, data: { status: CLAIM_STATUS.PENDING_REVIEW, submittedAt: now, version: { increment: 1 } } });
      if (updatedClaim.count !== 1) throw new ConflictException('领取状态已变化，请刷新后重试');
      const updated = await tx.taskSubmission.findUniqueOrThrow({ where: { id } });
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
      const now = new Date();
      const reviewedSubmission = await tx.taskSubmission.updateMany({
        where: { id: submission.id, status: CLAIM_STATUS.PENDING_REVIEW },
        data: { status, reviewComment: input.comment, reviewedAt: now, reviewedBy: BigInt(input.reviewerId) },
      });
      if (reviewedSubmission.count !== 1) throw new ConflictException('提交记录已审核，请刷新后查看');
      const reviewedClaim = await tx.taskClaim.updateMany({
        where: { id: submission.claimId, activeFlag: 1, status: CLAIM_STATUS.PENDING_REVIEW },
        data: { status, reviewedAt: now, reviewerId: BigInt(input.reviewerId) },
      });
      if (reviewedClaim.count !== 1) throw new ConflictException('领取状态已变化，请刷新后查看');
      if (input.approved) {
        const approvedTask = await tx.task.updateMany({
          where: { id: submission.taskId, approvedCount: { lt: submission.task.quota } },
          data: { approvedCount: { increment: 1 } },
        });
        if (approvedTask.count !== 1) throw new ConflictException('任务已完成，不能继续审核通过');
        const taskAfterApproval = await tx.task.findUniqueOrThrow({ where: { id: submission.taskId }, select: { approvedCount: true, quota: true, fundProductId: true, platform: true } });
        const completedTask = taskAfterApproval.approvedCount >= taskAfterApproval.quota
          ? await tx.task.updateMany({
              where: { id: submission.taskId, status: { notIn: [TASK_STATUS.COMPLETED, TASK_STATUS.CLOSED] } },
              data: { status: TASK_STATUS.COMPLETED, closedAt: now },
            })
          : { count: 0 };
        const account = await tx.userPointAccount.upsert({ where: { userId: submission.userId }, update: { availablePoints: { increment: submission.task.rewardPoints } }, create: { userId: submission.userId, availablePoints: submission.task.rewardPoints } });
        await tx.pointLedger.create({ data: { userId: submission.userId, taskId: submission.taskId, claimId: submission.claimId, entryType: 'TASK_REWARD', points: submission.task.rewardPoints, balanceAfter: account.availablePoints, remark: '任务审核通过奖励' } });
        if (completedTask.count === 1 && taskAfterApproval.fundProductId) {
          const fundUsers = await tx.user.findMany({ where: { role: 'FUND', status: 'ACTIVE', fundProductId: taskAfterApproval.fundProductId }, select: { id: true } });
          if (fundUsers.length > 0) {
            await tx.notification.createMany({
              data: fundUsers.map((user) => ({
                recipientId: user.id,
                eventId: submission.taskId,
                templateCode: 'FUND_TASK_COMPLETED',
                title: '基金任务已完成',
                content: `${taskAfterApproval.platform}任务已审核完成，可查看进度。`,
              })),
              skipDuplicates: true,
            });
          }
        }
      }
      await tx.notification.createMany({
        data: [{
          recipientId: submission.userId,
          eventId: submission.id,
          templateCode: input.approved ? 'SUBMISSION_APPROVED' : 'SUBMISSION_REWORKING',
          title: input.approved ? '任务审核通过' : '任务需要补充',
          content: input.approved ? '你的任务已通过审核，积分已到账。' : input.comment || '请补充发布链接或截图后重新提交。',
        }],
        skipDuplicates: true,
      });
      return { id: submission.id.toString(), status };
    });
  }
}
