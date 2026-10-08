import {
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator'
import { CONFIG_GROUP_TYPE_VALUES } from '../../config/constants'
import type { ConfigGroupType } from '../../config/constants'
import { ToBoolean } from '../../config/validation/is-boolean-value.decorator'
import { IsCoherentConfigGroup } from './is-coherent-config-group.decorator'

export class CreateConfigGroupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  @IsIn(CONFIG_GROUP_TYPE_VALUES)
  type!: ConfigGroupType

  @ToBoolean()
  required!: boolean

  @ValidateIf((group: CreateConfigGroupDto) => group.required === true || group.min !== undefined)
  @IsDefined()
  @IsInt()
  @Min(0)
  min?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  @IsCoherentConfigGroup()
  max?: number
}
