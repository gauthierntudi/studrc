import { IsBoolean } from 'class-validator';

export class UpdateNewsletterActiveDto {
  @IsBoolean()
  isActive!: boolean;
}
