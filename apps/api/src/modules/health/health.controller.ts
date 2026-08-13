import { Controller, Get } from '@nestjs/common';
import { ok } from '../../common/response';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async health() {
    return ok(await this.healthService.check());
  }
}
