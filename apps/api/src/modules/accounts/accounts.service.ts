import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertExecutorAccountDto } from './dto/upsert-executor-account.dto';
import { encryptAccountPassword } from './account-secret';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(userId: string) {
    const id = BigInt(userId);
    const user = await this.prisma.user.findUnique({ where: { id }, select: { role: true, status: true } });
    if (!user || user.role !== 'EXECUTOR') throw new NotFoundException('兼职账号不存在');
    const accounts = await this.prisma.executorAccount.findMany({ where: { userId: id }, orderBy: { id: 'asc' } });
    const activeClaims = await this.prisma.taskClaim.findMany({ where: { userId: id, activeFlag: 1, status: { in: ['PENDING_SUBMIT', 'PENDING_REVIEW', 'REWORKING'] } }, select: { executorAccountId: true } });
    const busyAccountIds = new Set(activeClaims.map((claim) => claim.executorAccountId?.toString()).filter(Boolean));
    const activeTaskCount = activeClaims.length;
    return {
      accounts: accounts.map((account) => ({ id: account.id.toString(), platform: account.platform, accountName: account.accountName, accountUid: account.accountUid, status: account.status, passwordSet: Boolean(account.passwordEncrypted) })),
      accountCount: accounts.filter((account) => account.status === 'ACTIVE').length,
      activeTaskCount,
      availableTaskSlots: accounts.filter((account) => account.status === 'ACTIVE' && !busyAccountIds.has(account.id.toString())).length,
    };
  }

  async create(userId: string, input: UpsertExecutorAccountDto) {
    const id = BigInt(userId);
    const user = await this.prisma.user.findUnique({ where: { id }, select: { role: true, status: true } });
    if (!user || user.role !== 'EXECUTOR' || user.status !== 'ACTIVE') throw new NotFoundException('兼职账号不存在');
    const password = input.password?.trim();
    const account = await this.prisma.executorAccount.create({ data: { userId: id, platform: input.platform, accountName: input.accountName.trim(), accountUid: input.accountUid?.trim() || null, passwordEncrypted: password ? encryptAccountPassword(password) : null } });
    return { id: account.id.toString(), platform: account.platform, accountName: account.accountName, accountUid: account.accountUid, status: account.status, passwordSet: Boolean(account.passwordEncrypted) };
  }

  async update(userId: string, accountId: string, input: UpsertExecutorAccountDto) {
    const account = await this.prisma.executorAccount.findFirst({ where: { id: BigInt(accountId), userId: BigInt(userId) } });
    if (!account) throw new NotFoundException('发布账号不存在');
    const password = input.password?.trim();
    return this.prisma.executorAccount.update({ where: { id: account.id }, data: { platform: input.platform, accountName: input.accountName.trim(), accountUid: input.accountUid?.trim() || null, ...(input.password === undefined ? {} : { passwordEncrypted: password ? encryptAccountPassword(password) : null }) }, select: { id: true, platform: true, accountName: true, accountUid: true, status: true, passwordEncrypted: true } }).then((updated) => ({ id: updated.id.toString(), platform: updated.platform, accountName: updated.accountName, accountUid: updated.accountUid, status: updated.status, passwordSet: Boolean(updated.passwordEncrypted) }));
  }

  async disable(userId: string, accountId: string) {
    const account = await this.prisma.executorAccount.findFirst({ where: { id: BigInt(accountId), userId: BigInt(userId) } });
    if (!account) throw new NotFoundException('发布账号不存在');
    if (account.status === 'ACTIVE') {
      const updated = await this.prisma.executorAccount.updateMany({
        where: {
          id: account.id,
          userId: BigInt(userId),
          status: 'ACTIVE',
          claims: { none: { activeFlag: 1, status: { in: ['PENDING_SUBMIT', 'PENDING_REVIEW', 'REWORKING'] } } },
        },
        data: { status: 'INACTIVE' },
      });
      if (updated.count !== 1) throw new ConflictException('该账号仍有进行中的任务');
    } else {
      await this.prisma.executorAccount.updateMany({ where: { id: account.id, userId: BigInt(userId), status: 'INACTIVE' }, data: { status: 'ACTIVE' } });
    }
    return this.summary(userId);
  }
}
