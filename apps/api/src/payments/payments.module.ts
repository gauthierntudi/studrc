import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminPaymentsController } from './admin-payments.controller';
import { AdminPaymentsService } from './admin-payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [PrismaModule, AuthModule, ActivityModule],
  controllers: [PaymentsController, AdminPaymentsController],
  providers: [PaymentsService, AdminPaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
