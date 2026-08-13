import { Controller, Post } from '@nestjs/common';
import { ok } from '../../common/response';
import { DemoService } from './demo.service';

@Controller('demo')
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Post('bootstrap')
  async bootstrap() {
    return ok(await this.demoService.bootstrap());
  }
}
