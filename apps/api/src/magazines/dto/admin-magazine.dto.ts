import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AccessType } from '@prisma/client';
import { Type } from 'class-transformer';

const HEX_COLOR = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export class MagazineThemeDto {
  @IsString()
  @Matches(HEX_COLOR, { message: 'bgColor doit être une couleur hex (#RGB ou #RRGGBB)' })
  bgColor!: string;

  @IsString()
  @Matches(HEX_COLOR, {
    message: 'accentColor doit être une couleur hex (#RGB ou #RRGGBB)',
  })
  accentColor!: string;
}

export class CreateMagazineDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  issueNumber?: string;

  @IsEnum(AccessType)
  accessType!: AccessType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceCents?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MagazineThemeDto)
  theme?: MagazineThemeDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  pdfKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  previewKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  downloadKey?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMagazineDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  issueNumber?: string | null;

  @IsOptional()
  @IsEnum(AccessType)
  accessType?: AccessType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceCents?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MagazineThemeDto)
  theme?: MagazineThemeDto | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  pdfKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  previewKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  downloadKey?: string | null;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class PresignMagazinePdfDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  filename!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(350_000_000)
  size!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contentType?: string;
}

export class CompleteMagazinePdfDto {
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  key!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(350_000_000)
  size!: number;
}
