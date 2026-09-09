import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator'

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
  @IsBoolean()
  active!: boolean
}
