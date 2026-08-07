import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LibraryService } from './library.service';

@Controller('library')
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.library.getLibrary(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('notifications')
  notifications(
    @CurrentUser() user: AuthUser,
    @Query('days') daysRaw?: string,
    @Query('q') q?: string,
    @Query('type') type?: string,
    @Query('unread') unreadRaw?: string,
    @Query('take') takeRaw?: string,
    @Query('skip') skipRaw?: string,
  ) {
    const days = Number.parseInt(daysRaw ?? '3', 10) || 3;
    const take = Math.min(
      50,
      Math.max(1, Number.parseInt(takeRaw ?? '10', 10) || 10),
    );
    const skip = Math.max(0, Number.parseInt(skipRaw ?? '0', 10) || 0);
    const unreadOnly =
      unreadRaw === '1' ||
      unreadRaw === 'true' ||
      unreadRaw === 'yes';
    return this.library.getNotifications(user.id, {
      days,
      q,
      type,
      unreadOnly,
      take,
      skip,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('notifications/unread-count')
  unreadCount(
    @CurrentUser() user: AuthUser,
    @Query('days') daysRaw?: string,
  ) {
    const days = Number.parseInt(daysRaw ?? '3', 10) || 3;
    return this.library.getUnreadNotificationsCount(user.id, days);
  }

  @UseGuards(JwtAuthGuard)
  @Post('notifications/read')
  markRead(
    @CurrentUser() user: AuthUser,
    @Body() body: { notificationId?: string },
  ) {
    return this.library.markNotificationRead(
      user.id,
      body?.notificationId ?? '',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('notifications/seen')
  markSeen(
    @CurrentUser() user: AuthUser,
    @Query('days') daysRaw?: string,
  ) {
    const days = Number.parseInt(daysRaw ?? '3', 10) || 3;
    return this.library.markNotificationsSeen(user.id, days);
  }

  @UseGuards(JwtAuthGuard)
  @Get('payments')
  payments(
    @CurrentUser() user: AuthUser,
    @Query('take') takeRaw?: string,
    @Query('skip') skipRaw?: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('provider') provider?: string,
    @Query('purpose') purpose?: string,
  ) {
    const take = Math.min(
      50,
      Math.max(1, Number.parseInt(takeRaw ?? '10', 10) || 10),
    );
    const skip = Math.max(0, Number.parseInt(skipRaw ?? '0', 10) || 0);
    return this.library.getPaymentHistory(user.id, {
      take,
      skip,
      q,
      status,
      provider,
      purpose,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('purchases')
  purchases(@CurrentUser() user: AuthUser) {
    return this.library.getPurchases(user.id);
  }
}
