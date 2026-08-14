import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ok } from '../../common/response';
import { UpsertExecutorAccountDto } from './dto/upsert-executor-account.dto';
import { AccountsService } from './accounts.service';

@Controller('users/:userId/executor-accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  async summary(@Param('userId') userId: string) { return ok(await this.accountsService.summary(userId)); }

  @Post()
  async create(@Param('userId') userId: string, @Body() input: UpsertExecutorAccountDto) { return ok(await this.accountsService.create(userId, input)); }

  @Put(':accountId')
  async update(@Param('userId') userId: string, @Param('accountId') accountId: string, @Body() input: UpsertExecutorAccountDto) { return ok(await this.accountsService.update(userId, accountId, input)); }

  @Post(':accountId/toggle')
  async toggle(@Param('userId') userId: string, @Param('accountId') accountId: string) { return ok(await this.accountsService.disable(userId, accountId)); }
}
