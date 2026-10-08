import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'
import { ToBoolean } from '../../config/validation/is-boolean-value.decorator'

export class UpdateIngredientDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  unit?: string

  @IsOptional()
  @ToBoolean()
  active?: boolean
}
