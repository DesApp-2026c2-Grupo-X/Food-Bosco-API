import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator'
import { ToBoolean } from '../../config/validation/is-boolean-value.decorator'

export class CreateOrderStateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  @IsInt()
  @Min(0)
  order!: number
}

export class UpdateOrderStateDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number
}

export class SetActiveDto {
  @ToBoolean()
  active!: boolean
}
