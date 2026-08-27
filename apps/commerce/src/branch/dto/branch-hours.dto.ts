import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator'

export class BranchHourDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  opening?: string

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  closing?: string

  @IsBoolean()
  closed!: boolean
}

export class UpdateBranchHoursDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchHourDto)
  hours!: BranchHourDto[]
}
