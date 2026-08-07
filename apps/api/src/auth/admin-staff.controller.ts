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
import { AdminStaffService } from './admin-staff.service';
import { CurrentAdmin } from './decorators/current-admin.decorator';
import { Roles } from './decorators/roles.decorator';
import { CreateStaffDto, UpdateStaffDto } from './dto/admin-staff.dto';
import { JwtAdminGuard } from './guards/jwt-admin.guard';
import { RolesGuard } from './guards/roles.guard';
import type { AdminAuthUser } from './strategies/jwt-admin.strategy';

@Controller('admin/staff')
@UseGuards(JwtAdminGuard, RolesGuard)
@Roles(AdminRole.SUPERADMIN, AdminRole.ADMIN)
export class AdminStaffController {
  constructor(private readonly staff: AdminStaffService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('active') active?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.staff.list({
      q,
      active,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  @Post()
  create(
    @Body() dto: CreateStaffDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.staff.create(dto, actor.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.staff.update(id, dto, actor.id);
  }
}
