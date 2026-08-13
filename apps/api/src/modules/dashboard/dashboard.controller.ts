import { Controller, Get } from '@nestjs/common';
import { ok } from '../../common/response';
import { DashboardService } from './dashboard.service';

@Controller('dashboards')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('operator')
  async operator() {
    return ok(await this.dashboardService.operatorSummary());
  }
}
