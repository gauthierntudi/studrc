import { IsEmail, IsString, Length, Matches, MinLength, MaxLength } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Code OTP invalide' })
  otp!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
