import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminDashboardService } from './admin-dashboard.service';
import { JwtAdminGuard } from './guards/jwt-admin.guard';

@Controller('admin')
@UseGuards(JwtAdminGuard)
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get('stats')
  stats() {
    return this.dashboard.getStats();
  }
}
