import { Injectable } from '@nestjs/common';
import type { DemoContext } from '@xlyq/shared';
import { TASK_STATUS } from '@xlyq/shared';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword } from '../auth/password';

@Injectable()
export class DemoService {
  constructor(private readonly prisma: PrismaService) {}

  async bootstrap(): Promise<DemoContext> {
    await this.prisma.accountRole.createMany({
      data: [
        { username: 'admin', roleCode: 'OPERATOR', organizationName: null, status: 'ACTIVE' },
        { username: 'staff1', roleCode: 'EXECUTOR', organizationName: null, status: 'ACTIVE' },
        { username: 'staff2', roleCode: 'EXECUTOR', organizationName: null, status: 'ACTIVE' },
        { username: 'staff3', roleCode: 'EXECUTOR', organizationName: null, status: 'ACTIVE' },
        { username: 'fund1', roleCode: 'FUND', organizationName: '红土基金', status: 'ACTIVE' },
        { username: 'fund2', roleCode: 'FUND', organizationName: '易方达基金', status: 'ACTIVE' },
      ],
      skipDuplicates: true,
    });
    const organization = await this.prisma.organization.upsert({
      where: { code: 'DEMO-ORG' },
      update: { name: '红土基金', status: 'ACTIVE' },
      create: { code: 'DEMO-ORG', name: '红土基金' },
    });
    const organizationTwo = await this.prisma.organization.upsert({
      where: { code: 'DEMO-ORG-002' },
      update: { name: '易方达基金', status: 'ACTIVE' },
      create: { code: 'DEMO-ORG-002', name: '易方达基金' },
    });
    const operator = await this.prisma.user.upsert({
      where: { username: 'admin' },
      update: { displayName: '运营管理员', passwordHash: hashPassword('123456'), role: 'OPERATOR', status: 'ACTIVE' },
      create: { username: 'admin', displayName: '运营管理员', passwordHash: hashPassword('123456'), role: 'OPERATOR', status: 'ACTIVE' },
    });
    const executor = await this.prisma.user.upsert({
      where: { username: 'staff1' },
      update: { displayName: '兼职执行员 1', passwordHash: hashPassword('123456'), role: 'EXECUTOR', status: 'ACTIVE' },
      create: { username: 'staff1', displayName: '兼职执行员 1', passwordHash: hashPassword('123456'), role: 'EXECUTOR', status: 'ACTIVE' },
    });
    const executorTwo = await this.prisma.user.upsert({
      where: { username: 'staff2' },
      update: { displayName: '兼职执行员 2', passwordHash: hashPassword('123456'), role: 'EXECUTOR', status: 'ACTIVE' },
      create: { username: 'staff2', displayName: '兼职执行员 2', passwordHash: hashPassword('123456'), role: 'EXECUTOR', status: 'ACTIVE' },
    });
    const executorThree = await this.prisma.user.upsert({
      where: { username: 'staff3' },
      update: { displayName: '兼职执行员 3', passwordHash: hashPassword('123456'), role: 'EXECUTOR', status: 'ACTIVE' },
      create: { username: 'staff3', displayName: '兼职执行员 3', passwordHash: hashPassword('123456'), role: 'EXECUTOR', status: 'ACTIVE' },
    });
    const fund = await this.prisma.user.upsert({
      where: { username: 'fund1' },
      update: { displayName: '基金内容负责人', passwordHash: hashPassword('123456'), role: 'FUND', status: 'ACTIVE' },
      create: { username: 'fund1', displayName: '基金内容负责人', passwordHash: hashPassword('123456'), role: 'FUND', status: 'ACTIVE' },
    });
    const fundTwo = await this.prisma.user.upsert({
      where: { username: 'fund2' },
      update: { displayName: '易方达基金', passwordHash: hashPassword('123456'), role: 'FUND', status: 'ACTIVE' },
      create: { username: 'fund2', displayName: '易方达基金', passwordHash: hashPassword('123456'), role: 'FUND', status: 'ACTIVE' },
    });
    await this.prisma.user.updateMany({
      where: { username: { in: ['demo-operator', 'demo-executor', 'demo-executor-2', 'demo-executor-3'] } },
      data: { status: 'INACTIVE' },
    });
    const fundProduct = await this.prisma.fundProduct.upsert({
      where: { code: 'DEMO-FUND-001' },
      update: { name: '红土基金', status: 'ACTIVE' },
      create: {
        code: 'DEMO-FUND-001',
        name: '红土基金',
        productType: '混合型',
        riskLevel: 'R3',
      },
    });
    const fundProductTwo = await this.prisma.fundProduct.upsert({
      where: { code: 'DEMO-FUND-002' },
      update: { name: '易方达基金', status: 'ACTIVE' },
      create: {
        code: 'DEMO-FUND-002',
        name: '易方达基金',
        productType: '混合型',
        riskLevel: 'R3',
      },
    });
    await this.prisma.user.update({ where: { id: fund.id }, data: { fundProductId: fundProduct.id } });
    await this.prisma.user.update({ where: { id: fundTwo.id }, data: { fundProductId: fundProductTwo.id } });

    await this.prisma.userPointAccount.upsert({
      where: { userId: executor.id },
      update: {},
      create: { userId: executor.id },
    });
    await this.prisma.userPointAccount.upsert({
      where: { userId: executorTwo.id },
      update: {},
      create: { userId: executorTwo.id },
    });
    await this.prisma.userPointAccount.upsert({
      where: { userId: executorThree.id },
      update: {},
      create: { userId: executorThree.id },
    });
    if (await this.prisma.executorAccount.count({ where: { userId: executor.id } }) === 0) {
      await this.prisma.executorAccount.createMany({ data: [
        { userId: executor.id, platform: '小红书', accountName: '演示小红书主账号', accountUid: 'demo-xhs-001' },
        { userId: executor.id, platform: '抖音', accountName: '演示抖音账号', accountUid: 'demo-douyin-001' },
      ] });
    }

    const existingTask = await this.prisma.task.findFirst({
      where: { organizationId: organization.id, title: '月度基金内容种草任务' },
    });
    if (!existingTask) {
      await this.prisma.task.create({
        data: {
          organizationId: organization.id,
          fundProductId: fundProduct.id,
          title: '月度基金内容种草任务',
          description: '围绕稳健理财场景发布一条真实、合规、可追踪的内容。',
          originalText: '基金公司原文：围绕稳健理财场景，介绍长期投资与资产配置理念。内容须客观、真实、合规，不得承诺收益。',
          taskType: 'CONTENT_PUBLISH',
          platform: '小红书',
          campaignName: '八月稳健理财季',
          status: TASK_STATUS.PUBLISHED,
          quota: 20,
          rewardPoints: 10,
          submitRequirements: { fields: ['发布链接', '内容截图'], note: '内容需保留可访问链接' },
          complianceRequirements: '不得承诺收益，不得使用绝对化表述，权益信息必须与活动资料一致。',
          dueAt: new Date(Date.now() + 7 * 86400000),
          publishedAt: new Date(),
          createdBy: operator.id,
        },
      });
    }

    const accounts = await this.prisma.userPointAccount.findMany({
      where: { userId: { in: [executor.id, executorTwo.id, executorThree.id] } },
    });
    const accountFor = (userId: bigint) => accounts.find((account) => account.userId === userId)?.availablePoints ?? 0;
    return {
      operator: { id: operator.id.toString(), name: operator.displayName, username: operator.username ?? 'admin', role: 'operator' as const },
      fund: { id: fund.id.toString(), name: fund.displayName, username: fund.username ?? 'fund1', role: 'fund' as const, fundProductId: fundProduct.id.toString() },
      executor: {
        id: executor.id.toString(),
        name: executor.displayName,
        username: executor.username ?? 'staff1',
        role: 'executor' as const,
        availablePoints: accountFor(executor.id),
      },
      executors: [executor, executorTwo, executorThree].map((user) => ({
        id: user.id.toString(),
        name: user.displayName,
        username: user.username ?? '',
        role: 'executor' as const,
        availablePoints: accountFor(user.id),
      })),
      organization: { id: organization.id.toString(), name: organization.name },
      fundProduct: {
        id: fundProduct.id.toString(),
        name: fundProduct.name,
        code: fundProduct.code ?? '',
        organizationId: organization.id.toString(),
        organizationName: organization.name,
      },
      fundProducts: [
        { id: fundProduct.id.toString(), name: fundProduct.name, code: fundProduct.code ?? '', organizationId: organization.id.toString(), organizationName: organization.name },
        { id: fundProductTwo.id.toString(), name: fundProductTwo.name, code: fundProductTwo.code ?? '', organizationId: organizationTwo.id.toString(), organizationName: organizationTwo.name },
      ],
    };
  }
}
