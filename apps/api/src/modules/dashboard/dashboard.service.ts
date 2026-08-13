import { Injectable } from '@nestjs/common';
import { CLAIM_STATUS, TASK_STATUS, type DashboardSummary } from '@xlyq/shared';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
  ) {}

  async operatorSummary(): Promise<DashboardSummary> {
    const [pendingPublish, published, inProgress, completed, expired, pendingReview] =
      await this.prisma.$transaction([
        this.prisma.task.count({ where: { status: TASK_STATUS.PENDING_PUBLISH } }),
        this.prisma.task.count({ where: { status: TASK_STATUS.PUBLISHED } }),
        this.prisma.task.count({ where: { status: TASK_STATUS.IN_PROGRESS } }),
        this.prisma.task.count({ where: { status: TASK_STATUS.COMPLETED } }),
        this.prisma.task.count({ where: { status: TASK_STATUS.EXPIRED } }),
        this.prisma.taskClaim.count({ where: { status: CLAIM_STATUS.PENDING_REVIEW } }),
      ]);
    const recentTasks = await this.tasksService.recent(5);
    const pointTotals = await this.prisma.userPointAccount.aggregate({ _sum: { availablePoints: true } });
    const today = new Date();
    const inThreeDays = new Date(today.getTime() + 3 * 86400000);
    const todayDue = await this.prisma.task.count({ where: { dueAt: { gt: today, lte: inThreeDays }, status: { in: [TASK_STATUS.PUBLISHED, TASK_STATUS.IN_PROGRESS] } } });
    const taskStats = [
      { key: TASK_STATUS.DRAFT, label: '草稿', count: await this.prisma.task.count({ where: { status: TASK_STATUS.DRAFT } }) },
      { key: TASK_STATUS.PUBLISHED, label: '可领取', count: published },
      { key: TASK_STATUS.IN_PROGRESS, label: '进行中', count: inProgress },
      { key: TASK_STATUS.COMPLETED, label: '已完成', count: completed },
      { key: TASK_STATUS.EXPIRED, label: '已过期', count: expired },
      { key: 'PENDING_REVIEW' as const, label: '待审核', count: pendingReview },
    ];
    const queueRows = await this.prisma.task.findMany({
      where: {
        OR: [
          { status: TASK_STATUS.DRAFT },
          { status: { in: [TASK_STATUS.PUBLISHED, TASK_STATUS.IN_PROGRESS] }, dueAt: { gt: today, lte: inThreeDays } },
          { status: TASK_STATUS.EXPIRED },
        ],
      },
      include: { organization: true },
      orderBy: [{ dueAt: 'asc' }, { updatedAt: 'desc' }],
      take: 8,
    });
    const reviewRows = await this.prisma.taskClaim.findMany({
      where: { status: CLAIM_STATUS.PENDING_REVIEW },
      include: { task: true },
      orderBy: { submittedAt: 'asc' },
      take: 8,
    });
    const actionQueue: DashboardSummary['actionQueue'] = [
      ...reviewRows.map((row) => ({
        id: `review-${row.id}`,
        type: 'REVIEW_SUBMISSION' as const,
        title: '审核执行结果',
        description: `${row.task.title} 有新的提交待处理`,
        taskId: row.taskId.toString(),
        taskTitle: row.task.title,
        priority: 'HIGH' as const,
      })),
      ...queueRows.map((row) => ({
        id: `${row.status}-${row.id}`,
        type: row.status === TASK_STATUS.DRAFT ? 'PUBLISH_TASK' as const : row.status === TASK_STATUS.EXPIRED ? 'EXPIRED_TASK' as const : 'EXPIRING_TASK' as const,
        title: row.status === TASK_STATUS.DRAFT ? '发布任务' : row.status === TASK_STATUS.EXPIRED ? '处理过期任务' : '关注即将截止任务',
        description: row.status === TASK_STATUS.DRAFT ? `${row.title} 尚未发布` : row.status === TASK_STATUS.EXPIRED ? `${row.title} 已超过截止时间` : `${row.title} 将在三天内截止`,
        taskId: row.id.toString(),
        taskTitle: row.title,
        dueAt: row.dueAt.toISOString(),
        priority: row.status === TASK_STATUS.EXPIRED ? 'HIGH' as const : 'MEDIUM' as const,
      })),
    ].slice(0, 10);
    const customer = await this.prisma.organization.findFirst({ where: { code: 'DEMO-ORG' } });
    const customerTasks = customer ? await this.prisma.task.findMany({ where: { organizationId: customer.id } }) : [];
    const customerSnapshot = customer
      ? {
          organizationName: customer.name,
          fundProductName: '稳健增利混合基金',
          activeTasks: customerTasks.filter((task) => [TASK_STATUS.PUBLISHED, TASK_STATUS.IN_PROGRESS].includes(task.status as typeof TASK_STATUS.PUBLISHED)).length,
          totalTasks: customerTasks.length,
          claimedCount: customerTasks.reduce((sum, task) => sum + task.claimedCount, 0),
          approvedCount: customerTasks.reduce((sum, task) => sum + task.approvedCount, 0),
          pendingReview,
          completionRate: customerTasks.length ? Math.round((customerTasks.reduce((sum, task) => sum + task.approvedCount, 0) / Math.max(1, customerTasks.reduce((sum, task) => sum + task.claimedCount, 0))) * 100) : 0,
          availablePoints: pointTotals._sum.availablePoints ?? 0,
        }
      : null;

    return {
      pendingPublish,
      published,
      inProgress,
      completed,
      expired,
      pendingReview,
      recentTasks,
      totalPoints: pointTotals._sum.availablePoints ?? 0,
      todayDue,
      taskStats,
      actionQueue,
      customerSnapshot,
    };
  }
}
