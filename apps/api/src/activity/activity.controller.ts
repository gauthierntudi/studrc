import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ActivityActorType } from '@prisma/client';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { labelActivityAction } from './activity-labels';
import { ActivityService } from './activity.service';

@Controller('admin/activity')
@UseGuards(JwtAdminGuard)
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  async list(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('actorType') actorType?: string,
    @Query('q') q?: string,
  ) {
    const parsedActor =
      actorType &&
      Object.values(ActivityActorType).includes(actorType as ActivityActorType)
        ? (actorType as ActivityActorType)
        : undefined;

    const result = await this.activity.list({
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
      actorType: parsedActor,
      q,
    });

    return {
      ...result,
      items: result.items.map((item) => ({
        ...item,
        actionLabel: labelActivityAction(item.action),
      })),
    };
  }

  @Get('recent')
  async recent(@Query('take') take?: string) {
    const items = await this.activity.recent(
      take ? Math.min(Number(take) || 8, 20) : 8,
    );
    return {
      items: items.map((item) => ({
        ...item,
        actionLabel: labelActivityAction(item.action),
      })),
    };
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    const item = await this.activity.getById(id);
    if (!item) {
      throw new NotFoundException('Activité introuvable');
    }
    return {
      ...item,
      actionLabel: labelActivityAction(item.action),
    };
  }
}
