import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

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
  platform!: string;

  @IsOptional()
  @IsString()
  campaignName?: string;

  @IsString()
  organizationId!: string;

  @IsOptional()
  @IsString()
  fundProductId?: string;

  @IsInt()
  @Min(1)
  quota!: number;

  @IsDateString()
  dueAt!: string;
}
