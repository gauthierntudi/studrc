import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAuthorsController } from './admin-authors.controller';
import { AuthorsService } from './authors.service';

@Module({
  imports: [PrismaModule, ActivityModule, AuthModule],
  controllers: [AdminAuthorsController],
  providers: [AuthorsService],
  exports: [AuthorsService],
})
export class AuthorsModule {}
