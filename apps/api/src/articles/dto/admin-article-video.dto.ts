import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export const ARTICLE_VIDEO_MAX_BYTES = 500_000_000;

export class PresignArticleVideoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  filename!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ARTICLE_VIDEO_MAX_BYTES)
  size!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contentType?: string;
}

export class CompleteArticleVideoDto {
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  key!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ARTICLE_VIDEO_MAX_BYTES)
  size!: number;
}
