import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { SubscribeNewsletterDto } from './dto/subscribe-newsletter.dto';
import { NewsletterService } from './newsletter.service';

@Controller('newsletter')
export class PublicNewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Post('subscribe')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  subscribe(@Body() dto: SubscribeNewsletterDto) {
    return this.newsletter.subscribe(dto);
  }
}
