import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { CLAIM_STATUS, TASK_STATUS, type TaskDetail, type TaskListItem } from '@xlyq/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ClaimTaskDto } from './dto/claim-task.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { ImportTasksDto } from './dto/import-tasks.dto';
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

  private businessKey(organizationName: string, fundProductName: string, title: string) {
    return `${organizationName.trim().toLocaleLowerCase()}:${fundProductName.trim().toLocaleLowerCase()}:${title.trim().toLocaleLowerCase()}`;
  }

  private postBusinessKey(organizationName: string, fundProductName: string, taskName: string, title: string) {
    return `${this.businessKey(organizationName, fundProductName, taskName)}:${title.trim().toLocaleLowerCase()}`;
  }

  private importedProductKey(organizationName: string, fundProductName: string) {
    return `import:${organizationName.trim().toLocaleLowerCase()}:${fundProductName.trim().toLocaleLowerCase()}`;
  }

  private organizationCode(name: string) {
    return `IMPORT-${createHash('sha1').update(name.trim().toLocaleLowerCase()).digest('hex').slice(0, 24)}`;
  }

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

  private normalizeImportedTaskRows(rows: TaskRow[]) {
    const keys: string[] = [];
    const groups = new Map<string, TaskRow[]>();
    for (const row of rows) {
      if (!row.fundProductName || !row.campaignName) {
        const key = `task-${row.id}`;
        keys.push(key);
        groups.set(key, [row]);
        continue;
      }
      const key = `import-${row.organizationId}-${row.fundProductName.trim().toLocaleLowerCase()}-${row.campaignName.trim().toLocaleLowerCase()}-${row.platform}`;
      if (!groups.has(key)) {
        keys.push(key);
        groups.set(key, []);
      }
      groups.get(key)!.push(row);
    }
    return keys.map((key) => {
      const group = groups.get(key)!;
      const first = group[0];
      if (group.length === 1) return first;
      return {
        ...first,
        title: first.campaignName ?? first.title,
        description: `${group.length} 个内容子项`,
        quota: group.length,
        claimedCount: group.reduce((sum, row) => sum + row.claimedCount, 0),
        approvedCount: group.reduce((sum, row) => sum + row.approvedCount, 0),
        status: this.mergeTaskStatus(group),
        dueAt: new Date(Math.min(...group.map((row) => row.dueAt.getTime()))),
      };
    });
  }

  private normalizeListRows(rows: TaskRow[]) {
    return this.normalizeFundTaskRows(this.normalizeImportedTaskRows(rows));
  }

  async list(pageNo = 1, pageSize = 20) {
    const skip = (pageNo - 1) * pageSize;
    const allRows = await this.prisma.task.findMany({
      include: taskInclude,
      orderBy: { updatedAt: 'desc' },
    });
    const rows = this.normalizeListRows(allRows);

    return {
      rows: rows.slice(skip, skip + pageSize).map(toTaskListItem),
      total: rows.length,
    };
  }

  async market(pageNo = 1, pageSize = 20, viewerId?: string, viewerRole?: string) {
    const viewer = await this.getViewer(viewerId, viewerRole);
    const isExecutor = viewerRole === 'executor' && viewer?.role === 'EXECUTOR' && viewer.status === 'ACTIVE';
    const now = new Date();
    const activeExecutionStatuses = ['PENDING_SUBMIT', 'PENDING_REVIEW', 'REWORKING'];
    const availablePlatforms = isExecutor && viewerId
      ? new Set((await this.prisma.executorAccount.findMany({
          where: {
            userId: BigInt(viewerId),
            status: 'ACTIVE',
            claims: { none: { activeFlag: 1, status: { in: activeExecutionStatuses } } },
          },
          select: { platform: true },
        })).map((account) => account.platform))
      : undefined;
    const baseWhere: Prisma.TaskWhereInput = {
      status: { in: [TASK_STATUS.PUBLISHED, TASK_STATUS.IN_PROGRESS] },
      dueAt: { gt: now },
      claimedCount: { lt: this.prisma.task.fields.quota },
    };
    let where = baseWhere;
    if (isExecutor && viewerId) {
      const userId = BigInt(viewerId);
      where = {
        ...baseWhere,
        claims: { none: { userId, activeFlag: 1 } },
      };
    }
    const skip = (pageNo - 1) * pageSize;
    const allRows = await this.prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: { dueAt: 'asc' },
    });
    const rows = this.normalizeFundTaskRows(allRows);
    const visibleRows = isExecutor && availablePlatforms
      ? rows.filter((row) => availablePlatforms.has(row.platform) && row.claimedCount < row.quota)
      : rows;

    const items = visibleRows.slice(skip, skip + pageSize).map(toTaskListItem);
    return {
      rows: isExecutor ? items.map((item) => this.sanitizeExecutorItem(item)) : items,
      total: visibleRows.length,
    };
  }

  async recent(limit = 5): Promise<TaskListItem[]> {
    const rows = await this.prisma.task.findMany({
      include: taskInclude,
      orderBy: { updatedAt: 'desc' },
      take: limit * 4,
    });
    return this.normalizeListRows(rows).slice(0, limit).map(toTaskListItem);
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
          include: { user: true, executorAccount: true, fundTaskPost: true, submissions: { orderBy: { createdAt: 'desc' }, take: 1 } },
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
      fundTaskPostId: claim.fundTaskPostId?.toString() ?? null,
      fundTaskPostTitle: claim.assignedPostTitle ?? claim.fundTaskPost?.postTitle ?? null,
      fundTaskPostContent: claim.assignedPostContent ?? claim.fundTaskPost?.postContent ?? null,
      fundTaskPostUrl: claim.assignedPostUrl ?? claim.fundTaskPost?.postUrl ?? null,
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
    const canViewOriginal = isOperator || Boolean(viewerClaim && !viewerClaim.fundTaskPostId);
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
      const orderedPosts = [...fundTask.posts].sort((left, right) => Number(left.id - right.id));
      const postText = orderedPosts
        .map((post, index) => `帖子 ${index + 1}：${post.postTitle?.trim() || '未命名帖子'}\n${post.postContent?.trim() || ''}`.trim())
        .join('\n\n');
      const task = await this.prisma.task.create({
        data: {
          ...commonData,
          title: withFundNamePrefix(fundTask.taskName, fundTask.fundProduct.name),
          description: postText || input.description,
          originalText: postText || input.originalText,
          platform: fundTask.platform,
          campaignName: fundTask.taskName,
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
    }

    const task = await this.prisma.task.create({
      data: { ...commonData, title: input.title, taskKey: input.fundProductId ? this.businessKey(input.organizationId, input.fundProductId, input.title) : null, fundTaskPostId: input.fundTaskPostId ? BigInt(input.fundTaskPostId) : null, quota: input.quota },
      include: taskInclude,
    });
    return toTaskListItem(task);
  }

  async importTasks(input: ImportTasksDto, operatorId?: string) {
    const operator = operatorId
      ? await this.prisma.user.findFirst({ where: { id: BigInt(operatorId), role: 'OPERATOR', status: 'ACTIVE' } })
      : await this.prisma.user.findFirst({ where: { role: 'OPERATOR', status: 'ACTIVE' }, orderBy: { id: 'asc' } });
    if (!operator) throw new BadRequestException('请先初始化运营账号');

    const grouped = new Map<string, { organizationName: string; fundProductName: string; taskName: string; rows: ImportTasksDto['rows'] }>();
    for (const row of input.rows) {
      const organizationName = row.organizationName.trim();
      const fundProductName = row.fundProductName.trim();
      const taskName = row.taskName.trim();
      const title = row.title.trim();
      const content = row.content.trim();
      const dueAt = new Date(row.dueAt);
      if (!organizationName || !fundProductName || !taskName || !title || !content) throw new BadRequestException('基金公司、基金产品、任务名称、标题和内容均不能为空');
      if (Number.isNaN(dueAt.getTime()) || dueAt <= new Date()) throw new BadRequestException(`任务“${taskName}”的截止时间必须晚于当前时间`);
      const groupKey = `${organizationName.toLocaleLowerCase()}\u0000${fundProductName.toLocaleLowerCase()}\u0000${taskName.toLocaleLowerCase()}\u0000${input.platform.toLocaleLowerCase()}`;
      const group = grouped.get(groupKey) ?? { organizationName, fundProductName, taskName, rows: [] };
      if (group.rows.length > 0 && new Date(group.rows[0].dueAt).getTime() !== dueAt.getTime()) {
        throw new BadRequestException(`任务“${taskName}”的多条帖子必须使用同一个截止时间`);
      }
      group.rows.push({ organizationName, fundProductName, taskName, title, content, dueAt: row.dueAt });
      grouped.set(groupKey, group);
    }

    return this.prisma.$transaction(async (tx) => {
      const results: Array<{ row: number; action: 'created' | 'updated'; task: TaskListItem }> = [];
      let rowNumber = 1;
      for (const group of grouped.values()) {
        const row = group.rows[0];
        const existingOrganization = await tx.organization.findFirst({ where: { name: group.organizationName } });
        const organization = existingOrganization
          ? await tx.organization.update({ where: { id: existingOrganization.id }, data: { name: group.organizationName, status: 'ACTIVE' } })
          : await tx.organization.create({ data: { code: this.organizationCode(group.organizationName), name: group.organizationName, status: 'ACTIVE' } });
        const taskKey = this.businessKey(group.organizationName, group.fundProductName, group.taskName);
        const dueAt = new Date(row.dueAt);
        const fundProduct = await tx.fundProduct.findFirst({ where: { name: group.fundProductName } });
        const product = fundProduct ?? await tx.fundProduct.create({ data: { name: group.fundProductName, status: 'ACTIVE' } });
        const fundTask = await tx.fundTask.findFirst({ where: { fundProductId: product.id, taskName: group.taskName, platform: input.platform, status: 'ACTIVE' } });
        const importedFundTask = fundTask ?? await tx.fundTask.create({ data: { fundProductId: product.id, createdBy: operator.id, taskName: group.taskName, platform: input.platform } });
        const uniquePosts = [...new Map(group.rows.map((item) => [item.title.toLocaleLowerCase(), item])).values()];
        const incomingPostKeys = new Set(uniquePosts.map((item) => this.postBusinessKey(group.organizationName, group.fundProductName, group.taskName, item.title)));

        // Upsert posts by their stable business key. Existing claims keep pointing
        // to the same post, while posts removed from a later import become inactive.
        for (const item of uniquePosts) {
          const postKey = this.postBusinessKey(group.organizationName, group.fundProductName, group.taskName, item.title);
          const existingPost = await tx.fundTaskPost.findUnique({ where: { postKey } });
          if (existingPost) {
            await tx.fundTaskPost.update({
              where: { id: existingPost.id },
              data: { fundTaskId: importedFundTask.id, fundProductId: product.id, createdBy: operator.id, taskName: group.taskName, platform: input.platform, postTitle: item.title, postContent: item.content, status: 'ACTIVE' },
            });
          } else {
            const legacyPost = await tx.fundTaskPost.findFirst({ where: { fundTaskId: importedFundTask.id, postTitle: item.title } });
            if (legacyPost) {
              await tx.fundTaskPost.update({
                where: { id: legacyPost.id },
                data: { postKey, fundProductId: product.id, createdBy: operator.id, taskName: group.taskName, platform: input.platform, postContent: item.content, status: 'ACTIVE' },
              });
            } else {
              await tx.fundTaskPost.create({
                data: { fundTaskId: importedFundTask.id, fundProductId: product.id, createdBy: operator.id, taskName: group.taskName, platform: input.platform, postKey, postTitle: item.title, postContent: item.content, status: 'ACTIVE' },
              });
            }
          }
        }
        const activePosts = await tx.fundTaskPost.findMany({ where: { fundTaskId: importedFundTask.id, status: 'ACTIVE' }, select: { id: true, postKey: true, postTitle: true, claims: { where: { activeFlag: 1 }, select: { id: true } } } });
        for (const post of activePosts) {
          const identity = post.postKey ?? (post.postTitle ? this.postBusinessKey(group.organizationName, group.fundProductName, group.taskName, post.postTitle) : null);
          if (!identity || incomingPostKeys.has(identity)) continue;
          if (post.claims.length > 0) {
            throw new ConflictException(`帖子“${post.postTitle ?? post.id.toString()}”已经被领取，不能从重复导入文件中移除`);
          }
          if (post.claims.length === 0) {
            await tx.fundTaskPost.update({ where: { id: post.id }, data: { status: 'INACTIVE' } });
          }
        }

        const existing = await tx.task.findFirst({ where: { organizationId: organization.id, taskKey } });
        if (existing && uniquePosts.length < existing.claimedCount) {
          throw new ConflictException(`任务“${group.taskName}”已有 ${existing.claimedCount} 个名额被领取，导入后的不重复标题不能少于已领取数量`);
        }
        const postItems = uniquePosts.map((item, index) => ({ index: index + 1, title: item.title, content: item.content }));
        const combinedContent = postItems.map((item) => `标题：${item.title}\n${item.content}`).join('\n\n');
        const data = {
          organizationId: organization.id,
          fundProductId: product.id,
          fundProductName: group.fundProductName,
          taskKey,
          title: group.taskName,
          description: combinedContent,
          originalText: combinedContent,
          taskType: 'CONTENT_PUBLISH',
          platform: input.platform,
          fundTaskId: importedFundTask.id,
          quota: uniquePosts.length,
          dueAt,
          campaignName: group.taskName,
          submitRequirements: { posts: uniquePosts.map((item, index) => ({ index: index + 1, title: item.title, postKey: this.postBusinessKey(group.organizationName, group.fundProductName, group.taskName, item.title) })) },
          updatedBy: operator.id,
          status: existing && ['COMPLETED', 'CLOSED'].includes(existing.status) ? existing.status : 'PUBLISHED',
          publishedAt: existing && ['COMPLETED', 'CLOSED'].includes(existing.status) ? existing.publishedAt : new Date(),
          closedAt: existing && ['COMPLETED', 'CLOSED'].includes(existing.status) ? existing.closedAt : null,
        };
        const task = existing
          ? await tx.task.update({ where: { id: existing.id }, data, include: taskInclude })
          : await tx.task.create({ data: { ...data, createdBy: operator.id, rewardPoints: 10 }, include: taskInclude });
        results.push({ row: rowNumber, action: existing ? 'updated' : 'created', task: toTaskListItem(task) });
        rowNumber += group.rows.length;
      }
      return {
        total: results.length,
        created: results.filter((item) => item.action === 'created').length,
        updated: results.filter((item) => item.action === 'updated').length,
        results,
      };
    });
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
      const task = await tx.task.findUnique({ where: { id: taskId } });
      if (!task) throw new NotFoundException('任务不存在');
      if (![TASK_STATUS.PUBLISHED, TASK_STATUS.IN_PROGRESS].includes(task.status as typeof TASK_STATUS.PUBLISHED)) {
        throw new ConflictException('任务当前不可领取');
      }
      if (task.dueAt <= new Date()) throw new ConflictException('任务已截止');
      const executor = await tx.user.findUnique({ where: { id: userId }, select: { role: true, status: true } });
      if (!executor || executor.role !== 'EXECUTOR' || executor.status !== 'ACTIVE') throw new ConflictException('兼职账号不可领取任务');
      const activeExecutionStatuses = ['PENDING_SUBMIT', 'PENDING_REVIEW', 'REWORKING'];
      const assignments: Array<{ claimId: string; executorAccountId: string; executorAccountName: string; fundTaskPostId: string | null; title: string | null; content: string | null; url: string | null }> = [];
      const usedAccountIds: bigint[] = [];

      while (true) {
        const accounts = await tx.executorAccount.findMany({
          where: {
            userId,
            platform: task.platform,
            status: 'ACTIVE',
            id: { notIn: usedAccountIds },
          },
          include: { claims: { where: { activeFlag: 1 }, select: { taskId: true, status: true } } },
          orderBy: { id: 'asc' },
        });
        const account = accounts.find((candidate) => !candidate.claims.some((claim) => claim.taskId === taskId || activeExecutionStatuses.includes(claim.status)));
        if (!account) break;

        const post = input.fundTaskPostId && assignments.length === 0
          ? await tx.fundTaskPost.findFirst({ where: { id: BigInt(input.fundTaskPostId), fundTaskId: task.fundTaskId ?? undefined, status: 'ACTIVE', claims: { none: { activeFlag: 1 } } } })
          : task.fundTaskId
            ? await tx.fundTaskPost.findFirst({ where: { fundTaskId: task.fundTaskId, status: 'ACTIVE', claims: { none: { activeFlag: 1 } } }, orderBy: { id: 'asc' } })
            : null;
        if (task.fundTaskId && !post) break;

        const reserved = await tx.task.updateMany({
          where: { id: taskId, status: { in: [TASK_STATUS.PUBLISHED, TASK_STATUS.IN_PROGRESS] }, dueAt: { gt: new Date() }, claimedCount: { lt: task.quota } },
          data: { claimedCount: { increment: 1 }, status: TASK_STATUS.IN_PROGRESS },
        });
        if (reserved.count !== 1) break;

        const claim = await tx.taskClaim.create({
          data: {
            taskId,
            userId,
            executorAccountId: account.id,
            fundTaskPostId: post?.id ?? null,
            assignedPostTitle: post?.postTitle ?? null,
            assignedPostContent: post?.postContent ?? null,
            assignedPostUrl: post?.postUrl ?? null,
            rewardPoints: task.rewardPoints,
          },
        });
        usedAccountIds.push(account.id);
        assignments.push({
          claimId: claim.id.toString(),
          executorAccountId: account.id.toString(),
          executorAccountName: account.accountName,
          fundTaskPostId: post?.id.toString() ?? null,
          title: post?.postTitle ?? null,
          content: post?.postContent ?? null,
          url: post?.postUrl ?? null,
        });
      }

      if (assignments.length === 0) throw new ConflictException(`请先完善${task.platform}发布账号信息，或该任务已无可领取名额`);
      return {
        ids: assignments.map((item) => item.claimId),
        count: assignments.length,
        status: CLAIM_STATUS.PENDING_SUBMIT,
        rewardPoints: task.rewardPoints,
        assignments,
      };
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
      const operators = await tx.user.findMany({ where: { role: 'OPERATOR', status: 'ACTIVE' }, select: { id: true } });
      if (operators.length > 0) {
        const now = new Date();
        const postLabel = claim.assignedPostTitle ? `帖子“${claim.assignedPostTitle}”` : `${claim.task.platform}帖子`;
        await Promise.all(operators.map((operator) => tx.notification.upsert({
          where: { eventId_recipientId_templateCode: { eventId: claim.taskId, recipientId: operator.id, templateCode: 'SUBMISSION_PENDING_REVIEW' } },
          create: { recipientId: operator.id, eventId: claim.taskId, templateCode: 'SUBMISSION_PENDING_REVIEW', title: '有帖子资产待审核', content: `${postLabel}已提交链接和截图，请逐帖审核。`, status: 'UNREAD', createdAt: now },
          update: { title: '有帖子资产待审核', content: `${postLabel}已提交链接和截图，请逐帖审核。`, status: 'UNREAD', readAt: null, createdAt: now },
        })));
      }
      return { id: submission.id.toString(), status: submission.status };
    });
  }

  async updateSubmission(submissionId: string, input: UpdateSubmissionDto) {
    const id = BigInt(submissionId);
    return this.prisma.$transaction(async (tx) => {
      const submission = await tx.taskSubmission.findUnique({ include: { claim: { include: { task: true } } }, where: { id } });
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
      const operators = await tx.user.findMany({ where: { role: 'OPERATOR', status: 'ACTIVE' }, select: { id: true } });
      if (operators.length > 0) {
        const now = new Date();
        const postLabel = submission.claim.assignedPostTitle ? `帖子“${submission.claim.assignedPostTitle}”` : `${submission.claim.task.platform}帖子`;
        await Promise.all(operators.map((operator) => tx.notification.upsert({
          where: { eventId_recipientId_templateCode: { eventId: submission.taskId, recipientId: operator.id, templateCode: 'SUBMISSION_PENDING_REVIEW' } },
          create: { recipientId: operator.id, eventId: submission.taskId, templateCode: 'SUBMISSION_PENDING_REVIEW', title: '帖子资产已重新提交', content: `${postLabel}已补充链接或截图，请重新审核。`, status: 'UNREAD', createdAt: now },
          update: { title: '帖子资产已重新提交', content: `${postLabel}已补充链接或截图，请重新审核。`, status: 'UNREAD', readAt: null, createdAt: now },
        })));
      }
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
        const nextApprovedCount = submission.task.approvedCount + 1;
        const completed = nextApprovedCount >= submission.task.quota;
        await tx.task.update({
          where: { id: submission.taskId },
          data: {
            approvedCount: { increment: 1 },
            ...(completed ? { status: TASK_STATUS.COMPLETED, closedAt: new Date() } : {}),
          },
        });
        const account = await tx.userPointAccount.upsert({ where: { userId: submission.userId }, update: { availablePoints: { increment: submission.task.rewardPoints } }, create: { userId: submission.userId, availablePoints: submission.task.rewardPoints } });
        await tx.pointLedger.create({ data: { userId: submission.userId, taskId: submission.taskId, claimId: submission.claimId, entryType: 'TASK_REWARD', points: submission.task.rewardPoints, balanceAfter: account.availablePoints, remark: '任务审核通过奖励' } });
        if (completed && submission.task.fundProductId) {
          const fundUsers = await tx.user.findMany({ where: { role: 'FUND', status: 'ACTIVE', fundProductId: submission.task.fundProductId }, select: { id: true } });
          if (fundUsers.length > 0) {
            const now = new Date();
            await Promise.all(fundUsers.map((user) => tx.notification.upsert({
              where: { eventId_recipientId_templateCode: { eventId: submission.taskId, recipientId: user.id, templateCode: 'FUND_TASK_COMPLETED' } },
              create: { recipientId: user.id, eventId: submission.taskId, templateCode: 'FUND_TASK_COMPLETED', title: '基金任务已完成', content: `${submission.task.platform}任务的全部帖子已审核完成，可查看进度。`, status: 'UNREAD', createdAt: now },
              update: { title: '基金任务已完成', content: `${submission.task.platform}任务的全部帖子已审核完成，可查看进度。`, status: 'UNREAD', readAt: null, createdAt: now },
            })));
          }
        }
      }
      const notificationCode = input.approved ? 'SUBMISSION_APPROVED' : 'SUBMISSION_REWORKING';
      const notificationTitle = input.approved ? '帖子审核通过' : '帖子需要补充';
      const notificationContent = input.approved
        ? `${submission.claim.assignedPostTitle ? `帖子“${submission.claim.assignedPostTitle}”` : '本帖'}已通过审核，积分已到账。`
        : input.comment || '请补充本帖发布链接或截图后重新提交。';
      const now = new Date();
      await tx.notification.upsert({
        where: { eventId_recipientId_templateCode: { eventId: submission.taskId, recipientId: submission.userId, templateCode: notificationCode } },
        create: { recipientId: submission.userId, eventId: submission.taskId, templateCode: notificationCode, title: notificationTitle, content: notificationContent, status: 'UNREAD', createdAt: now },
        update: { title: notificationTitle, content: notificationContent, status: 'UNREAD', readAt: null, createdAt: now },
      });
      return { id: submission.id.toString(), status };
    });
  }
}
