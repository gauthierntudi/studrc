import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminSponsorsController } from './admin-sponsors.controller';
import { SponsorsService } from './sponsors.service';

@Module({
  imports: [PrismaModule, ActivityModule, AuthModule],
  controllers: [AdminSponsorsController],
  providers: [SponsorsService],
  exports: [SponsorsService],
})
export class SponsorsModule {}
