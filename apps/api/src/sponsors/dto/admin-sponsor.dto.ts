import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateSponsorDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @ValidateIf(
    (_, v) => v !== null && v !== undefined && String(v).trim() !== '',
  )
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  url?: string | null;
}

export class UpdateSponsorDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @ValidateIf(
    (_, v) => v !== null && v !== undefined && String(v).trim() !== '',
  )
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  url?: string | null;
}
