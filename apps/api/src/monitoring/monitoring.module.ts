import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminMonitoringController } from './admin-monitoring.controller';
import { MonitoringService } from './monitoring.service';

@Module({
  imports: [PrismaModule, MailModule, AuthModule],
  controllers: [AdminMonitoringController],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
