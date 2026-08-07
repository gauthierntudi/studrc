import { IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateStripeCheckoutDto {
  @IsString()
  @MinLength(1)
  planId!: string;
}

export class ConfirmStripeDto {
  @IsString()
  @MinLength(1)
  paymentId!: string;

  /** PaymentIntent (Payment Element) — préféré */
  @IsOptional()
  @IsString()
  @MinLength(1)
  paymentIntentId?: string;

  /** Legacy Checkout Session (redirection) */
  @IsOptional()
  @IsString()
  @MinLength(1)
  sessionId?: string;
}

export class CreateFlexpaieDto {
  @IsString()
  @MinLength(1)
  planId!: string;

  /** Numéro mobile RDC (243…) */
  @IsString()
  @Matches(/^\+?[0-9]{9,15}$/, {
    message: 'Numéro de téléphone invalide',
  })
  phone!: string;
}

export class CreateStripePurchaseDto {
  @IsString()
  @MinLength(1)
  magazineId!: string;
}

export class CreateFlexpaiePurchaseDto {
  @IsString()
  @MinLength(1)
  magazineId!: string;

  /** Numéro mobile RDC (243…) */
  @IsString()
  @Matches(/^\+?[0-9]{9,15}$/, {
    message: 'Numéro de téléphone invalide',
  })
  phone!: string;
}

export class FlexpaieCallbackDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  orderNumber?: string;

  @IsOptional()
  @IsString()
  provider_reference?: string;

  @IsOptional()
  amount?: string | number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsIn(['0', '1', 0, 1])
  status?: string | number;
}
