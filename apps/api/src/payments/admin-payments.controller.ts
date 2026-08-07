import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AdminAuthUser } from '../auth/strategies/jwt-admin.strategy';
import {
  RequestAdminPaymentOtpDto,
  UpdateAdminPaymentDto,
} from './dto/admin-payment.dto';
import { AdminPaymentsService } from './admin-payments.service';

@Controller('admin/payments')
@UseGuards(JwtAdminGuard, RolesGuard)
@Roles(
  AdminRole.SUPERADMIN,
  AdminRole.ADMIN,
  AdminRole.EDITOR,
  AdminRole.REDACTEUR,
)
export class AdminPaymentsController {
  constructor(private readonly payments: AdminPaymentsService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('provider') provider?: string,
    @Query('purpose') purpose?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.payments.list({
      q,
      status,
      provider,
      purpose,
      from,
      to,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.payments.getById(id);
  }

  /** Envoie un OTP à l’e-mail admin avant modification de statut. */
  @Post(':id/otp')
  @Roles(AdminRole.SUPERADMIN, AdminRole.ADMIN)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  requestOtp(
    @Param('id') id: string,
    @Body() dto: RequestAdminPaymentOtpDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.payments.requestStatusOtp(
      id,
      { status: dto.status, note: dto.note },
      actor.id,
    );
  }

  /** Confirme le changement de statut avec OTP. */
  @Patch(':id')
  @Roles(AdminRole.SUPERADMIN, AdminRole.ADMIN)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAdminPaymentDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.payments.updateStatus(
      id,
      { status: dto.status, note: dto.note, otp: dto.otp },
      actor.id,
    );
  }
}
