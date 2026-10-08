import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'
import { ToBoolean } from '../../config/validation/is-boolean-value.decorator'

export class CreateIngredientDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  unit!: string

  @IsOptional()
  @ToBoolean()
  active?: boolean
}
