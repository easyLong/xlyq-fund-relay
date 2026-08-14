import { Body, Controller, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ok } from '../../common/response';
import { UpsertFundPostDto } from './dto/upsert-fund-post.dto';
import { FundPostsService } from './fund-posts.service';

@Controller('fund-posts')
export class FundPostsController {
  constructor(private readonly service: FundPostsService) {}

  @Get()
  async list(@Query('fundProductId') fundProductId: string, @Req() request: { user?: { id: string; role: string } }) { return ok(await this.service.list(fundProductId, request.user?.id, request.user?.role)); }

  @Get('progress')
  async progress(@Query('userId') userId: string, @Query('fundProductId') fundProductId: string, @Req() request: { user?: { id: string; role: string } }) { return ok(await this.service.progress(request.user?.id ?? userId, fundProductId)); }

  @Post()
  async create(@Query('userId') userId: string, @Query('fundProductId') fundProductId: string, @Body() input: UpsertFundPostDto) { return ok(await this.service.create(userId, fundProductId, input)); }

  @Put(':id')
  async update(@Param('id') id: string, @Query('userId') userId: string, @Body() input: UpsertFundPostDto) { return ok(await this.service.update(userId, id, input)); }
}
