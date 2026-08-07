import { Controller, Get } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';

/** Formules actives — site public (pas d’auth). */
@Controller('plans')
export class PublicPlansController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  list() {
    return this.subscriptions.listPublicPlans();
  }
}
