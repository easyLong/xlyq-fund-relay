import { Controller, Get, Post, Req } from '@nestjs/common';
import { ok } from '../../common/response';
import type { SessionUser } from '../auth/session';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(@Req() request: { user: SessionUser }) {
    return ok(await this.notificationsService.list(request.user.id));
  }

  @Post('read-all')
  async readAll(@Req() request: { user: SessionUser }) {
    return ok(await this.notificationsService.markAllRead(request.user.id));
  }
}
