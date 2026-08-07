import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminPlansController } from './admin-plans.controller';
import { AdminSubscriptionsController } from './admin-subscriptions.controller';
import { PublicPlansController } from './public-plans.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [PrismaModule, ActivityModule, AuthModule],
  controllers: [
    AdminSubscriptionsController,
    AdminPlansController,
    PublicPlansController,
  ],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
