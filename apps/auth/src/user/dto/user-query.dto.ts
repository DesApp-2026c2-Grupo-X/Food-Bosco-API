import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { USER_ROLE_VALUES } from '../../config/constants'
import type { Role } from '../../config/constants'

export class UserQueryDto {
  @IsOptional()
  @IsIn(USER_ROLE_VALUES)
  role?: Role

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true
    if (value === 'false' || value === false) return false
    return value
  })
  @IsBoolean()
  active?: boolean | string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number
}
