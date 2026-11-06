import { StatusImageFit } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
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

/** Nombre max de diapos dans un statut */
export const STATUS_MAX_SLIDES = 20;

/** Statut (bulle) : visibilité et publication. Le contenu vit dans les diapos. */
export class CreateStatusDto {
  /** Durée de vie en heures (1 h → 7 jours) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  ttlHours?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateStatusDto {
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
}

export class CreateStatusSlideDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  articleId?: string | null;

  /** Cadrage de l’image : COVER ou FIT */
  @IsOptional()
  @IsEnum(StatusImageFit)
  imageFit?: StatusImageFit;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(15)
  durationSec?: number;
}

export class UpdateStatusSlideDto extends CreateStatusSlideDto {
  /** Retire le média (diapo → texte / raccourci article) */
  @IsOptional()
  @IsBoolean()
  clearMedia?: boolean;
}

export class ReorderStatusSlidesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(STATUS_MAX_SLIDES)
  @IsString({ each: true })
  ids!: string[];
}

export class MoveStatusDto {
  @IsIn(['up', 'down'])
  direction!: 'up' | 'down';
}

/** Regroupe ce statut dans un autre : ses diapos passent à la suite */
export class MergeStatusDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  targetId!: string;
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
