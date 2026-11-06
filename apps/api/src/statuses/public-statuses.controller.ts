import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { StatusesService } from './statuses.service';

@Controller('statuses')
export class PublicStatusesController {
  constructor(private readonly statuses: StatusesService) {}

  @Get()
  list() {
    return this.statuses.listPublic();
  }

  @Post(':id/view')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  view(@Param('id') id: string) {
    return this.statuses.registerView(id);
  }
}
