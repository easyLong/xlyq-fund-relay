import { IsString } from 'class-validator';

export class ClaimTaskDto {
  @IsString()
  userId!: string;
}
