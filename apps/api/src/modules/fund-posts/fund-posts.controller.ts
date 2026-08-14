import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ok } from '../../common/response';
import { UpsertFundPostDto } from './dto/upsert-fund-post.dto';
import { FundPostsService } from './fund-posts.service';

@Controller('fund-posts')
export class FundPostsController {
  constructor(private readonly service: FundPostsService) {}

  @Get()
  async list(@Query('fundProductId') fundProductId: string) { return ok(await this.service.list(fundProductId)); }

  @Get('progress')
  async progress(@Query('userId') userId: string, @Query('fundProductId') fundProductId: string) { return ok(await this.service.progress(userId, fundProductId)); }

  @Post()
  async create(@Query('userId') userId: string, @Query('fundProductId') fundProductId: string, @Body() input: UpsertFundPostDto) { return ok(await this.service.create(userId, fundProductId, input)); }

  @Put(':id')
  async update(@Param('id') id: string, @Query('userId') userId: string, @Body() input: UpsertFundPostDto) { return ok(await this.service.update(userId, id, input)); }
}
