import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUrl } from 'class-validator';

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

  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  screenshots!: string[];
}
