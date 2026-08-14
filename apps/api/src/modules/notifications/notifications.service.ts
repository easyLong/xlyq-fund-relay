import { Injectable } from '@nestjs/common';
import type { NotificationSummary } from '@xlyq/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<NotificationSummary> {
    const recipientId = BigInt(userId);
    const [unreadCount, rows] = await this.prisma.$transaction([
      this.prisma.notification.count({ where: { recipientId, status: 'UNREAD' } }),
      this.prisma.notification.findMany({
        where: { recipientId },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          id: true,
          templateCode: true,
          title: true,
          content: true,
          status: true,
          readAt: true,
          createdAt: true,
          eventId: true,
        },
      }),
    ]);
    return {
      unreadCount,
      items: rows.map((item) => ({
        id: item.id.toString(),
        templateCode: item.templateCode,
        title: item.title,
        content: item.content,
        status: item.status === 'READ' ? 'READ' : 'UNREAD',
        readAt: item.readAt?.toISOString() ?? null,
        createdAt: item.createdAt.toISOString(),
        details: item.eventId ? { taskId: item.eventId.toString() } : null,
      })),
    };
  }

  async markAllRead(userId: string): Promise<NotificationSummary> {
    await this.prisma.notification.updateMany({
      where: { recipientId: BigInt(userId), status: 'UNREAD' },
      data: { status: 'READ', readAt: new Date() },
    });
    return this.list(userId);
  }
}
