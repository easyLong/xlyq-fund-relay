import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ok } from '../../common/response';
import { PointsService } from './points.service';

@Controller('point-accounts')
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get(':userId')
  async get(@Param('userId', ParseIntPipe) userId: number) {
    return ok(await this.pointsService.summary(String(userId)));
  }
}
