import { Type } from 'class-transformer';
import { StatusImageFit } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Vidéo de statut : MP4/MOV, 100 Mo max */
export const STATUS_VIDEO_MAX_BYTES = 100_000_000;

export class CreateStatusDto {
  /** Cadrage de l’image : COVER ou FIT */
  @IsOptional()
  @IsEnum(StatusImageFit)
  imageFit?: StatusImageFit;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  articleId?: string | null;

  /** Durée de vie en heures (1 h → 7 jours) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  ttlHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(15)
  durationSec?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateStatusDto {
  /** Cadrage de l’image : COVER ou FIT */
  @IsOptional()
  @IsEnum(StatusImageFit)
  imageFit?: StatusImageFit;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  articleId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(15)
  durationSec?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  /** Nouvelle expiration (ISO) */
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  /** Prolonge / relance : expiration = maintenant + N heures */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  ttlHours?: number;

  /** Retire le média (statut → raccourci article) */
  @IsOptional()
  @IsBoolean()
  clearMedia?: boolean;
}

export class PresignStatusVideoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  filename!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(STATUS_VIDEO_MAX_BYTES)
  size!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contentType?: string;
}

export class CompleteStatusVideoDto {
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  key!: string;
}

export class MoveStatusDto {
  @IsIn(['up', 'down'])
  direction!: 'up' | 'down';
}
