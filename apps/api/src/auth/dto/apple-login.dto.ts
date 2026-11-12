import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AppleLoginDto {
  /** identityToken renvoyé par « Se connecter avec Apple » */
  @IsString()
  @MinLength(20)
  identityToken!: string;

  /** Nom complet, fourni par Apple uniquement à la première connexion */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
