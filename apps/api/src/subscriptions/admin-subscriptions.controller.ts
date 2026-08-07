import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AdminAuthUser } from '../auth/strategies/jwt-admin.strategy';
import { UpdateSubscriptionDto } from './dto/admin-subscription.dto';
import { SubscriptionsService } from './subscriptions.service';

@Controller('admin/subscriptions')
@UseGuards(JwtAdminGuard, RolesGuard)
@Roles(
  AdminRole.SUPERADMIN,
  AdminRole.ADMIN,
  AdminRole.EDITOR,
  AdminRole.REDACTEUR,
)
export class AdminSubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.subscriptions.list({
      q,
      status,
      paymentStatus,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.subscriptions.getById(id);
  }

  @Patch(':id')
  @Roles(AdminRole.SUPERADMIN, AdminRole.ADMIN, AdminRole.EDITOR)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.subscriptions.update(id, dto, actor.id);
  }
}
