import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { UserTasksService } from './tasks.user';

@Module({
  controllers: [TasksController],
  providers: [TasksService, UserTasksService],
  exports: [TasksService, UserTasksService],
})
export class TasksModule {}
