import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { PLATFORM_OPTIONS } from '@xlyq/shared';

export class FundPostItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  url?: string;
}

export class UpsertFundPostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  taskName!: string;

  @IsString()
  @IsIn([...PLATFORM_OPTIONS])
  platform!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FundPostItemDto)
  posts!: FundPostItemDto[];
}
