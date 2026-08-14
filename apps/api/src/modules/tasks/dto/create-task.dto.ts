import { IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PLATFORM_OPTIONS } from '@xlyq/shared';

export class CreateTaskDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  originalText?: string;

  @IsString()
  taskType!: string;

  @IsString()
  @IsIn([...PLATFORM_OPTIONS])
  platform!: string;

  @IsOptional()
  @IsString()
  campaignName?: string;

  @IsString()
  organizationId!: string;

  @IsOptional()
  @IsString()
  fundProductId?: string;

  @IsOptional()
  @IsString()
  fundTaskPostId?: string;

  @IsOptional()
  @IsString()
  fundTaskId?: string;

  @IsInt()
  @Min(1)
  quota!: number;

  @IsDateString()
  dueAt!: string;
}
