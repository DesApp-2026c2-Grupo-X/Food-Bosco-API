import { Type } from 'class-transformer'
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator'

export class PublishTariffDto {
  @IsNumber()
  @Min(0)
  baseFare!: number

  @IsNumber()
  @Min(0)
  perKm!: number

  @IsNumber()
  @Min(0)
  perOrder!: number

  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Za-z]{3}$/)
  currency?: string

  @IsString()
  @IsNotEmpty()
  createdBy!: string
}

export class TariffHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}
