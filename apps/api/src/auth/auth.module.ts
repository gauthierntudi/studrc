import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ActivityModule } from '../activity/activity.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminStaffController } from './admin-staff.controller';
import { AdminStaffService } from './admin-staff.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RolesGuard } from './guards/roles.guard';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtAdminStrategy } from './strategies/jwt-admin.strategy';

@Module({
  imports: [
    ActivityModule,
    PassportModule.register({ defaultStrategy: 'jwt-access' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [
    AuthController,
    AdminAuthController,
    AdminStaffController,
    AdminDashboardController,
  ],
  providers: [
    AuthService,
    AdminAuthService,
    AdminStaffService,
    AdminDashboardService,
    RolesGuard,
    JwtAccessStrategy,
    JwtAdminStrategy,
  ],
  exports: [AuthService, AdminAuthService, JwtModule, RolesGuard, PassportModule],
})
export class AuthModule {}
