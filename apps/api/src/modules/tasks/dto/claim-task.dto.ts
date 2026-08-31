import { IsOptional, IsString } from 'class-validator';

export class ClaimTaskDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  fundTaskPostId?: string;
}
