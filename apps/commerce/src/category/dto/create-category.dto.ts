import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'
import { ToBoolean } from '../../config/validation/is-boolean-value.decorator'

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  @IsOptional()
  @ToBoolean()
  active?: boolean
}
