import { Type } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaymentStatus } from '@prisma/client';

export class RequestAdminPaymentOtpDto {
  @IsEnum(PaymentStatus)
  status!: PaymentStatus;

  /** Note assistance (ex. Mobile Money débité, callback FlexPaie manquant). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Type(() => String)
  note?: string;
}

export class UpdateAdminPaymentDto {
  @IsEnum(PaymentStatus)
  status!: PaymentStatus;

  @Matches(/^\d{6}$/, { message: 'Code OTP invalide' })
  otp!: string;

  /** Note assistance (ex. Mobile Money débité, callback FlexPaie manquant). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Type(() => String)
  note?: string;
}
