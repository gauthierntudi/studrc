import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminSubscribersController } from './admin-subscribers.controller';
import { SubscribersService } from './subscribers.service';

@Module({
  imports: [PrismaModule, ActivityModule, AuthModule],
  controllers: [AdminSubscribersController],
  providers: [SubscribersService],
  exports: [SubscribersService],
})
export class SubscribersModule {}
