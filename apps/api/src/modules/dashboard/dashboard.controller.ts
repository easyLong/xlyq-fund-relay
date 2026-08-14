import { Controller, Get, Query, Req } from '@nestjs/common';
import { ok } from '../../common/response';
import { DashboardService } from './dashboard.service';

@Controller('dashboards')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('operator')
  async operator() {
    return ok(await this.dashboardService.operatorSummary());
  }

  @Get('fund')
  async fund(@Query('fundProductId') fundProductId: string, @Req() request: { user?: { id: string } }) {
    return ok(await this.dashboardService.fundSummary(fundProductId, request.user?.id));
  }
}
