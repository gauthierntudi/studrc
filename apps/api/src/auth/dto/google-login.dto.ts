import { IsOptional, IsString, MinLength } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  @MinLength(20)
  credential!: string;

  @IsOptional()
  @IsString()
  turnstileToken?: string;
}
