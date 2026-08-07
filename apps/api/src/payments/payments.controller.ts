import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ConfirmStripeDto,
  CreateFlexpaieDto,
  CreateFlexpaiePurchaseDto,
  CreateStripeCheckoutDto,
  CreateStripePurchaseDto,
} from './dto/payments.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('stripe/create')
  createStripe(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateStripeCheckoutDto,
  ) {
    return this.payments.createStripeCheckout(user.id, dto.planId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('stripe/purchase')
  createStripePurchase(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateStripePurchaseDto,
  ) {
    return this.payments.createStripePurchase(user.id, dto.magazineId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('stripe/confirm')
  confirmStripe(@CurrentUser() user: AuthUser, @Body() dto: ConfirmStripeDto) {
    return this.payments.confirmStripePayment(user.id, dto.paymentId, {
      paymentIntentId: dto.paymentIntentId,
      sessionId: dto.sessionId,
    });
  }

  @Post('stripe/webhook')
  stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    const raw = req.rawBody;
    if (!raw) {
      throw new BadRequestException(
        'Raw body manquant pour le webhook Stripe',
      );
    }
    return this.payments.handleStripeWebhook(raw, signature);
  }

  @UseGuards(JwtAuthGuard)
  @Post('flexpaie/create')
  createFlexpaie(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateFlexpaieDto,
  ) {
    return this.payments.createFlexpaiePayment(user.id, dto.planId, dto.phone);
  }

  @UseGuards(JwtAuthGuard)
  @Post('flexpaie/purchase')
  createFlexpaiePurchase(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateFlexpaiePurchaseDto,
  ) {
    return this.payments.createFlexpaiePurchase(
      user.id,
      dto.magazineId,
      dto.phone,
    );
  }

  @Post('flexpaie/callback')
  flexpaieCallback(@Body() body: Record<string, unknown>) {
    return this.payments.handleFlexpaieCallback(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  status(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payments.getStatus(id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/check')
  checkFlexpaie(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payments.checkFlexpaieStatus(id, user.id);
  }
}
