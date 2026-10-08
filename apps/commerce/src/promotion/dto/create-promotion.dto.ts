import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'
import { IsValidDateRange } from './is-valid-date-range.decorator'

export class CreatePromotionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @IsDateString()
  @IsValidDateRange({ message: 'La fecha de inicio no puede ser posterior a la fecha de fin' })
  startDate!: string

  @IsDateString()
  endDate!: string
}
