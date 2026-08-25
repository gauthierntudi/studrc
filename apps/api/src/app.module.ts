import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { existsSync } from 'fs';
import { join } from 'path';
import { config as loadEnv } from 'dotenv';
import { ActivityModule } from './activity/activity.module';
import { ArticlesModule } from './articles/articles.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { LibraryModule } from './library/library.module';
import { MagazinesModule } from './magazines/magazines.module';
import { MailModule } from './mail/mail.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { PrismaModule } from './prisma/prisma.module';
import { SettingsModule } from './settings/settings.module';
import { SubscribersModule } from './subscribers/subscribers.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { PaymentsModule } from './payments/payments.module';
import { MonitoringModule } from './monitoring/monitoring.module';

const envApi = join(__dirname, '../.env');
const envRoot = join(__dirname, '../../../.env');
if (existsSync(envApi)) loadEnv({ path: envApi });
if (existsSync(envRoot)) loadEnv({ path: envRoot, override: true });

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [envApi, envRoot],
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    MailModule,
    HealthModule,
    AuthModule,
    ActivityModule,
    LibraryModule,
    MagazinesModule,
    ArticlesModule,
    SubscriptionsModule,
    SubscribersModule,
    PaymentsModule,
    NewsletterModule,
    SettingsModule,
    MonitoringModule,
  ],
})
export class AppModule {}

