import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminMagazinesController } from './admin-magazines.controller';
import { MagazinesService } from './magazines.service';
import { PublicMagazinesController } from './public-magazines.controller';

@Module({
  imports: [PrismaModule, ActivityModule, AuthModule],
  controllers: [AdminMagazinesController, PublicMagazinesController],
  providers: [MagazinesService],
  exports: [MagazinesService],
})
export class MagazinesModule {}
