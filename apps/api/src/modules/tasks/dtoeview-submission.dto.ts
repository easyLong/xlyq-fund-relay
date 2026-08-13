import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ReviewSubmissionDto {
  @IsBoolean()
  approved!: boolean;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsString()
  reviewerId!: string;
}
