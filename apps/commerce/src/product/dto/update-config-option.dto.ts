import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator'
import { ToBoolean } from '../../config/validation/is-boolean-value.decorator'

export class UpdateConfigOptionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  extraPrice?: number

  @IsOptional()
  @ToBoolean()
  available?: boolean
}
