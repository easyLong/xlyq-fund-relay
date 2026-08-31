import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsNotEmpty, IsString, MaxLength, ValidateNested } from 'class-validator';
import { PLATFORM_OPTIONS } from '@xlyq/shared';

export class ImportTaskRowDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  organizationName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  fundProductName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  taskName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100_000)
  content!: string;

  @IsString()
  @MaxLength(64)
  dueAt!: string;
}

export class ImportTasksDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => ImportTaskRowDto)
  rows!: ImportTaskRowDto[];

  @IsString()
  @IsIn([...PLATFORM_OPTIONS])
  platform!: string;

}
