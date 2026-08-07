import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class SubscribeNewsletterDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsBoolean()
  acceptedTerms!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  source?: string;
}
