import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MonitoringService } from './monitoring.service';

@Controller('admin/monitoring')
@UseGuards(JwtAdminGuard, RolesGuard)
@Roles(AdminRole.SUPERADMIN)
export class AdminMonitoringController {
  constructor(private readonly monitoring: MonitoringService) {}

  @Get()
  getSnapshot() {
    return this.monitoring.getSnapshot();
  }

  /** Force une évaluation d’alerte (respecte le cooldown Redis). */
  @Post('alert')
  evaluateAlerts() {
    return this.monitoring.evaluateAlerts();
  }
}
