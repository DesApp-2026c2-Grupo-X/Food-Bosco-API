import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'
import { IsValidDateRange } from './is-valid-date-range.decorator'

export class UpdatePromotionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @IsOptional()
  @IsDateString()
  @IsValidDateRange({ message: 'La fecha de inicio no puede ser posterior a la fecha de fin' })
  startDate?: string

  @IsOptional()
  @IsDateString()
  endDate?: string
}
