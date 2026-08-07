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
import { UpdateSubscriberDto } from './dto/admin-subscriber.dto';
import { SubscribersService } from './subscribers.service';

@Controller('admin/subscribers')
@UseGuards(JwtAdminGuard, RolesGuard)
@Roles(
  AdminRole.SUPERADMIN,
  AdminRole.ADMIN,
  AdminRole.EDITOR,
  AdminRole.REDACTEUR,
)
export class AdminSubscribersController {
  constructor(private readonly subscribers: SubscribersService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('active') active?: string,
    @Query('verified') verified?: string,
    @Query('subscription') subscription?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.subscribers.list({
      q,
      active,
      verified,
      subscription,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.subscribers.getById(id);
  }

  @Patch(':id')
  @Roles(
    AdminRole.SUPERADMIN,
    AdminRole.ADMIN,
    AdminRole.EDITOR,
    AdminRole.REDACTEUR,
  )
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriberDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.subscribers.update(id, dto, actor.id);
  }
}
