import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

export class BranchQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  active?: boolean

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
