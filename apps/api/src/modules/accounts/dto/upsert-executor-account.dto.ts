import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PLATFORM_OPTIONS } from '@xlyq/shared';

export class UpsertExecutorAccountDto {
  @IsString()
  @MaxLength(64)
  @IsIn([...PLATFORM_OPTIONS])
  platform!: string;

  @IsString()
  @MaxLength(128)
  accountName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  accountUid?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  password?: string;
}
