import { IsOptional, IsString, IsUrl } from 'class-validator';

export class SubmitTaskDto {
  @IsString()
  claimId!: string;

  @IsString()
  userId!: string;

  @IsUrl({ require_protocol: true })
  linkUrl!: string;

  @IsOptional()
  @IsString()
  textContent?: string;
}
