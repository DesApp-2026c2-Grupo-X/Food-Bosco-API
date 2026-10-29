import { IsNotEmpty, IsNumber, IsString, MaxLength, Min } from 'class-validator'

export class UpdateParameterDto {
  @IsNumber()
  @Min(0.0001)
  value!: number
}

export class CreateParameterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  key!: string

  @IsNumber()
  @Min(0.0001)
  value!: number

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  unit!: string
}
