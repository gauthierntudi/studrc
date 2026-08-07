import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminSettingsController } from './admin-settings.controller';
import { PublicSettingsController } from './public-settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PublicSettingsController, AdminSettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
