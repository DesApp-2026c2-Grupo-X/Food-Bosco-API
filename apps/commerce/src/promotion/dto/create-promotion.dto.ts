import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

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
  startDate!: string

  @IsDateString()
  endDate!: string
}
