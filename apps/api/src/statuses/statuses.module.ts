import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { ArticlesModule } from '../articles/articles.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminStatusesController } from './admin-statuses.controller';
import { PublicStatusesController } from './public-statuses.controller';
import { StatusesService } from './statuses.service';

@Module({
  imports: [PrismaModule, ActivityModule, AuthModule, ArticlesModule],
  controllers: [AdminStatusesController, PublicStatusesController],
  providers: [StatusesService],
})
export class StatusesModule {}
