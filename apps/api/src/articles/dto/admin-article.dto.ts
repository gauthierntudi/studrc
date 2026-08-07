import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class ArticleBlockInputDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(240)
  title?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(500)
  coverCaption?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  content?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}

export class CreateArticleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(240)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  slug?: string;

  /** Miroir legacy / recherche — optionnel si `blocks` fourni */
  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  content?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200_000)
  excerpt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(500)
  coverCaption?: string | null;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  /** Lien optionnel vers un magazine du kiosque (`null` / omit = aucun) */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(64)
  magazineId?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArticleBlockInputDto)
  blocks?: ArticleBlockInputDto[];
}

export class UpdateArticleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(240)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  content?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(200_000)
  excerpt?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(80)
  category?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(500)
  coverCaption?: string | null;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  /** Lien optionnel vers un magazine (`null` = détacher) */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(64)
  magazineId?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArticleBlockInputDto)
  blocks?: ArticleBlockInputDto[];
}
