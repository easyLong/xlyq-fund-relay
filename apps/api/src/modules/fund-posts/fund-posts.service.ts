import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertFundPostDto } from './dto/upsert-fund-post.dto';

@Injectable()
export class FundPostsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertFundUser(userId: string, fundProductId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: BigInt(userId) }, select: { role: true, status: true, fundProductId: true } });
    if (!user || user.role !== 'FUND' || user.status !== 'ACTIVE') throw new UnauthorizedException('仅基金角色可维护帖子');
    if (user.fundProductId !== BigInt(fundProductId)) throw new UnauthorizedException('当前基金账号未绑定该基金');
  }

  private async assertScope(userId: string | undefined, role: string | undefined, fundProductId: string) {
    if (!userId) throw new UnauthorizedException('登录状态无效');
    if (role === 'OPERATOR') return;
    await this.assertFundUser(userId, fundProductId);
  }

  async list(fundProductId: string, userId?: string, role?: string) {
    await this.assertScope(userId, role, fundProductId);
    const rows = await this.prisma.fundTask.findMany({ where: { fundProductId: BigInt(fundProductId), status: 'ACTIVE' }, include: { posts: { where: { status: 'ACTIVE' }, orderBy: { id: 'asc' } } }, orderBy: [{ taskName: 'asc' }, { updatedAt: 'desc' }] });
    return rows.map((row) => this.mapTask(row));
  }

  async progress(userId: string, fundProductId: string) {
    await this.assertFundUser(userId, fundProductId);
    const rows = await this.prisma.fundTask.findMany({
      where: { fundProductId: BigInt(fundProductId), status: 'ACTIVE' },
      include: {
        posts: { where: { status: 'ACTIVE' }, select: { id: true } },
        tasks: { select: { status: true, claimedCount: true, approvedCount: true, claims: { where: { activeFlag: 1 }, select: { status: true } } } },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
    return rows.map((row) => {
      const postCount = row.posts.length;
      const publishedTaskCount = row.tasks.filter((task) => ['PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'].includes(task.status)).length;
      const claimedCount = row.tasks.reduce((sum, task) => sum + task.claimedCount, 0);
      const approvedCount = row.tasks.reduce((sum, task) => sum + task.approvedCount, 0);
      const submittedCount = row.tasks.reduce((sum, task) => sum + task.claims.filter((claim) => ['PENDING_REVIEW', 'APPROVED', 'REWORKING'].includes(claim.status)).length, 0);
      return { id: row.id.toString(), taskName: row.taskName, platform: row.platform, postCount, publishedTaskCount, claimedCount, submittedCount, approvedCount, completionRate: postCount ? Math.round((approvedCount / postCount) * 100) : 0, status: row.tasks.some((task) => task.status === 'IN_PROGRESS') ? 'IN_PROGRESS' : row.tasks[0]?.status ?? 'NOT_PUBLISHED' };
    });
  }

  async create(userId: string, fundProductId: string, input: UpsertFundPostDto) {
    await this.assertFundUser(userId, fundProductId);
    const task = await this.prisma.fundTask.create({ data: { createdBy: BigInt(userId), fundProductId: BigInt(fundProductId), taskName: input.taskName.trim(), platform: input.platform, posts: { create: input.posts.map((post) => ({ postTitle: post.title.trim(), postContent: post.content.trim(), postUrl: post.url?.trim() || null, platform: input.platform, taskName: input.taskName.trim(), fundProductId: BigInt(fundProductId), createdBy: BigInt(userId) })) } }, include: { posts: true } });
    return this.mapTask(task);
  }

  async update(userId: string, id: string, input: UpsertFundPostDto) {
    const user = await this.prisma.user.findUnique({ where: { id: BigInt(userId) }, select: { role: true, status: true, fundProductId: true } });
    if (!user || user.role !== 'FUND' || user.status !== 'ACTIVE') throw new UnauthorizedException('仅基金角色可维护帖子');
    const existing = await this.prisma.fundTask.findUnique({ where: { id: BigInt(id) } });
    if (!existing) throw new NotFoundException('基金任务不存在');
    if (user.fundProductId !== existing.fundProductId) throw new UnauthorizedException('当前基金账号无权修改该任务');
    const task = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM fund_tasks WHERE id = ${existing.id} FOR UPDATE`;
      await tx.fundTaskPost.updateMany({ where: { fundTaskId: existing.id }, data: { status: 'INACTIVE' } });
      return tx.fundTask.update({ where: { id: existing.id }, data: { taskName: input.taskName.trim(), platform: input.platform, posts: { create: input.posts.map((post) => ({ postTitle: post.title.trim(), postContent: post.content.trim(), postUrl: post.url?.trim() || null, platform: input.platform, taskName: input.taskName.trim(), fundProductId: existing.fundProductId, createdBy: BigInt(userId) })) } }, include: { posts: { where: { status: 'ACTIVE' }, orderBy: { id: 'asc' } } } });
    });
    return this.mapTask(task);
  }

  private mapTask(row: { id: bigint; fundProductId: bigint; taskName: string; platform: string; status: string; createdAt: Date; updatedAt: Date; posts: Array<{ id: bigint; postTitle: string | null; postContent: string | null; postUrl: string | null; platform: string }> }) {
    return { id: row.id.toString(), fundProductId: row.fundProductId.toString(), taskName: row.taskName, platform: row.platform, status: row.status, postCount: row.posts.length, posts: row.posts.map((post) => ({ id: post.id.toString(), title: post.postTitle ?? '', content: post.postContent ?? '', url: post.postUrl, platform: post.platform })), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
  }
}
