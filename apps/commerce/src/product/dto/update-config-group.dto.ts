import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator'
import { CONFIG_GROUP_TYPE_VALUES } from '../../config/constants'
import type { ConfigGroupType } from '../../config/constants'
import { ToBoolean } from '../../config/validation/is-boolean-value.decorator'
import { IsCoherentConfigGroup } from './is-coherent-config-group.decorator'

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
  @ToBoolean()
  required?: boolean

  @IsOptional()
  @IsInt()
  @Min(0)
  min?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  @IsCoherentConfigGroup()
  max?: number
}
