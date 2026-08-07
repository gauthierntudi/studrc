import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminNewsletterController } from './admin-newsletter.controller';
import { NewsletterService } from './newsletter.service';
import { PublicNewsletterController } from './public-newsletter.controller';

@Module({
  imports: [PrismaModule, AuthModule, MailModule],
  controllers: [PublicNewsletterController, AdminNewsletterController],
  providers: [NewsletterService],
  exports: [NewsletterService],
})
export class NewsletterModule {}
