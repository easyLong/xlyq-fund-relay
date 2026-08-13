import { IsOptional, IsString } from 'class-validator';

export class RemindTaskDto {
  @IsString()
  operatorId!: string;

  @IsOptional()
  @IsString()
  message?: string;
}
