import { Body, Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Post, Put, Query, Req } from '@nestjs/common';
import { ok, page } from '../../common/response';
import { CreateTaskDto } from './dto/create-task.dto';
import { ImportTasksDto } from './dto/import-tasks.dto';
import { ClaimTaskDto } from './dto/claim-task.dto';
import { ReviewSubmissionDto } from './dto/review-submission.dto';
import { SubmitTaskDto } from './dto/submit-task.dto';
import { RemindTaskDto } from './dto/remind-task.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';
import { TasksService } from './tasks.service';
import { UserTasksService } from './tasks.user';

@Controller()
export class TasksController {
  constructor(private readonly tasksService: TasksService, private readonly userTasksService: UserTasksService) {}

  @Get('users/:userId/tasks')
  async userTasks(@Param('userId') userId: string) {
    return ok(await this.userTasksService.list(userId));
  }

  @Get('tasks')
  async list(
    @Query('pageNo', new DefaultValuePipe(1), ParseIntPipe) pageNo: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    const safePageNo = Math.min(Math.max(pageNo, 1), 100000);
    const safePageSize = Math.min(Math.max(pageSize, 1), 100);
    const result = await this.tasksService.list(safePageNo, safePageSize);
    return page(result.rows, safePageNo, safePageSize, result.total);
  }

  @Get('task-market')
  async market(
    @Query('pageNo', new DefaultValuePipe(1), ParseIntPipe) pageNo: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
    @Query('viewerId') viewerId?: string,
    @Query('viewerRole') viewerRole?: string,
  ) {
    const safePageNo = Math.min(Math.max(pageNo, 1), 100000);
    const safePageSize = Math.min(Math.max(pageSize, 1), 100);
    const result = await this.tasksService.market(safePageNo, safePageSize, viewerId, viewerRole);
    return page(result.rows, safePageNo, safePageSize, result.total);
  }

  @Get('tasks/:id')
  async detail(@Param('id') id: string, @Query('viewerId') viewerId?: string, @Query('viewerRole') viewerRole?: string) {
    return ok(await this.tasksService.detail(id, viewerId, viewerRole));
  }

  @Post('tasks')
  async create(@Body() input: CreateTaskDto) {
    return ok(await this.tasksService.create(input));
  }

  @Post('tasks/import')
  async import(@Body() input: ImportTasksDto, @Req() request: { user?: { id: string } }) {
    return ok(await this.tasksService.importTasks(input, request.user?.id));
  }

  @Post('tasks/:id/publish')
  async publish(@Param('id') id: string) {
    return ok(await this.tasksService.publish(id));
  }

  @Post('tasks/:id/unpublish')
  async unpublish(@Param('id') id: string) {
    return ok(await this.tasksService.unpublish(id));
  }

  @Post('tasks/:id/remind')
  async remind(@Param('id') id: string, @Body() input: RemindTaskDto) {
    return ok(await this.tasksService.remind(id, input));
  }

  @Post('tasks/:id/claims')
  async claim(@Param('id') id: string, @Body() input: ClaimTaskDto) {
    return ok(await this.tasksService.claim(id, input));
  }

  @Post('task-submissions')
  async submit(@Body() input: SubmitTaskDto) {
    return ok(await this.tasksService.submit(input));
  }

  @Post('task-submissions/:id/review')
  async review(@Param('id') id: string, @Body() input: ReviewSubmissionDto) {
    return ok(await this.tasksService.review(id, input));
  }

  @Put('task-submissions/:id')
  async updateSubmission(@Param('id') id: string, @Body() input: UpdateSubmissionDto) {
    return ok(await this.tasksService.updateSubmission(id, input));
  }
}
