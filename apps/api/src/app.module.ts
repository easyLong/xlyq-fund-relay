import { Module } from '@nestjs/common';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { DemoModule } from './modules/demo/demo.module';
import { PointsModule } from './modules/points/points.module';
import { AuthModule } from './modules/auth/auth.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { FundPostsModule } from './modules/fund-posts/fund-posts.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    TasksModule,
    DashboardModule,
    DemoModule,
    PointsModule,
    AuthModule,
    AccountsModule,
    FundPostsModule,
  ],
})
export class AppModule {}
