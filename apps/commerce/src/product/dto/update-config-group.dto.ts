import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator'
import { CONFIG_GROUP_TYPE_VALUES } from '../../config/constants'
import type { ConfigGroupType } from '../../config/constants'

export class UpdateConfigGroupDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string

  @IsOptional()
  @IsIn(CONFIG_GROUP_TYPE_VALUES)
  type?: ConfigGroupType

  @IsOptional()
  @IsBoolean()
  required?: boolean

  @IsOptional()
  @IsInt()
  @Min(0)
  min?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  max?: number
}
