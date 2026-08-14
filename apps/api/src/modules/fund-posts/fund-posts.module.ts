import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FundPostsController } from './fund-posts.controller';
import { FundPostsService } from './fund-posts.service';

@Module({ imports: [PrismaModule], controllers: [FundPostsController], providers: [FundPostsService] })
export class FundPostsModule {}
