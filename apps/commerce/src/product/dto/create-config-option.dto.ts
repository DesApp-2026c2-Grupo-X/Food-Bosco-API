import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator'
import { ToBoolean } from '../../config/validation/is-boolean-value.decorator'

export class CreateConfigOptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  @IsNumber()
  @Min(0)
  extraPrice!: number

  @IsOptional()
  @ToBoolean()
  available?: boolean
}
