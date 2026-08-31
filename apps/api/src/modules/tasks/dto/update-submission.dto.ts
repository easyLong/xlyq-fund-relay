import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateSubmissionDto {
  @IsString()
  userId!: string;

  @IsUrl({ require_protocol: true })
  @MaxLength(1024)
  linkUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  textContent?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(3_500_000, { each: true })
  screenshots!: string[];
}
