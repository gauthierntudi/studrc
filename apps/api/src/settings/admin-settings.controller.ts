import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateSiteSettingsDto } from './dto/update-site-settings.dto';
import { SettingsService } from './settings.service';

@Controller('admin/settings')
@UseGuards(JwtAdminGuard, RolesGuard)
@Roles(AdminRole.SUPERADMIN, AdminRole.ADMIN, AdminRole.EDITOR)
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('social')
  getSocial() {
    return this.settings.getSocial();
  }

  @Patch('social')
  updateSocial(@Body() dto: UpdateSiteSettingsDto) {
    return this.settings.updateSocial(dto);
  }
}
