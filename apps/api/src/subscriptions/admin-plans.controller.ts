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
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AdminAuthUser } from '../auth/strategies/jwt-admin.strategy';
import { CreatePlanDto, UpdatePlanDto } from './dto/admin-plan.dto';
import { SubscriptionsService } from './subscriptions.service';

@Controller('admin/plans')
@UseGuards(JwtAdminGuard, RolesGuard)
@Roles(
  AdminRole.SUPERADMIN,
  AdminRole.ADMIN,
  AdminRole.EDITOR,
  AdminRole.REDACTEUR,
)
export class AdminPlansController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  list(@Query('active') active?: string) {
    return this.subscriptions.listPlans({ active });
  }

  @Post()
  @Roles(AdminRole.SUPERADMIN, AdminRole.ADMIN, AdminRole.EDITOR)
  create(@Body() dto: CreatePlanDto, @CurrentAdmin() actor: AdminAuthUser) {
    return this.subscriptions.createPlan(dto, actor.id);
  }

  @Patch(':id')
  @Roles(AdminRole.SUPERADMIN, AdminRole.ADMIN, AdminRole.EDITOR)
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.subscriptions.updatePlan(id, dto, actor.id);
  }
}
