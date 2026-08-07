import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const SOCIAL_NETWORKS = [
  'facebook',
  'twitter',
  'instagram',
  'linkedin',
  'youtube',
  'tiktok',
  'whatsapp',
  'telegram',
  'threads',
  'other',
] as const;

export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export class SocialLinkDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;

  @IsIn(SOCIAL_NETWORKS)
  network!: SocialNetwork;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string | null;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  @IsUrl({ require_protocol: true }, { message: 'URL invalide' })
  url!: string;
}

export class UpdateSiteSettingsDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  links!: SocialLinkDto[];
}
